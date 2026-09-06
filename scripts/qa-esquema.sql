-- Puerta QA de la Entrega 2. Comprueba, una por una, las reglas de negocio que
-- viven en la base. Cada caso afirma lo que debe pasar y lo que debe fallar.
-- Se corre con: psql -d motor_qa -f scripts/qa-esquema.sql

\set ON_ERROR_STOP on
\set QUIET on

create or replace function qa_afirmar(condicion boolean, etiqueta text)
returns void language plpgsql as $$
begin
  if condicion then
    raise notice 'PASA · %', etiqueta;
  else
    raise exception 'FALLA · %', etiqueta;
  end if;
end;
$$;

-- Corre una sentencia y afirma que revienta. Sirve para las reglas duras.
create or replace function qa_debe_fallar(sentencia text, etiqueta text, motivo text default null)
returns void language plpgsql as $$
begin
  begin
    execute sentencia;
  exception when others then
    -- Un rechazo por la razón equivocada es tan malo como no rechazar.
    if motivo is not null and position(motivo in sqlerrm) = 0 then
      raise exception 'FALLA · % (rechazado por otra razón: %)', etiqueta, sqlerrm;
    end if;
    raise notice 'PASA · % (rechazado: %)', etiqueta, left(sqlerrm, 60);
    return;
  end;
  raise exception 'FALLA · % (la base lo aceptó y debía rechazarlo)', etiqueta;
end;
$$;

-- ---------------------------------------------------------------------------
-- Datos de partida
-- ---------------------------------------------------------------------------

truncate brands, auth.users cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'editora@saleads.test'),
  ('22222222-2222-2222-2222-222222222222', 'aprobadora@saleads.test'),
  ('33333333-3333-3333-3333-333333333333', 'audiovisual@saleads.test'),
  ('44444444-4444-4444-4444-444444444444', 'observador@saleads.test');

update profiles set rol = 'editora'     where email = 'editora@saleads.test';
update profiles set rol = 'aprobadora'  where email = 'aprobadora@saleads.test';
update profiles set rol = 'audiovisual' where email = 'audiovisual@saleads.test';
update profiles set rol = 'observador'  where email = 'observador@saleads.test';

select qa_afirmar((select count(*) from profiles) = 4,
  'el trigger de alta crea un perfil por cada usuario');

insert into brands (id, nombre, slug, whatsapp_url) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'SaleADS', 'saleads', 'https://wa.me/573000000000'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Juanads', 'juanads', 'https://wa.me/573000000001');

insert into social_accounts (id, brand_id, red, handle, external_account_id, credential_ref) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'instagram', '@saleads.ai', 'IG_1', 'META_TOKEN_SALEADS');

insert into resources (id, brand_id, titulo, tipo, url) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Guía de anuncios', 'pdf', 'https://bio.saleads.co/recursos/guia');

insert into pieces (id, brand_id, semana, tema, estado, origen, sheet_row_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-09-07', 'Meta Ads', 'revision', 'sheet', 'fila-1'),
  ('dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-09-07', 'Creatividad', 'revision', 'sheet', 'fila-2'),
  ('dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', '2026-09-07', 'Marca personal', 'revision', 'sheet', 'fila-3');

-- ---------------------------------------------------------------------------
-- Regla: normalización de la palabra clave
-- ---------------------------------------------------------------------------

insert into keywords (piece_id, palabra, variantes)
values ('dddddddd-0000-0000-0000-000000000001', '  ¡Automatízá!  ', array['automatizas', '']);

select qa_afirmar(
  (select palabra from keywords where piece_id = 'dddddddd-0000-0000-0000-000000000001') = 'AUTOMATIZA',
  'la palabra clave se guarda normalizada');

select qa_afirmar(
  (select array_length(variantes, 1) from keywords where piece_id = 'dddddddd-0000-0000-0000-000000000001') = 1,
  'las variantes vacías se descartan');

select qa_debe_fallar(
  $$insert into keywords (piece_id, palabra) values ('dddddddd-0000-0000-0000-000000000002', '!!!')$$,
  'una palabra clave que queda vacía es rechazada', 'queda vacía');

-- ---------------------------------------------------------------------------
-- Regla 2: palabra clave única por marca mientras esté activa
-- ---------------------------------------------------------------------------

select qa_debe_fallar(
  $$insert into keywords (piece_id, palabra) values ('dddddddd-0000-0000-0000-000000000002', 'automatiza')$$,
  'la palabra clave repetida en la misma marca es rechazada', 'ya está activa');

insert into keywords (piece_id, palabra)
values ('dddddddd-0000-0000-0000-000000000003', 'AUTOMATIZA');

select qa_afirmar(
  (select count(*) from keywords where palabra = 'AUTOMATIZA') = 2,
  'la misma palabra clave convive en marcas distintas');

update keywords set activa_hasta = now() - interval '1 day'
 where piece_id = 'dddddddd-0000-0000-0000-000000000001';

insert into keywords (piece_id, palabra)
values ('dddddddd-0000-0000-0000-000000000002', 'AUTOMATIZA');

select qa_afirmar(
  (select count(*) from keywords k join pieces p on p.id = k.piece_id
    where p.brand_id = 'aaaaaaaa-0000-0000-0000-000000000001' and k.palabra = 'AUTOMATIZA') = 2,
  'la palabra clave se reutiliza cuando la anterior venció');

-- Se deja el terreno limpio para el resto de los casos.
delete from keywords where piece_id = 'dddddddd-0000-0000-0000-000000000002';
update keywords set activa_hasta = null where piece_id = 'dddddddd-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Regla 1 y 7: nada se programa incompleto ni sin aprobación
-- ---------------------------------------------------------------------------

select qa_debe_fallar(
  $$update pieces set estado = 'programado' where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  'la pieza sin fecha, mensaje ni enlace no se programa', 'Falta:');

insert into dm_templates (piece_id, mensaje, destino_url)
values ('dddddddd-0000-0000-0000-000000000001', 'Te dejo la guía aquí', 'https://bio.saleads.co/r/meta1');

insert into tracked_links (piece_id, slug, destino_url)
values ('dddddddd-0000-0000-0000-000000000001', 'meta1', 'https://wa.me/573000000000?text=AUTOMATIZA');

update pieces
   set fecha_publicacion = '2026-09-08', hora_publicacion = '18:00'
 where id = 'dddddddd-0000-0000-0000-000000000001';

select qa_debe_fallar(
  $$update pieces set estado = 'programado' where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  'la pieza completa sin aprobación no se programa', 'necesita aprobación');

insert into approvals (piece_id, usuario_id, accion)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aprobar');

select qa_afirmar(
  (select estado from pieces where id = 'dddddddd-0000-0000-0000-000000000001') = 'aprobado',
  'la aprobación deja la pieza en aprobado');

update pieces set estado = 'programado' where id = 'dddddddd-0000-0000-0000-000000000001';

select qa_afirmar(
  (select estado from pieces where id = 'dddddddd-0000-0000-0000-000000000001') = 'programado',
  'la pieza completa y aprobada sí se programa');

-- ---------------------------------------------------------------------------
-- Regla 3: la escucha se activa con el identificador externo
-- ---------------------------------------------------------------------------

insert into publications (id, piece_id, social_account_id, caption_final, estado, programado_at)
values ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', 'caption de prueba', 'pendiente', now());

select qa_afirmar(
  (select activa_desde from keywords where piece_id = 'dddddddd-0000-0000-0000-000000000001') is null,
  'la palabra clave nace sin activar');

update publications
   set estado = 'publicado', external_post_id = 'IG_POST_1'
 where id = 'eeeeeeee-0000-0000-0000-000000000001';

select qa_afirmar(
  (select activa_desde from keywords where piece_id = 'dddddddd-0000-0000-0000-000000000001') is not null,
  'la publicación en vivo activa la palabra clave');

select qa_afirmar(
  (select estado from pieces where id = 'dddddddd-0000-0000-0000-000000000001') = 'publicado',
  'la pieza pasa a publicado con su primera publicación en vivo');

select qa_debe_fallar(
  $$insert into publications (piece_id, social_account_id) values
    ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001')$$,
  'una pieza sale una sola vez por cuenta', 'duplicate key');

-- ---------------------------------------------------------------------------
-- Regla 5: idempotencia de comentarios y respuestas
-- ---------------------------------------------------------------------------

insert into comments (publication_id, external_comment_id, autor_username, autor_external_id, texto, estado)
values ('eeeeeeee-0000-0000-0000-000000000001', 'C1', 'ana', 'U1', 'automatiza porfa', 'respondido');

select qa_debe_fallar(
  $$insert into comments (publication_id, external_comment_id, autor_external_id, texto)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'C1', 'U1', 'automatiza porfa')$$,
  'el mismo comentario visto dos veces entra una sola vez', 'comments_publication_id_external_comment_id_key');

insert into comments (publication_id, external_comment_id, autor_username, autor_external_id, texto, estado)
values ('eeeeeeee-0000-0000-0000-000000000001', 'C2', 'ana', 'U1', 'automatiza de nuevo', 'detectado');

select qa_debe_fallar(
  $$update comments set estado = 'respondido'
     where external_comment_id = 'C2'$$,
  'un autor recibe una sola respuesta por publicación', 'comments_un_autor_por_publicacion');

select qa_afirmar(
  (select count(*) from comments where publication_id = 'eeeeeeee-0000-0000-0000-000000000001') = 2,
  'el segundo comentario del mismo autor queda registrado sin respuesta');

insert into comments (publication_id, external_comment_id, autor_username, autor_external_id, texto, estado)
values ('eeeeeeee-0000-0000-0000-000000000001', 'C3', 'luis', 'U2', 'AUTOMATIZAAA', 'respondido');

select qa_afirmar(
  (select count(*) from comments where estado = 'respondido') = 2,
  'otro autor sí recibe su respuesta en la misma publicación');

insert into dm_log (comment_id, destinatario, mensaje, estado)
select id, 'ana', 'Te dejo la guía', 'enviado' from comments where external_comment_id = 'C1';

-- Un intento fallido sí se vuelve a escribir: es lo que permite reintentar.
insert into dm_log (comment_id, destinatario, mensaje, estado, error)
select id, 'ana', 'primer intento', 'fallido', 'límite de la plataforma'
  from comments where external_comment_id = 'C3';

select qa_afirmar(
  (select count(*) from dm_log l join comments c on c.id = l.comment_id
    where c.external_comment_id = 'C3') = 1,
  'cada intento queda escrito con su resultado');

select qa_debe_fallar(
  $$insert into dm_log (comment_id, mensaje, estado)
    select id, 'segundo envío', 'enviado' from comments where external_comment_id = 'C1'$$,
  'la bitácora admite un solo mensaje entregado por comentario', 'dm_log_un_envio_bueno');

-- ---------------------------------------------------------------------------
-- Regla 8: la devolución regresa a revisión y libera la fecha
-- ---------------------------------------------------------------------------

insert into pieces (id, brand_id, semana, tema, estado, fecha_publicacion, hora_publicacion)
values ('dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001',
        '2026-09-07', 'Pieza devuelta', 'aprobado', '2026-09-09', '18:00');

insert into publications (piece_id, social_account_id, estado)
values ('dddddddd-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'pendiente');

insert into approvals (piece_id, usuario_id, accion, comentario)
values ('dddddddd-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'devolver', 'El hook no arranca');

select qa_afirmar(
  (select estado from pieces where id = 'dddddddd-0000-0000-0000-000000000004') = 'revision',
  'la devolución regresa la pieza a revisión');

select qa_afirmar(
  (select fecha_publicacion from pieces where id = 'dddddddd-0000-0000-0000-000000000004') is null,
  'la devolución libera la fecha');

select qa_afirmar(
  (select count(*) from publications where piece_id = 'dddddddd-0000-0000-0000-000000000004') = 0,
  'la devolución cancela las publicaciones pendientes');

select qa_afirmar(
  (select count(*) from approvals where piece_id = 'dddddddd-0000-0000-0000-000000000004') = 1,
  'la devolución queda registrada con su comentario');

\echo ''
\echo '=== Reglas de negocio en la base: todas verificadas ==='
