-- Entrega 11 · Dos defectos de integración, corregidos donde no se pueden
-- volver a escapar: en la base.

-- ---------------------------------------------------------------------------
-- 1. La semana se deriva de la fecha, siempre
--
-- La parrilla busca por `semana`. Cambiar la fecha desde el editor sin tocar
-- ese campo dejaba la pieza fuera de su semana: seguía existiendo y nadie la
-- veía. Derivarla en un trigger cierra todos los caminos a la vez, incluidos
-- los que se escriban después.
-- ---------------------------------------------------------------------------

create or replace function derivar_semana()
returns trigger
language plpgsql
as $$
begin
  if new.fecha_publicacion is not null then
    -- date_trunc('week') en Postgres devuelve el lunes.
    new.semana := date_trunc('week', new.fecha_publicacion)::date;
  end if;
  return new;
end;
$$;

create trigger pieces_derivar_semana
  before insert or update on pieces
  for each row execute function derivar_semana();

-- Repara lo que ya estuviera desincronizado.
update pieces
   set semana = date_trunc('week', fecha_publicacion)::date
 where fecha_publicacion is not null
   and semana <> date_trunc('week', fecha_publicacion)::date;

-- ---------------------------------------------------------------------------
-- 2. El video que se publica
--
-- Meta y TikTok descargan el video desde una URL pública. Un enlace de Drive
-- pide sesión y devuelve una página, así que publicar desde `drive_url` habría
-- fallado siempre. El video se copia a Storage antes de la hora de salida, y la
-- copia se borra cuando ya cumplió.
-- ---------------------------------------------------------------------------

alter table pieces
  add column storage_expira_at timestamptz,
  add column video_bytes bigint,
  add column video_error text;

comment on column pieces.storage_path is
  'Ruta de la copia pública en Storage. Es lo que la plataforma descarga.';
comment on column pieces.storage_expira_at is
  'Cuándo se puede borrar la copia. Se fija 24 horas después de publicar.';

create index pieces_copias_vencidas_idx on pieces (storage_expira_at)
  where storage_path is not null;
