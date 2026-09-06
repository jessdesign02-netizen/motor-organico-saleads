-- Entrega 15 · El contenedor de Instagram sobrevive al reintento.
--
-- Publicar en Instagram son dos llamadas: crear el contenedor con el video, y
-- publicarlo. Entre las dos hay un procesado que tarda hasta dos minutos.
--
-- Si el intento se corta ahí, el reintento empezaba de cero: subía el video otra
-- vez y dejaba el contenedor anterior huérfano. Peor: si la publicación llegó a
-- Meta y la respuesta se perdió en el camino, el reintento habría publicado dos
-- veces la misma pieza.
--
-- Guardar el contenedor permite retomar donde quedó.

alter table publications
  add column container_id text;

comment on column publications.container_id is
  'Contenedor de medios de Instagram. El reintento lo retoma en lugar de subir el video otra vez.';
