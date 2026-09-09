-- Motor Orgánico SaleADS · Conversaciones por mensaje directo
--
-- El motor de comentarios responde una vez y cierra: comentario, mensaje,
-- enlace. Esto es lo que sigue después, la conversación por mensaje directo que
-- hoy atiende el agente y no se ve en ninguna pantalla.
--
-- Un hilo no cuelga de una publicación, a diferencia de `comments`: la
-- conversación es con la marca, no con la pieza. Por eso son tablas aparte y no
-- una columna más en las que ya existen.

create type autor_mensaje as enum ('persona', 'agente', 'humano');

create table dm_threads (
  id                   uuid primary key default gen_random_uuid(),
  social_account_id    uuid references social_accounts(id) on delete set null,
  -- El IGSID de la persona. Meta lo genera por par app+cuenta receptora, así que
  -- la misma persona escribiéndole a dos cuentas trae dos identificadores
  -- distintos: identifica el hilo por sí solo, sin necesidad de la cuenta.
  contacto_external_id text not null unique,
  contacto_username    text,
  -- Mientras esta fecha esté en el futuro, el agente no contesta este hilo.
  -- Vacío significa que el agente atiende.
  agente_pausado_hasta timestamptz,
  ultimo_at            timestamptz not null default now(),
  creado_at            timestamptz not null default now()
);

create table dm_messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references dm_threads(id) on delete cascade,
  autor               autor_mensaje not null,
  texto               text not null,
  -- El identificador que devuelve Instagram. Meta reintenta la entrega de un
  -- webhook cuando la respuesta tarda, y el agente puede avisar dos veces del
  -- mismo mensaje: sin esto, la conversación se llena de repetidos.
  external_message_id text,
  error               text,
  enviado_at          timestamptz not null default now(),
  creado_at           timestamptz not null default now()
);

-- Un mensaje de la plataforma se guarda una sola vez. Los que no traen
-- identificador —lo que escribe el equipo desde la app— quedan fuera de la
-- regla, que es lo que el índice parcial permite.
create unique index dm_messages_externo on dm_messages (external_message_id)
  where external_message_id is not null;

create index dm_messages_hilo   on dm_messages (thread_id, enviado_at);
create index dm_threads_ultimo  on dm_threads (ultimo_at desc);

-- El orden de la bandeja lo decide el último mensaje. Guardarlo en el hilo
-- evita recorrer todos los mensajes para ordenar la lista, y el trigger lo
-- sostiene aunque alguien escriba por fuera de la app.
create or replace function tocar_hilo_dm()
returns trigger
language plpgsql
as $$
begin
  update dm_threads
     set ultimo_at = greatest(ultimo_at, new.enviado_at)
   where id = new.thread_id;
  return new;
end;
$$;

create trigger dm_messages_toca_hilo
  after insert on dm_messages
  for each row execute function tocar_hilo_dm();

-- RLS ------------------------------------------------------------------------
-- Los cuatro roles leen. Escribe el agente, que entra por el cliente de
-- servicio y no pasa por estas políticas.

alter table dm_threads  enable row level security;
alter table dm_messages enable row level security;

create policy hilos_lee on dm_threads for select using (puede_leer());
-- Pausar y reactivar el agente es una decisión de operación, no de contenido.
create policy hilos_pausa on dm_threads for update
  using (puede_leer()) with check (puede_leer());

create policy mensajes_dm_lee on dm_messages for select using (puede_leer());
