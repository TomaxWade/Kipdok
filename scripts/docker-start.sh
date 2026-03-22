#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${APP_DIR}"

data_root="${DATA_ROOT:-./data}"

mkdir -p \
  "${data_root}" \
  "${data_root}/db" \
  "${data_root}/uploads" \
  "${data_root}/messages" \
  "${data_root}/logs" \
  "${data_root}/export"

npx prisma db push

exec npm run start -- --hostname 0.0.0.0 --port 3000
