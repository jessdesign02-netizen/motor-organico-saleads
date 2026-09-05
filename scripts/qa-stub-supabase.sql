-- Arnés local de QA. Reproduce lo mínimo de Supabase que el esquema necesita
-- para poder correr las migraciones y probar RLS fuera de la nube.
-- Producción usa el auth real de Supabase: este archivo nunca se corre allí.

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

grant usage on schema public, auth to anon, authenticated, service_role;

-- Permisos de tabla equivalentes a los que Supabase concede por defecto.
-- RLS decide encima de esto; sin los grants, la prueba mediría lo que no es.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
