-- Puerta QA de la Entrega 3. Matriz de los cuatro roles contra las tablas.
-- Cada caso entra con la sesión de una persona real y comprueba lo que puede
-- y lo que le queda vedado.

\set ON_ERROR_STOP on
\set QUIET on

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function qa_como(usuario uuid)
returns void language plpgsql as $$
begin
  -- is_local en false: psql abre una transacción por sentencia, así que el
  -- valor tiene que sobrevivir a la sesión entera.
  perform set_config('request.jwt.claim.sub', usuario::text, false);
end;
$$;

-- Corre la sentencia con el rol authenticated y devuelve si la dejó pasar.
/**
 * Corre la sentencia con el rol authenticated y dice si la dejó pasar.
 *
 * RLS deniega un UPDATE o un DELETE en silencio: la fila queda fuera del
 * alcance de la política, se tocan cero filas y no hay excepción. Medir solo la
 * excepción daría por permitido lo que en realidad fue denegado, así que aquí
 * se cuentan las filas afectadas. La app hace lo mismo: una escritura que
 * devuelve cero filas se trata como permiso denegado.
 */
create or replace function qa_intento(sentencia text)
returns text language plpgsql as $$
declare
  tocadas int;
begin
  execute sentencia;
  get diagnostics tocadas = row_count;
  if tocadas = 0 and (sentencia ilike 'update%' or sentencia ilike 'delete%') then
    return 'denegado';
  end if;
  return 'permitido';
exception
  when insufficient_privilege then return 'denegado';
  when others then
    if sqlerrm like '%row-level security%' or sqlerrm like '%violates row-level%' then
      return 'denegado';
    end if;
    return 'error: ' || left(sqlerrm, 70);
end;
$$;

create or replace function qa_espera(sentencia text, esperado text, etiqueta text)
returns void language plpgsql as $$
declare
  obtenido text;
begin
  obtenido := qa_intento(sentencia);
  if obtenido = esperado then
    raise notice 'PASA · %', etiqueta;
  else
    raise exception 'FALLA · % (esperaba %, obtuvo %)', etiqueta, esperado, obtenido;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Observador: lee todo, escribe nada
-- ---------------------------------------------------------------------------

set role authenticated;
select qa_como('44444444-4444-4444-4444-444444444444');

select qa_afirmar((select count(*) from pieces) > 0, 'el observador lee la parrilla');
select qa_afirmar((select count(*) from comments) > 0, 'el observador lee los comentarios');
select qa_afirmar((select count(*) from dm_log) > 0, 'el observador lee la bitácora de envíos');

select qa_espera(
  $$insert into pieces (brand_id, semana, tema) values ('aaaaaaaa-0000-0000-0000-000000000001','2026-09-14','Intento observador')$$,
  'denegado', 'el observador falla al crear una pieza');

select qa_espera(
  $$update pieces set tema = 'cambiado' where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  'denegado', 'el observador falla al editar una pieza');

select qa_espera(
  $$insert into approvals (piece_id, usuario_id, accion) values ('dddddddd-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444','aprobar')$$,
  'denegado', 'el observador falla al aprobar');

-- ---------------------------------------------------------------------------
-- Audiovisual: carga contenido, llega hasta revisión
-- ---------------------------------------------------------------------------

select qa_como('33333333-3333-3333-3333-333333333333');

select qa_espera(
  $$insert into pieces (id, brand_id, semana, tema, estado) values ('dddddddd-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000001','2026-09-14','Pieza de audiovisual','borrador')$$,
  'permitido', 'audiovisual crea una pieza');

select qa_espera(
  $$update pieces set drive_url = 'https://drive.google.com/x', estado = 'revision' where id = 'dddddddd-0000-0000-0000-000000000009'$$,
  'permitido', 'audiovisual carga el video y la manda a revisión');

select qa_afirmar(
  qa_intento($$update pieces set estado = 'aprobado' where id = 'dddddddd-0000-0000-0000-000000000009'$$)
    like 'error:%hasta revisión%',
  'audiovisual queda fuera de la aprobación');

select qa_espera(
  $$insert into keywords (piece_id, palabra) values ('dddddddd-0000-0000-0000-000000000009','PRUEBAAV')$$,
  'denegado', 'audiovisual falla al definir la palabra clave');

select qa_espera(
  $$update social_accounts set credential_ref = 'robado' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'denegado', 'audiovisual falla al tocar las credenciales');

-- ---------------------------------------------------------------------------
-- Aprobadora: revisa, aprueba, devuelve
-- ---------------------------------------------------------------------------

select qa_como('22222222-2222-2222-2222-222222222222');

select qa_espera(
  $$insert into approvals (piece_id, usuario_id, accion, comentario) values ('dddddddd-0000-0000-0000-000000000009','22222222-2222-2222-2222-222222222222','devolver','Falta el hook')$$,
  'permitido', 'la aprobadora devuelve con comentario');

select qa_espera(
  $$insert into approvals (piece_id, usuario_id, accion) values ('dddddddd-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','aprobar')$$,
  'denegado', 'la aprobadora falla al firmar en nombre de otra persona');

select qa_espera(
  $$insert into keywords (piece_id, palabra) values ('dddddddd-0000-0000-0000-000000000009','PRUEBAKAREN')$$,
  'denegado', 'la aprobadora falla al definir la palabra clave');

select qa_espera(
  $$delete from pieces where id = 'dddddddd-0000-0000-0000-000000000009'$$,
  'denegado', 'la aprobadora falla al borrar una pieza');

-- ---------------------------------------------------------------------------
-- Editora: ve todo y manda
-- ---------------------------------------------------------------------------

select qa_como('11111111-1111-1111-1111-111111111111');

select qa_espera(
  $$insert into keywords (piece_id, palabra) values ('dddddddd-0000-0000-0000-000000000009','PRUEBAJESS')$$,
  'permitido', 'la editora define la palabra clave');

select qa_espera(
  $$insert into dm_templates (piece_id, mensaje, destino_url) values ('dddddddd-0000-0000-0000-000000000009','Ahí va','https://bio.saleads.co/r/x9')$$,
  'permitido', 'la editora escribe el mensaje directo');

select qa_espera(
  $$update social_accounts set activa = false where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'permitido', 'la editora administra las cuentas');

select qa_espera(
  $$insert into approvals (piece_id, usuario_id, accion) values ('dddddddd-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','aprobar')$$,
  'permitido', 'la editora aprueba');

select qa_espera(
  $$update comments set estado = 'ignorado' where external_comment_id = 'C2'$$,
  'permitido', 'la editora atiende la bandeja de comentarios');

-- ---------------------------------------------------------------------------
-- Nadie escala su propio rol
-- ---------------------------------------------------------------------------

select qa_como('44444444-4444-4444-4444-444444444444');
select qa_espera(
  $$update profiles set rol = 'editora' where id = '44444444-4444-4444-4444-444444444444'$$,
  'denegado', 'el observador falla al ascenderse solo');

-- ---------------------------------------------------------------------------
-- Sin sesión no hay nada
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', false);
select qa_afirmar((select count(*) from pieces) = 0, 'sin sesión la parrilla queda vacía');
select qa_afirmar((select count(*) from comments) = 0, 'sin sesión los comentarios quedan fuera de alcance');

reset role;
\echo ''
\echo '=== Matriz de roles: verificada ==='
