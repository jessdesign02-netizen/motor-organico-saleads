-- Entrega 13 · El caso especial que faltaba de la sección 7:
-- "El mensaje directo falla por límites de la plataforma → queda en cola con
--  reintento y pasa a bandeja manual tras agotar intentos."
--
-- Hasta ahora el mensaje fallido se quedaba quieto. Un límite de tasa se
-- resuelve solo en minutos, así que dejar de intentar perdía leads que estaban
-- a una espera de distancia.

alter table comments
  add column intentos_dm      int not null default 0,
  add column proximo_intento_at timestamptz;

comment on column comments.intentos_dm is
  'Cuántas veces se intentó el mensaje. A los tres, el caso pasa a la bandeja manual.';

create index comments_reintento_idx on comments (estado, proximo_intento_at)
  where estado = 'fallido';

-- La bitácora deja de exigir un solo registro por comentario: cada intento
-- queda escrito con su resultado, que es lo que pide la trazabilidad. La
-- garantía de un solo mensaje entregado la sostiene el estado del comentario y
-- el índice de un autor por publicación, no esta restricción.
alter table dm_log drop constraint dm_log_comment_id_key;
create index dm_log_comment_idx on dm_log (comment_id, enviado_at desc);

-- Un solo envío con resultado "enviado" por comentario. Reintentar un fallo sí,
-- entregar dos mensajes no.
create unique index dm_log_un_envio_bueno
  on dm_log (comment_id)
  where estado = 'enviado';
