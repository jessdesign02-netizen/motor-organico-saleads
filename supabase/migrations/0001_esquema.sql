-- Motor Orgánico SaleADS · Esquema base
-- Sección 4 de docs/ESPECIFICACION.md. Las reglas de negocio que no se negocian
-- viven aquí, en triggers y restricciones, para que se cumplan aunque la app falle.

create extension if not exists unaccent;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type rol_app        as enum ('editora', 'aprobadora', 'audiovisual', 'observador');
create type red_social     as enum ('instagram', 'tiktok', 'youtube');
create type estado_pieza   as enum ('borrador', 'revision', 'aprobado', 'programado', 'publicado', 'fallido');
create type estado_pub     as enum ('pendiente', 'publicando', 'publicado', 'fallido');
create type estado_comentario as enum ('detectado', 'respondido', 'fallido', 'ignorado', 'manual_pendiente');
create type estado_dm      as enum ('enviado', 'fallido');
create type accion_aprobacion as enum ('aprobar', 'devolver');
create type tipo_recurso   as enum ('pdf', 'skill', 'html', 'artefacto', 'video');
create type origen_pieza   as enum ('sheet', 'app');

-- ---------------------------------------------------------------------------
-- Normalización de palabra clave
-- La misma regla que usa el motor de comentarios, escrita una sola vez.
-- Mayúsculas, sin tildes, sin nada que no sea letra o número.
-- ---------------------------------------------------------------------------

create or replace function normalizar_clave(entrada text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(unaccent(coalesce(entrada, '')), '[^a-zA-Z0-9]', '', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Perfiles y roles
-- ---------------------------------------------------------------------------

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text,
  email      text,
  rol        rol_app not null default 'observador',
  creado_at  timestamptz not null default now()
);

create or replace function rol_actual()
returns rol_app
language sql
stable
security definer
set search_path = public
as $$
  select rol from profiles where id = auth.uid();
$$;

create or replace function es_editora()
returns boolean
language sql
stable
as $$ select rol_actual() = 'editora'; $$;

/** Quien puede escribir contenido: editora y audiovisual. */
create or replace function puede_editar_contenido()
returns boolean
language sql
stable
as $$ select rol_actual() in ('editora', 'audiovisual'); $$;

/** Quien puede aprobar o devolver: editora y aprobadora. */
create or replace function puede_aprobar()
returns boolean
language sql
stable
as $$ select rol_actual() in ('editora', 'aprobadora'); $$;

/** Toda persona autenticada con perfil lee. El observador se queda aquí. */
create or replace function puede_leer()
returns boolean
language sql
stable
as $$ select rol_actual() is not null; $$;

create or replace function alta_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nombre', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function alta_de_usuario();

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------

create table brands (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  slug       text not null unique,
  sheet_id   text,
  sheet_tab  text not null default 'Hoja 1',
  mapa_columnas jsonb not null default '{}'::jsonb,
  whatsapp_url  text,
  creado_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- social_accounts
-- ---------------------------------------------------------------------------

create table social_accounts (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references brands(id) on delete cascade,
  red                 red_social not null,
  handle              text not null,
  external_account_id text not null,
  credential_ref      text not null,
  token_expira_at     timestamptz,
  activa              boolean not null default true,
  creado_at           timestamptz not null default now(),
  unique (brand_id, red, external_account_id)
);

-- ---------------------------------------------------------------------------
-- resources · la biblioteca es acumulativa, todo recurso permanece
-- ---------------------------------------------------------------------------

create table resources (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  titulo      text not null,
  descripcion text,
  tipo        tipo_recurso not null default 'pdf',
  url         text not null,
  seccion     text,
  activo      boolean not null default true,
  creado_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pieces
-- ---------------------------------------------------------------------------

create table pieces (
  id                 uuid primary key default gen_random_uuid(),
  brand_id           uuid not null references brands(id) on delete cascade,
  semana             date not null,
  tema               text not null,
  hook               text,
  formato            text,
  drive_url          text,
  storage_path       text,
  caption_base       text,
  resource_id        uuid references resources(id) on delete set null,
  fecha_publicacion  date,
  hora_publicacion   time,
  responsable        text,
  estado             estado_pieza not null default 'borrador',
  aprobada_por       uuid references auth.users(id) on delete set null,
  aprobada_at        timestamptz,
  origen             origen_pieza not null default 'app',
  sheet_row_id       text,
  sheet_hash         text,
  sheet_pendiente    jsonb,
  creado_at          timestamptz not null default now(),
  actualizado_at     timestamptz not null default now(),
  unique (brand_id, sheet_row_id)
);

create index pieces_semana_idx on pieces (brand_id, semana);
create index pieces_agenda_idx on pieces (fecha_publicacion, hora_publicacion);

-- ---------------------------------------------------------------------------
-- keywords
-- ---------------------------------------------------------------------------

create table keywords (
  id            uuid primary key default gen_random_uuid(),
  piece_id      uuid not null references pieces(id) on delete cascade,
  palabra       text not null,
  variantes     text[] not null default '{}',
  activa_desde  timestamptz,
  activa_hasta  timestamptz,
  creado_at     timestamptz not null default now(),
  unique (piece_id)
);

-- Un solo trigger normaliza y valida. Separarlos dejaba la validación a merced
-- del orden alfabético con que Postgres dispara los BEFORE, y la comprobación de
-- unicidad recibía la palabra todavía sin normalizar.
create or replace function preparar_keyword()
returns trigger
language plpgsql
as $$
declare
  marca uuid;
begin
  -- 1. Normalizar
  new.palabra := normalizar_clave(new.palabra);
  if new.palabra = '' then
    raise exception 'La palabra clave queda vacía después de normalizar';
  end if;

  new.variantes := coalesce(
    (select array_agg(distinct normalizar_clave(v))
       from unnest(new.variantes) as v
      where normalizar_clave(v) <> '' and normalizar_clave(v) <> new.palabra),
    '{}'::text[]
  );

  -- 2. Regla 2: única dentro de la marca mientras las vigencias se solapen.
  select brand_id into marca from pieces where id = new.piece_id;

  if exists (
    select 1
    from keywords k
    join pieces p on p.id = k.piece_id
    where p.brand_id = marca
      and k.id <> new.id
      and k.palabra = new.palabra
      and coalesce(k.activa_hasta, 'infinity'::timestamptz) > coalesce(new.activa_desde, now())
      and coalesce(new.activa_hasta, 'infinity'::timestamptz) > coalesce(k.activa_desde, now())
  ) then
    raise exception 'La palabra clave % ya está activa en esta marca', new.palabra
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

create trigger keywords_preparar
  before insert or update on keywords
  for each row execute function preparar_keyword();

-- ---------------------------------------------------------------------------
-- dm_templates y tracked_links
-- ---------------------------------------------------------------------------

create table dm_templates (
  id           uuid primary key default gen_random_uuid(),
  piece_id     uuid not null references pieces(id) on delete cascade unique,
  mensaje      text not null,
  cta_texto    text,
  destino_url  text not null,
  creado_at    timestamptz not null default now()
);

create table tracked_links (
  id          uuid primary key default gen_random_uuid(),
  piece_id    uuid not null references pieces(id) on delete cascade unique,
  slug        text not null unique,
  destino_url text not null,
  clics       int not null default 0,
  creado_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- publications
-- ---------------------------------------------------------------------------

create table publications (
  id                uuid primary key default gen_random_uuid(),
  piece_id          uuid not null references pieces(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  caption_final     text,
  estado            estado_pub not null default 'pendiente',
  external_post_id  text,
  permalink         text,
  publicado_at      timestamptz,
  programado_at     timestamptz,
  intentos          int not null default 0,
  proximo_intento_at timestamptz,
  ultimo_error      text,
  creado_at         timestamptz not null default now(),
  actualizado_at    timestamptz not null default now(),
  -- Una pieza sale una sola vez por cuenta.
  unique (piece_id, social_account_id)
);

create index publications_cola_idx on publications (estado, programado_at);
create unique index publications_post_externo_idx
  on publications (social_account_id, external_post_id)
  where external_post_id is not null;

-- Regla 1: toda pieza programada tiene palabra clave, mensaje y enlace rastreado.
create or replace function pieza_lista_para_programar()
returns trigger
language plpgsql
as $$
declare
  faltan text[] := '{}';
begin
  if new.estado in ('programado', 'publicado') and coalesce(old.estado, 'borrador'::estado_pieza) <> new.estado then
    if new.fecha_publicacion is null then faltan := array_append(faltan, 'fecha de publicación'); end if;
    if new.hora_publicacion is null then faltan := array_append(faltan, 'hora de publicación'); end if;
    if not exists (select 1 from keywords where piece_id = new.id) then faltan := array_append(faltan, 'palabra clave'); end if;
    if not exists (select 1 from dm_templates where piece_id = new.id) then faltan := array_append(faltan, 'mensaje directo'); end if;
    if not exists (select 1 from tracked_links where piece_id = new.id) then faltan := array_append(faltan, 'enlace rastreado'); end if;

    if array_length(faltan, 1) > 0 then
      raise exception 'La pieza queda incompleta para programar. Falta: %', array_to_string(faltan, ', ');
    end if;
  end if;

  -- Regla 7: la aprobación precede a toda publicación.
  if new.estado = 'programado' and old.estado is distinct from 'programado'
     and new.aprobada_por is null then
    raise exception 'La pieza necesita aprobación antes de programarse';
  end if;

  return new;
end;
$$;

create trigger pieces_lista_para_programar
  before update on pieces
  for each row execute function pieza_lista_para_programar();

-- Regla 3: la automatización se activa al confirmarse la publicación en vivo,
-- usando el identificador externo que devuelve la plataforma.
create or replace function activar_escucha_al_publicar()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'publicado' and new.external_post_id is not null
     and (old.estado is distinct from 'publicado') then
    new.publicado_at := coalesce(new.publicado_at, now());

    update keywords
       set activa_desde = coalesce(activa_desde, new.publicado_at)
     where piece_id = new.piece_id;

    update pieces
       set estado = 'publicado'
     where id = new.piece_id
       and estado <> 'publicado';
  end if;
  return new;
end;
$$;

create trigger publications_activar_escucha
  before update on publications
  for each row execute function activar_escucha_al_publicar();

-- ---------------------------------------------------------------------------
-- comments · idempotencia estricta
-- ---------------------------------------------------------------------------

create table comments (
  id                  uuid primary key default gen_random_uuid(),
  publication_id      uuid not null references publications(id) on delete cascade,
  external_comment_id text not null,
  autor_username      text,
  autor_external_id   text,
  texto               text not null,
  keyword_id          uuid references keywords(id) on delete set null,
  estado              estado_comentario not null default 'detectado',
  -- Por qué quedó así. Es lo que la persona lee en la bandeja manual.
  motivo              text,
  detectado_at        timestamptz not null default now(),
  respondido_at       timestamptz,
  -- Regla 5, primera mitad: un comentario recibe una sola respuesta, aunque el
  -- sondeo lo vea dos veces.
  unique (publication_id, external_comment_id)
);

create index comments_pendientes_idx on comments (estado, detectado_at);

-- Regla 5, segunda mitad: un mismo autor recibe una sola respuesta por publicación.
create unique index comments_un_autor_por_publicacion
  on comments (publication_id, autor_external_id)
  where estado = 'respondido' and autor_external_id is not null;

-- ---------------------------------------------------------------------------
-- dm_log · cada envío queda registrado con su resultado
-- ---------------------------------------------------------------------------

create table dm_log (
  id           uuid primary key default gen_random_uuid(),
  comment_id   uuid not null references comments(id) on delete cascade unique,
  destinatario text,
  mensaje      text not null,
  estado       estado_dm not null,
  enviado_at   timestamptz not null default now(),
  error        text
);

-- ---------------------------------------------------------------------------
-- approvals
-- ---------------------------------------------------------------------------

create table approvals (
  id         uuid primary key default gen_random_uuid(),
  piece_id   uuid not null references pieces(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  accion     accion_aprobacion not null,
  comentario text,
  creado_at  timestamptz not null default now()
);

-- Regla 8: la devolución de una pieza la regresa a revisión y libera su fecha.
create or replace function aplicar_aprobacion()
returns trigger
language plpgsql
as $$
begin
  if new.accion = 'aprobar' then
    update pieces
       set estado = 'aprobado',
           aprobada_por = new.usuario_id,
           aprobada_at = now()
     where id = new.piece_id;
  else
    update pieces
       set estado = 'revision',
           aprobada_por = null,
           aprobada_at = null,
           fecha_publicacion = null,
           hora_publicacion = null
     where id = new.piece_id;

    delete from publications
     where piece_id = new.piece_id
       and estado in ('pendiente', 'fallido');
  end if;
  return new;
end;
$$;

create trigger approvals_aplicar
  after insert on approvals
  for each row execute function aplicar_aprobacion();

-- ---------------------------------------------------------------------------
-- sync_logs · el motivo de cada fila ignorada
-- ---------------------------------------------------------------------------

create table sync_logs (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references brands(id) on delete cascade,
  filas_leidas  int not null default 0,
  filas_creadas int not null default 0,
  filas_actualizadas int not null default 0,
  filas_ignoradas    int not null default 0,
  detalle       jsonb not null default '[]'::jsonb,
  corrio_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- actualizado_at
-- ---------------------------------------------------------------------------

create or replace function tocar_actualizado_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_at := now();
  return new;
end;
$$;

create trigger pieces_tocar before update on pieces
  for each row execute function tocar_actualizado_at();
create trigger publications_tocar before update on publications
  for each row execute function tocar_actualizado_at();
