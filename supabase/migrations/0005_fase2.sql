-- Fase 2 · Publicación en TikTok y YouTube por API, y avisos internos.

-- TikTok entrega borradores al buzón mientras la app carece de auditoría. El
-- día que pase, esta casilla habilita la publicación directa por cuenta, sin
-- tocar código.
alter table social_accounts
  add column publicacion_directa boolean not null default false;

comment on column social_accounts.publicacion_directa is
  'TikTok: publicación directa a audiencia pública. Se activa cuando la auditoría de Content Posting pasa.';

-- Cupo diario de respuestas por cuenta, para las redes donde la cuota manda.
alter table social_accounts
  add column cupo_respuestas_dia int;

comment on column social_accounts.cupo_respuestas_dia is
  'YouTube: comments.insert cuesta 50 unidades sobre 10.000 diarias. Vacío usa el valor por defecto del adaptador.';

-- ---------------------------------------------------------------------------
-- Avisos internos
-- ---------------------------------------------------------------------------

create type tipo_aviso as enum (
  'publicacion_fallida',
  'borrador_tiktok',
  'token_por_vencer',
  'bandeja_con_espera',
  'cupo_agotado'
);

create table notices (
  id          uuid primary key default gen_random_uuid(),
  tipo        tipo_aviso not null,
  titulo      text not null,
  detalle     text,
  brand_id    uuid references brands(id) on delete cascade,
  piece_id    uuid references pieces(id) on delete cascade,
  -- Un aviso por asunto: la clave evita que cada corrida del cron repita el mismo.
  clave       text not null unique,
  leido_at    timestamptz,
  creado_at   timestamptz not null default now()
);

create index notices_pendientes_idx on notices (leido_at, creado_at desc);

alter table notices enable row level security;

create policy avisos_lee on notices for select using (puede_leer());
create policy avisos_marca on notices for update
  using (puede_leer()) with check (puede_leer());
