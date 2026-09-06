-- Bucket de videos. Público de lectura, porque la plataforma descarga el
-- archivo sin credenciales nuestras, y cerrado a escritura salvo por el
-- servicio, que es quien copia desde Drive.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 1073741824, array['video/mp4', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura abierta: es lo que permite a Meta descargar el video.
create policy "videos lectura publica"
  on storage.objects for select
  using (bucket_id = 'videos');

-- La escritura queda para la llave de servicio, que ignora RLS. Ninguna sesión
-- de persona sube archivos aquí.
