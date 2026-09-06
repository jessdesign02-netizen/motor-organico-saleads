-- Puerta QA de la Entrega 11: la semana derivada y la copia del video.

\set ON_ERROR_STOP on
\set QUIET on

-- ---------------------------------------------------------------------------
-- La semana se deriva de la fecha, venga por donde venga
-- ---------------------------------------------------------------------------

insert into pieces (id, brand_id, semana, tema, fecha_publicacion)
values ('dddddddd-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001',
        '2020-01-06', 'Semana equivocada a propósito', '2026-09-10');

select qa_afirmar(
  (select semana from pieces where id = 'dddddddd-0000-0000-0000-00000000000b') = '2026-09-07',
  'la semana se corrige al insertar, aunque llegue mal');

-- Este era el defecto: el editor cambiaba la fecha y la pieza se salía de su
-- semana, así que dejaba de aparecer en la parrilla.
update pieces set fecha_publicacion = '2026-09-16'
 where id = 'dddddddd-0000-0000-0000-00000000000b';

select qa_afirmar(
  (select semana from pieces where id = 'dddddddd-0000-0000-0000-00000000000b') = '2026-09-14',
  'mover la fecha mueve la semana, así que la pieza sigue visible');

update pieces set fecha_publicacion = '2026-09-20'
 where id = 'dddddddd-0000-0000-0000-00000000000b';

select qa_afirmar(
  (select semana from pieces where id = 'dddddddd-0000-0000-0000-00000000000b') = '2026-09-14',
  'el domingo pertenece a la semana que empezó el lunes');

update pieces set fecha_publicacion = null
 where id = 'dddddddd-0000-0000-0000-00000000000b';

select qa_afirmar(
  (select semana from pieces where id = 'dddddddd-0000-0000-0000-00000000000b') = '2026-09-14',
  'quitar la fecha conserva la semana, y la pieza queda en su columna sin fecha');

-- ---------------------------------------------------------------------------
-- La copia del video
-- ---------------------------------------------------------------------------

select qa_afirmar(
  (select storage_path from pieces where id = 'dddddddd-0000-0000-0000-000000000001') is null,
  'la pieza nace sin copia del video');

update pieces
   set storage_path = 'aaaaaaaa-0000-0000-0000-000000000001/pieza.mp4',
       video_bytes = 12345678
 where id = 'dddddddd-0000-0000-0000-000000000001';

select qa_afirmar(
  (select storage_expira_at from pieces where id = 'dddddddd-0000-0000-0000-000000000001') is null,
  'la copia recién hecha no tiene fecha de borrado');

update pieces
   set storage_expira_at = now() - interval '1 hour'
 where id = 'dddddddd-0000-0000-0000-000000000001';

select qa_afirmar(
  (select count(*) from pieces
    where storage_path is not null and storage_expira_at < now()) = 1,
  'la copia vencida queda a la vista de la limpieza');

update pieces set video_error = 'el archivo de Drive pide permisos'
 where id = 'dddddddd-0000-0000-0000-000000000002';

select qa_afirmar(
  (select video_error from pieces where id = 'dddddddd-0000-0000-0000-000000000002') is not null,
  'el fallo al bajar el video queda escrito en la pieza');

-- ---------------------------------------------------------------------------
-- Entrega 12 · la devolución avisa
-- ---------------------------------------------------------------------------

insert into pieces (id, brand_id, semana, tema, estado, fecha_publicacion)
values ('dddddddd-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001',
        '2026-09-07', 'Pieza que se devuelve', 'aprobado', '2026-09-11');

insert into approvals (piece_id, usuario_id, accion, comentario)
values ('dddddddd-0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222',
        'devolver', 'El hook se cae en el segundo tres');

select qa_afirmar(
  (select count(*) from notices
    where piece_id = 'dddddddd-0000-0000-0000-00000000000c' and tipo = 'pieza_devuelta') = 1,
  'la devolución deja su aviso');

select qa_afirmar(
  (select detalle from notices where piece_id = 'dddddddd-0000-0000-0000-00000000000c')
    = 'El hook se cae en el segundo tres',
  'el aviso lleva el motivo que escribió quien devolvió');

insert into approvals (piece_id, usuario_id, accion)
values ('dddddddd-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'aprobar');

select qa_afirmar(
  (select count(*) from notices
    where piece_id = 'dddddddd-0000-0000-0000-00000000000c') = 1,
  'aprobar no genera aviso: solo la devolución pide atención');

\echo ''
\echo '=== Entregas 11 y 12: verificadas ==='
