-- Entrada por invitación, sostenida en la base.
--
-- Hasta ahora "se entra por invitación" era cierto solo porque nadie podía
-- crear una cuenta: había que darla de alta a mano en Authentication. Al
-- encender Google como proveedor eso deja de ser verdad. Cualquiera con una
-- cuenta de Gmail entraría, `alta_de_usuario` le crearía su perfil con el rol
-- por defecto, y `puede_leer()` es cierto para los cuatro roles: leería la
-- parrilla entera, los contactos y las conversaciones.
--
-- La lista de invitados es lo que vuelve a hacer verdadera la regla. Vive en la
-- base y no en la app, porque la comprueba el mismo trigger que crea el perfil:
-- no hay camino que la esquive, venga el alta por Google, por correo y clave, o
-- por el API de administración.

create table invitaciones (
  email        text primary key,
  rol          rol_app not null default 'observador',
  invitada_por uuid references auth.users(id) on delete set null,
  creada_at    timestamptz not null default now(),
  -- Cuándo la persona entró por primera vez. Vacío significa que aún no llegó.
  usada_at     timestamptz
);

alter table invitaciones enable row level security;

create policy invitaciones_lee on invitaciones for select using (puede_leer());
create policy invitaciones_editora on invitaciones for all
  using (es_editora()) with check (es_editora());

-- ---------------------------------------------------------------------------
-- El alta de usuario pasa por la lista
-- ---------------------------------------------------------------------------

/**
 * Reemplaza a la versión de 0001, que aceptaba a cualquiera.
 *
 * El correo se compara en minúsculas: Google puede devolverlo con mayúsculas
 * y la invitación se escribió a mano.
 *
 * Al no encontrar invitación revienta, y eso deshace el alta entera en
 * `auth.users`. Es lo que se busca: la cuenta no llega a existir, en lugar de
 * quedar creada y sin permisos.
 */
create or replace function alta_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invitada invitaciones%rowtype;
begin
  select * into invitada from invitaciones where email = lower(new.email);

  if not found then
    raise exception 'correo_no_invitado'
      using hint = 'Pídele a una editora que te invite desde Configuración';
  end if;

  insert into profiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',   -- lo que manda Google
      new.raw_user_meta_data ->> 'name',
      new.email
    ),
    invitada.rol
  )
  on conflict (id) do nothing;

  update invitaciones set usada_at = now() where email = invitada.email;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quien ya entró estaba invitado, aunque la lista no existiera todavía
-- ---------------------------------------------------------------------------

insert into invitaciones (email, rol, usada_at)
select lower(email), rol, creado_at from profiles where email is not null
on conflict (email) do nothing;

comment on table invitaciones is
  'Quién puede entrar. Sin fila aquí, el alta de usuario falla, venga por Google, por clave o por el API de administración.';
