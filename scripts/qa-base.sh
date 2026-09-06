#!/usr/bin/env bash
# Puerta QA de la base: levanta un Postgres temporal, aplica las migraciones y
# corre las dos baterías. Deja el motor apagado al terminar.
set -euo pipefail

PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
export PATH="$PGBIN:$PATH"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DATOS="${TMPDIR:-/tmp}/motor-qa-pg"
PUERTO=55432

command -v initdb >/dev/null || { echo "Falta Postgres. brew install postgresql@17"; exit 1; }

limpiar() { pg_ctl -D "$DATOS" stop -m fast >/dev/null 2>&1 || true; }
trap limpiar EXIT

rm -rf "$DATOS"
initdb -D "$DATOS" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$DATOS" -o "-p $PUERTO -k /tmp" -l "$DATOS/server.log" start >/dev/null
sleep 2

createdb -h /tmp -p $PUERTO -U postgres motor_qa

for archivo in \
  "$RAIZ/scripts/qa-stub-supabase.sql" \
  "$RAIZ/supabase/migrations/0001_esquema.sql" \
  "$RAIZ/supabase/migrations/0002_rls.sql" \
  "$RAIZ/supabase/migrations/0004_caption_por_red.sql" \
  "$RAIZ/supabase/migrations/0005_fase2.sql"; do
  psql -h /tmp -p $PUERTO -U postgres -v ON_ERROR_STOP=1 -q -d motor_qa -f "$archivo"
done

for bateria in \
  "$RAIZ/scripts/qa-esquema.sql" \
  "$RAIZ/scripts/qa-entrega8.sql" \
  "$RAIZ/scripts/qa-rls.sql"; do
  psql -h /tmp -p $PUERTO -U postgres -v ON_ERROR_STOP=1 -d motor_qa -f "$bateria" 2>&1 \
    | grep -E "PASA|FALLA|===" | sed 's/psql:[^ ]*: NOTICE:  //'
done

echo ""
echo "Puerta QA de la base: en verde"
