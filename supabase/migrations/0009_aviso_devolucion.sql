-- Va aparte de 0008 porque Postgres exige que el valor nuevo de un enum quede
-- confirmado antes de poder usarlo.

/**
 * El aviso lo genera el sistema, no la persona que devuelve. Sin `security
 * definer`, el insert en notices se topa con la política de esa tabla y la
 * devolución entera falla: nadie podría devolver una pieza.
 */
create or replace function avisar_devolucion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asunto text;
  marca uuid;
begin
  if new.accion <> 'devolver' then
    return new;
  end if;

  select tema, brand_id into asunto, marca from pieces where id = new.piece_id;

  insert into notices (tipo, clave, titulo, detalle, brand_id, piece_id)
  values (
    'pieza_devuelta',
    'devuelta:' || new.id::text,
    'Volvió a revisión: ' || coalesce(asunto, 'una pieza'),
    coalesce(new.comentario, 'Sin comentario'),
    marca,
    new.piece_id
  )
  on conflict (clave) do nothing;

  return new;
end;
$$;

create trigger approvals_avisar_devolucion
  after insert on approvals
  for each row execute function avisar_devolucion();
