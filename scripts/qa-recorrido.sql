-- Recorrido completo, de la fila de la hoja al lead en WhatsApp.
--
-- Las baterías anteriores prueban cada regla por separado. Esta prueba la
-- costura: los siete triggers actuando juntos sobre una misma pieza, en el
-- orden real, con todo lo que puede salir mal por el camino.

\set ON_ERROR_STOP on
\set QUIET on

\echo ''
\echo '--- Recorrido de una pieza, de principio a fin ---'

-- Terreno limpio, para que el recorrido no herede nada.
truncate brands, auth.users, notices cascade;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'jess@saleads.test'),
  ('22222222-2222-2222-2222-222222222222', 'karen@saleads.test');
update profiles set rol = 'editora'    where email = 'jess@saleads.test';
update profiles set rol = 'aprobadora' where email = 'karen@saleads.test';

insert into brands (id, nombre, slug, sheet_id, whatsapp_url)
values ('a0000000-0000-0000-0000-000000000001', 'SaleADS', 'saleads', 'HOJA_1',
        'https://wa.me/573000000000');

insert into social_accounts (id, brand_id, red, handle, external_account_id, credential_ref, token_expira_at)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        'instagram', '@saleads.ai', 'IG_ACCOUNT', 'META_TOKEN_SALEADS', now() + interval '45 days');

insert into resources (id, brand_id, titulo, tipo, url, seccion)
values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        'Guía de anuncios', 'pdf', 'https://bio.saleads.co/recursos/guia', 'Empieza aquí');

-- Paso 1 · La sincronización trae la fila
insert into pieces (id, brand_id, semana, tema, hook, formato, drive_url, responsable,
                    fecha_publicacion, hora_publicacion, origen, sheet_row_id, sheet_hash, resource_id)
values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
        '2020-01-01', 'Tres errores en Meta Ads', 'Nadie te lo dijo', 'reel',
        'https://drive.google.com/file/d/1ABCdefGHIjklMNOpqrSTUvwx/view', 'Ema',
        '2026-09-10', '18:00', 'sheet', 'fila-2', 'huella-1',
        'c0000000-0000-0000-0000-000000000001');

select qa_afirmar(
  (select estado from pieces where id = 'e0000000-0000-0000-0000-000000000001') = 'borrador',
  'paso 1 · la pieza entra desde la hoja, en borrador');

select qa_afirmar(
  (select semana from pieces where id = 'e0000000-0000-0000-0000-000000000001') = '2026-09-07',
  'paso 1 · la semana se deriva sola de la fecha');

-- Paso 2 · La misma sincronización, otra vez: no duplica
select qa_debe_fallar(
  $$insert into pieces (brand_id, semana, tema, origen, sheet_row_id)
    values ('a0000000-0000-0000-0000-000000000001', '2026-09-07', 'Tres errores en Meta Ads', 'sheet', 'fila-2')$$,
  'paso 2 · correr la sincronización dos veces no duplica la pieza', 'duplicate key');

-- Paso 3 · Audiovisual la deja lista y la manda a revisión
update pieces set estado = 'revision' where id = 'e0000000-0000-0000-0000-000000000001';

-- Paso 4 · Jess prepara la automatización
insert into keywords (piece_id, palabra, variantes)
values ('e0000000-0000-0000-0000-000000000001', '  ¡AutomatizÁ!  ', array['automatizas', 'automatiz']);

select qa_afirmar(
  (select palabra from keywords where piece_id = 'e0000000-0000-0000-0000-000000000001') = 'AUTOMATIZA',
  'paso 4 · la palabra clave se guarda normalizada');

insert into dm_templates (piece_id, mensaje, destino_url)
values ('e0000000-0000-0000-0000-000000000001',
        'Aquí tienes la guía que pediste con AUTOMATIZA',
        'https://wa.me/573000000000?text=Hola%2C+vengo+por+AUTOMATIZA');

insert into tracked_links (piece_id, slug, destino_url)
values ('e0000000-0000-0000-0000-000000000001', 'automatiza-e00000',
        'https://wa.me/573000000000?text=Hola%2C+vengo+por+AUTOMATIZA');

-- Paso 5 · Sin aprobación no se programa
select qa_debe_fallar(
  $$update pieces set estado = 'programado' where id = 'e0000000-0000-0000-0000-000000000001'$$,
  'paso 5 · nada sale sin la aprobación', 'necesita aprobación');

-- Paso 6 · Karen la devuelve
insert into approvals (piece_id, usuario_id, accion, comentario)
values ('e0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
        'devolver', 'El hook se cae en el segundo tres');

select qa_afirmar(
  (select estado from pieces where id = 'e0000000-0000-0000-0000-000000000001') = 'revision'
    and (select fecha_publicacion from pieces where id = 'e0000000-0000-0000-0000-000000000001') is null,
  'paso 6 · la devolución regresa a revisión y libera la fecha');

select qa_afirmar(
  (select count(*) from notices where tipo = 'pieza_devuelta') = 1,
  'paso 6 · la devolución deja su aviso');

-- Paso 7 · Corregida y aprobada
update pieces set hook = 'El error que te cuesta plata', fecha_publicacion = '2026-09-11', hora_publicacion = '18:00'
 where id = 'e0000000-0000-0000-0000-000000000001';

insert into approvals (piece_id, usuario_id, accion)
values ('e0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'aprobar');

select qa_afirmar(
  (select estado from pieces where id = 'e0000000-0000-0000-0000-000000000001') = 'aprobado',
  'paso 7 · la pieza corregida queda aprobada');

-- Paso 8 · Jess aprueba el día, y se programa
update pieces set estado = 'programado' where id = 'e0000000-0000-0000-0000-000000000001';

insert into publications (id, piece_id, social_account_id, caption_final, estado, programado_at)
values ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
        'El error que te cuesta plata en Meta Ads. Comenta AUTOMATIZA y te mando la guía.',
        'pendiente', '2026-09-11 23:00:00+00');

select qa_afirmar(
  (select activa_desde from keywords where piece_id = 'e0000000-0000-0000-0000-000000000001') is null,
  'paso 8 · la escucha sigue apagada mientras la pieza no sale');

-- Paso 9 · El video se copia a Storage antes de la hora
update pieces set storage_path = 'a0000000-0000-0000-0000-000000000001/e0000000.mp4', video_bytes = 24_500_000
 where id = 'e0000000-0000-0000-0000-000000000001';

-- Paso 10 · La publicación sale, y la escucha se enciende sola
update publications
   set estado = 'publicado', external_post_id = 'IG_POST_XYZ',
       permalink = 'https://instagram.com/p/XYZ'
 where id = 'f0000000-0000-0000-0000-000000000001';

select qa_afirmar(
  (select activa_desde from keywords where piece_id = 'e0000000-0000-0000-0000-000000000001') is not null,
  'paso 10 · la publicación en vivo enciende la escucha, sin que nadie la toque');

select qa_afirmar(
  (select estado from pieces where id = 'e0000000-0000-0000-0000-000000000001') = 'publicado',
  'paso 10 · la pieza queda como publicada');

-- Paso 11 · Llegan los comentarios
insert into comments (publication_id, external_comment_id, autor_username, autor_external_id, texto, keyword_id, estado)
select 'f0000000-0000-0000-0000-000000000001', 'C_ANA', 'ana', 'U_ANA',
       'holaa me interesa mucho, AUTOMATIZAAA 🔥', id, 'respondido'
  from keywords where piece_id = 'e0000000-0000-0000-0000-000000000001';

insert into dm_log (comment_id, destinatario, mensaje, estado)
select id, 'ana', 'Aquí tienes la guía que pediste con AUTOMATIZA', 'enviado'
  from comments where external_comment_id = 'C_ANA';

select qa_afirmar(
  (select count(*) from dm_log) = 1,
  'paso 11 · el comentario con la palabra recibe su mensaje');

-- El webhook entrega el mismo comentario otra vez
select qa_debe_fallar(
  $$insert into comments (publication_id, external_comment_id, autor_external_id, texto)
    values ('f0000000-0000-0000-0000-000000000001', 'C_ANA', 'U_ANA', 'holaa me interesa mucho, AUTOMATIZAAA')$$,
  'paso 11 · la entrega repetida del webhook no genera un segundo mensaje', 'duplicate key');

-- Ana comenta de nuevo
insert into comments (publication_id, external_comment_id, autor_username, autor_external_id, texto, estado)
values ('f0000000-0000-0000-0000-000000000001', 'C_ANA_2', 'ana', 'U_ANA', 'automatiza otra vez', 'detectado');

select qa_debe_fallar(
  $$update comments set estado = 'respondido' where external_comment_id = 'C_ANA_2'$$,
  'paso 11 · Ana no recibe un segundo mensaje', 'comments_un_autor_por_publicacion');

-- Un comentario que llegó tarde
insert into comments (publication_id, external_comment_id, autor_username, autor_external_id, texto, estado, motivo)
values ('f0000000-0000-0000-0000-000000000001', 'C_TARDE', 'pedro', 'U_PEDRO',
        'automatiza', 'manual_pendiente', 'ventana_vencida');

select qa_afirmar(
  (select count(*) from comments where estado = 'manual_pendiente') = 1,
  'paso 11 · el comentario fuera de la ventana pasa a la bandeja con su motivo');

-- Paso 12 · El clic al enlace queda contado
update tracked_links set clics = clics + 1 where piece_id = 'e0000000-0000-0000-0000-000000000001';

-- Paso 13 · La copia del video cumplió
update pieces set storage_expira_at = now() - interval '1 hour'
 where id = 'e0000000-0000-0000-0000-000000000001';

select qa_afirmar(
  (select count(*) from pieces where storage_path is not null and storage_expira_at < now()) = 1,
  'paso 13 · la copia del video queda lista para borrarse');

-- Paso 14 · Lo que la pantalla de resultados muestra
select qa_afirmar(
  (select count(*) from comments where keyword_id is not null) = 1
    and (select count(*) from comments where estado = 'respondido') = 1
    and (select clics from tracked_links where piece_id = 'e0000000-0000-0000-0000-000000000001') = 1,
  'paso 14 · la pieza cierra con un detectado, un mensaje enviado y un clic');

-- Paso 15 · La misma palabra queda libre cuando su vigencia termina
update keywords set activa_hasta = now() - interval '1 minute'
 where piece_id = 'e0000000-0000-0000-0000-000000000001';

insert into pieces (id, brand_id, semana, tema, origen, sheet_row_id)
values ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
        '2026-09-14', 'Otra pieza', 'sheet', 'fila-3');

insert into keywords (piece_id, palabra)
values ('e0000000-0000-0000-0000-000000000002', 'AUTOMATIZA');

select qa_afirmar(
  (select count(*) from keywords where palabra = 'AUTOMATIZA') = 2,
  'paso 15 · la palabra vuelve a estar libre para la semana siguiente');

-- ---------------------------------------------------------------------------
-- El caso especial que faltaba: el mensaje que falla por límites
-- ---------------------------------------------------------------------------

insert into comments (id, publication_id, external_comment_id, autor_username, autor_external_id,
                      texto, estado, intentos_dm, proximo_intento_at)
values ('c1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
        'C_LIMITE', 'sofia', 'U_SOFIA', 'automatiza', 'fallido', 1, now() - interval '5 minutes');

insert into dm_log (comment_id, destinatario, mensaje, estado, error)
values ('c1000000-0000-0000-0000-000000000001', 'sofia', 'primer intento', 'fallido',
        'límite de la plataforma');

select qa_afirmar(
  (select count(*) from comments
    where estado = 'fallido' and proximo_intento_at <= now()) = 1,
  'el mensaje fallido queda en cola, esperando su turno');

-- Segundo intento, otra vez con límite
update comments set intentos_dm = 2, proximo_intento_at = now() - interval '1 minute'
 where id = 'c1000000-0000-0000-0000-000000000001';

insert into dm_log (comment_id, destinatario, mensaje, estado, error)
values ('c1000000-0000-0000-0000-000000000001', 'sofia', 'segundo intento', 'fallido',
        'límite de la plataforma');

select qa_afirmar(
  (select count(*) from dm_log where comment_id = 'c1000000-0000-0000-0000-000000000001') = 2,
  'cada intento queda escrito en la bitácora, con su error');

-- Tercer intento agotado: a la bandeja
update comments set intentos_dm = 3, proximo_intento_at = null,
                    estado = 'manual_pendiente', motivo = 'límite de la plataforma'
 where id = 'c1000000-0000-0000-0000-000000000001';

select qa_afirmar(
  (select estado from comments where id = 'c1000000-0000-0000-0000-000000000001') = 'manual_pendiente',
  'agotados los intentos, el caso pasa a la bandeja manual');

select qa_afirmar(
  (select count(*) from comments where estado = 'manual_pendiente') = 2,
  'la bandeja reúne el caso vencido y el que agotó sus intentos');

-- Y si el tercer intento sí sale, el mensaje se entrega una sola vez
insert into comments (id, publication_id, external_comment_id, autor_username, autor_external_id,
                      texto, estado, intentos_dm)
values ('c1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
        'C_SEGUNDA', 'mario', 'U_MARIO', 'automatiza', 'respondido', 2);

insert into dm_log (comment_id, destinatario, mensaje, estado, error)
values ('c1000000-0000-0000-0000-000000000002', 'mario', 'intento 1', 'fallido', 'límite'),
       ('c1000000-0000-0000-0000-000000000002', 'mario', 'intento 2', 'enviado', null);

select qa_debe_fallar(
  $$insert into dm_log (comment_id, mensaje, estado)
    values ('c1000000-0000-0000-0000-000000000002', 'tercero', 'enviado')$$,
  'el reintento que sale bien no admite un segundo mensaje entregado', 'dm_log_un_envio_bueno');

\echo ''
\echo '=== Recorrido completo y reintento: verificados ==='
