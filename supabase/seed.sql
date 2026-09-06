-- Datos de arranque. Se corre una vez, después de las migraciones, y deja el
-- sistema listo para recorrerlo sin esperar a la primera sincronización.
-- Los ids de cuenta y las referencias de credencial se ajustan en Ajustes.

insert into brands (nombre, slug, sheet_tab, whatsapp_url, mapa_columnas)
values
  ('SaleADS', 'saleads', 'Hoja 1', 'https://wa.me/573000000000',
   '{"tema":"pieza","hook":"hook","formato":"formato_base","drive_url":"link_de_drive","responsable":"responsable","fecha_publicacion":"fecha_de_publicacion","recurso":"recursos"}'::jsonb),
  ('Juanads', 'juanads', 'Hoja 1', 'https://wa.me/573000000001',
   '{"tema":"pieza","hook":"hook","formato":"formato_base","drive_url":"link_de_drive","responsable":"responsable","fecha_publicacion":"fecha_de_publicacion","recurso":"recursos"}'::jsonb)
on conflict (slug) do nothing;

-- Un recurso por marca, para que la biblioteca no arranque vacía.
insert into resources (brand_id, titulo, descripcion, tipo, url, seccion)
select id,
       'Guía para empezar',
       'El primer recurso de la biblioteca. Cámbialo por uno real.',
       'pdf',
       'https://bio.saleads.co/recursos',
       'Empieza aquí'
from brands
where not exists (select 1 from resources r where r.brand_id = brands.id);
