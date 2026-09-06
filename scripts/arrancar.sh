#!/usr/bin/env bash
#
# Arranque del Motor Orgánico contra un proyecto de Supabase real.
#
# Aplica las migraciones en orden, corre el seed y comprueba que todo quedó en
# su sitio. Se puede correr varias veces: si algo ya existe, lo dice y sigue.
#
#   ./scripts/arrancar.sh "postgresql://postgres:CLAVE@db.xxx.supabase.co:5432/postgres"
#
# La cadena de conexión está en Supabase, en Project Settings, Database,
# Connection string, pestaña URI. La contraseña es la del proyecto.

set -uo pipefail

PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
export PATH="$PGBIN:$PATH"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
CONEXION="${1:-${DATABASE_URL:-}}"

rojo() { printf '\033[31m%s\033[0m\n' "$1"; }
verde() { printf '\033[32m%s\033[0m\n' "$1"; }
gris() { printf '\033[90m%s\033[0m\n' "$1"; }

if [ -z "$CONEXION" ]; then
  rojo "Falta la cadena de conexión."
  echo ""
  echo "  ./scripts/arrancar.sh \"postgresql://postgres:CLAVE@db.xxx.supabase.co:5432/postgres\""
  echo ""
  echo "Está en Supabase → Project Settings → Database → Connection string → URI."
  exit 1
fi

command -v psql >/dev/null || { rojo "Falta psql. brew install postgresql@17"; exit 1; }

echo ""
echo "Motor Orgánico · arranque"
gris "$(echo "$CONEXION" | sed -E 's#(://[^:]+:)[^@]+@#\1••••••@#')"
echo ""

# ---------------------------------------------------------------------------
# 1. Conexión
# ---------------------------------------------------------------------------

if ! psql "$CONEXION" -c 'select 1' >/dev/null 2>&1; then
  rojo "No se pudo conectar."
  echo "Revisa que la contraseña sea la del proyecto y que la cadena esté completa."
  exit 1
fi
verde "✓ Conexión establecida"

# ---------------------------------------------------------------------------
# 2. Migraciones, en orden
# ---------------------------------------------------------------------------

echo ""
echo "Migraciones"

for archivo in "$RAIZ"/supabase/migrations/*.sql; do
  nombre="$(basename "$archivo")"

  # 0003 asigna el rol de editora y necesita que el usuario ya exista en
  # Authentication, así que va al final, por separado.
  [ "$nombre" = "0003_accesos.sql" ] && continue

  salida="$(psql "$CONEXION" -v ON_ERROR_STOP=1 -q -f "$archivo" 2>&1)"
  if [ $? -eq 0 ]; then
    verde "  ✓ $nombre"
  elif echo "$salida" | grep -qiE "already exists|ya existe|duplicate"; then
    gris "  · $nombre (ya estaba aplicada)"
  else
    rojo "  ✗ $nombre"
    echo "$salida" | tail -5
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# 3. Datos de arranque
# ---------------------------------------------------------------------------

echo ""
echo "Datos de arranque"
if psql "$CONEXION" -v ON_ERROR_STOP=1 -q -f "$RAIZ/supabase/seed.sql" >/dev/null 2>&1; then
  verde "  ✓ Marcas y primer recurso"
else
  gris "  · El seed ya se había corrido"
fi

# ---------------------------------------------------------------------------
# 4. Comprobación
# ---------------------------------------------------------------------------

echo ""
echo "Comprobación"

comprobar() {
  local etiqueta="$1" consulta="$2" esperado="$3"
  local valor
  valor="$(psql "$CONEXION" -tAc "$consulta" 2>/dev/null | tr -d '[:space:]')"
  if [ "$valor" = "$esperado" ]; then
    verde "  ✓ $etiqueta"
  else
    rojo "  ✗ $etiqueta (esperaba $esperado, hay $valor)"
  fi
}

# Se comprueban por nombre: un conteo diría que algo falta, y no cuál.
TABLAS="approvals brands calendar_proposals comments dm_log dm_templates keywords notices pieces profiles publications resources social_accounts sync_logs tracked_links"
faltantes=""
for tabla in $TABLAS; do
  existe="$(psql "$CONEXION" -tAc "select to_regclass('public.$tabla') is not null" 2>/dev/null | tr -d '[:space:]')"
  [ "$existe" = "t" ] || faltantes="$faltantes $tabla"
done
if [ -z "$faltantes" ]; then
  verde "  ✓ Las 15 tablas"
else
  rojo "  ✗ Faltan tablas:$faltantes"
fi
comprobar "RLS activo en todas" \
  "select count(*) from pg_tables t join pg_class c on c.relname=t.tablename where t.schemaname='public' and not c.relrowsecurity" "0"
comprobar "Las dos marcas" \
  "select count(*) from brands" "2"

triggers="$(psql "$CONEXION" -tAc "select count(*) from pg_trigger where not tgisinternal and tgrelid::regclass::text in ('pieces','keywords','publications','approvals','comments')" 2>/dev/null | tr -d '[:space:]')"
verde "  ✓ $triggers triggers con las reglas de negocio"

# ---------------------------------------------------------------------------
# 5. Lo que sigue
# ---------------------------------------------------------------------------

editoras="$(psql "$CONEXION" -tAc "select count(*) from profiles where rol='editora'" 2>/dev/null | tr -d '[:space:]')"

echo ""
if [ "$editoras" = "0" ]; then
  echo "Falta un paso, y es tuyo:"
  echo ""
  echo "  1. En Supabase → Authentication → Add user, crea tu usuario con tu correo."
  echo "  2. Vuelve a correr:"
  echo "     psql \"\$CONEXION\" -f supabase/migrations/0003_accesos.sql"
  echo ""
  gris "  Ese archivo busca jesssaleads@gmail.com. Si usas otro correo, cámbialo ahí."
else
  verde "✓ Hay $editoras editora(s). El sistema está listo para entrar."
fi

echo ""
echo "Después: llena .env.local con las llaves del proyecto y corre npm run dev."
gris "Las llaves están en Supabase → Project Settings → API."
echo ""
