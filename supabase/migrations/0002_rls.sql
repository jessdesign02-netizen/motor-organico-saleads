-- Políticas RLS por rol. Sección 3 de la especificación.
-- Toda tabla queda con RLS habilitado. La lectura alcanza a los cuatro roles.
-- La escritura se reparte según lo que hace cada quien.

alter table profiles        enable row level security;
alter table brands          enable row level security;
alter table social_accounts enable row level security;
alter table resources       enable row level security;
alter table pieces          enable row level security;
alter table keywords        enable row level security;
alter table dm_templates    enable row level security;
alter table tracked_links   enable row level security;
alter table publications    enable row level security;
alter table comments        enable row level security;
alter table dm_log          enable row level security;
alter table approvals       enable row level security;
alter table sync_logs       enable row level security;

-- profiles -------------------------------------------------------------------
create policy profiles_lee on profiles
  for select using (puede_leer());
create policy profiles_propio on profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and rol = rol_actual());
create policy profiles_editora on profiles
  for all using (es_editora()) with check (es_editora());

-- brands ---------------------------------------------------------------------
create policy brands_lee on brands for select using (puede_leer());
create policy brands_editora on brands for all using (es_editora()) with check (es_editora());

-- social_accounts ------------------------------------------------------------
-- La referencia al secreto se guarda aquí, así que solo la editora la toca.
create policy cuentas_lee on social_accounts for select using (puede_leer());
create policy cuentas_editora on social_accounts for all using (es_editora()) with check (es_editora());

-- resources ------------------------------------------------------------------
create policy recursos_lee on resources for select using (puede_leer());
create policy recursos_escribe on resources for all
  using (puede_editar_contenido()) with check (puede_editar_contenido());

-- pieces ---------------------------------------------------------------------
create policy piezas_lee on pieces for select using (puede_leer());
create policy piezas_crea on pieces for insert
  with check (puede_editar_contenido());
create policy piezas_edita on pieces for update
  using (puede_editar_contenido() or puede_aprobar())
  with check (puede_editar_contenido() or puede_aprobar());
create policy piezas_borra on pieces for delete using (es_editora());

-- El rol audiovisual mueve la pieza hasta dejarla lista. La aprobación queda
-- fuera de su alcance, y la base lo hace cumplir aunque la app lo intente.
create or replace function guardia_estado_pieza()
returns trigger
language plpgsql
as $$
begin
  if rol_actual() = 'audiovisual'
     and new.estado in ('aprobado', 'programado', 'publicado')
     and old.estado is distinct from new.estado then
    raise exception 'El rol audiovisual llega hasta revisión. La aprobación es de editora o aprobadora';
  end if;
  return new;
end;
$$;

create trigger pieces_guardia_estado
  before update on pieces
  for each row execute function guardia_estado_pieza();

-- keywords, dm_templates, tracked_links --------------------------------------
create policy claves_lee on keywords for select using (puede_leer());
create policy claves_escribe on keywords for all
  using (es_editora()) with check (es_editora());

create policy plantillas_lee on dm_templates for select using (puede_leer());
create policy plantillas_escribe on dm_templates for all
  using (es_editora()) with check (es_editora());

create policy enlaces_lee on tracked_links for select using (puede_leer());
create policy enlaces_escribe on tracked_links for all
  using (es_editora()) with check (es_editora());

-- publications ---------------------------------------------------------------
create policy publicaciones_lee on publications for select using (puede_leer());
create policy publicaciones_escribe on publications for all
  using (es_editora()) with check (es_editora());

-- comments y dm_log ----------------------------------------------------------
-- Los escribe el motor con la llave de servicio. Desde la sesión se leen, y la
-- editora marca a mano lo que atendió en la bandeja.
create policy comentarios_lee on comments for select using (puede_leer());
create policy comentarios_edita on comments for update
  using (es_editora()) with check (es_editora());

create policy bitacora_lee on dm_log for select using (puede_leer());

-- approvals ------------------------------------------------------------------
create policy aprobaciones_lee on approvals for select using (puede_leer());
create policy aprobaciones_crea on approvals for insert
  with check (puede_aprobar() and usuario_id = auth.uid());

-- sync_logs ------------------------------------------------------------------
create policy sincronizacion_lee on sync_logs for select using (puede_leer());
