-- Entrega 8 · Caption diferenciado por red.
--
-- El caption base sirve de punto de partida, y cada red recibe el suyo cuando
-- hace falta: Instagram admite más texto que un Short, y TikTok pide otro tono.
-- Al programar, el caption de la red viaja a publications.caption_final.

alter table pieces
  add column captions_red jsonb not null default '{}'::jsonb;

comment on column pieces.captions_red is
  'Caption por red: {"instagram": "...", "tiktok": "...", "youtube": "..."}. Lo que falte hereda de caption_base.';

-- Las piezas devueltas guardan la propuesta de calendario hasta que alguien la
-- confirma. Así el recorrido de fechas queda a un clic y nunca se aplica solo.
create table calendar_proposals (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references brands(id) on delete cascade,
  semana     date not null,
  propuesta  jsonb not null,
  motivo     text,
  creada_por uuid references auth.users(id) on delete set null,
  creada_at  timestamptz not null default now(),
  aplicada_at timestamptz,
  -- Una propuesta viva por marca y semana: la nueva reemplaza a la anterior.
  unique (brand_id, semana)
);

alter table calendar_proposals enable row level security;

create policy propuestas_lee on calendar_proposals for select using (puede_leer());
create policy propuestas_escribe on calendar_proposals for all
  using (puede_aprobar()) with check (puede_aprobar());
