#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${APP_DIR}/.env"
NEXT_BIN="${APP_DIR}/node_modules/next/dist/bin/next"

resolve_python_bin() {
  if [[ -n "${PYTHON_BIN:-}" ]]; then
    echo "${PYTHON_BIN}"
    return 0
  fi

  if command -v python3.11 >/dev/null 2>&1; then
    command -v python3.11
    return 0
  fi

  local candidate
  for candidate in \
    /opt/homebrew/bin/python3.11 \
    /usr/local/bin/python3.11 \
    /usr/bin/python3
  do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  echo "python3.11" >&2
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

if [[ "${ENV_FILE}" != /* ]]; then
  ENV_FILE="${APP_DIR}/${ENV_FILE}"
fi

command -v node >/dev/null 2>&1 || {
  echo "Missing required command: node" >&2
  exit 1
}

if [[ ! -f "${NEXT_BIN}" ]]; then
  echo "Missing Next.js CLI: ${NEXT_BIN}" >&2
  echo "Run npm install first." >&2
  exit 1
fi

PYTHON_BIN="$(resolve_python_bin)"

if [[ -f "${ENV_FILE}" ]]; then
  bash "${APP_DIR}/scripts/ensure-single-env.sh" --env-file "${ENV_FILE}" --quiet

  while IFS= read -r -d '' assignment; do
    export "${assignment}"
  done < <("${PYTHON_BIN}" - "${ENV_FILE}" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
for raw_line in env_path.read_text(encoding="utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in raw_line:
        continue

    key, value = raw_line.split("=", 1)
    key = key.strip()
    value = value.strip()

    if value.startswith('"') and value.endswith('"'):
        value = value[1:-1]
    elif value.startswith("'") and value.endswith("'"):
        value = value[1:-1]

    sys.stdout.write(f"{key}={value}\0")
PY
)
fi

exec node "${NEXT_BIN}" "$@"
