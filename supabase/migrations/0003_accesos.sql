-- Se corre una sola vez, después de crear el primer usuario en Authentication.
-- Deja a esa persona como editora, y desde la app invita al resto.

update profiles
   set rol = 'editora'
 where email = 'jesssaleads@gmail.com';

-- Comprobación: si no encontró a nadie, avisa en lugar de quedarse callado.
do $$
begin
  if not exists (select 1 from profiles where rol = 'editora') then
    raise notice 'Ningún perfil quedó como editora. Crea el usuario en Authentication y vuelve a correr este archivo.';
  end if;
end;
$$;
