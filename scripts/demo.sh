#!/usr/bin/env bash
#
# Prepara y arranca la API con los datos de ejemplo, en un solo comando: `pnpm demo`.
# El frontend va aparte, con `pnpm dev` en su repositorio.
#
# Ojo: siembra siempre, asi que VACIA la base de datos de desarrollo. Para arrancar sin tocar
# los datos, usa `pnpm db:up && pnpm dev`.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Creado .env a partir de .env.example"
fi

pnpm install
pnpm db:up

# `pnpm exec` y no `pnpm dlx`: dlx se baja la ultima Prisma, que ya no tiene `migrate`.
pnpm exec prisma migrate deploy
pnpm db:seed

echo
echo "  Frontend: pnpm dev en ../taskflow-frontend  ->  http://localhost:3000"
echo

pnpm dev
