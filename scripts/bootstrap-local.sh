#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${APP_DIR}/.env"
FORCE_ENV=0
SKIP_INSTALL=0
SKIP_DB=0
APP_BASE_URL_OVERRIDE=""
ADMIN_USERNAME_OVERRIDE=""
ADMIN_PASSWORD_OVERRIDE=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/bootstrap-local.sh [options]

Options:
  --env-file PATH          Write to a custom env file instead of .env
  --base-url URL           Override APP_BASE_URL
  --admin-username VALUE   Override INITIAL_ADMIN_USERNAME
  --admin-password VALUE   Override INITIAL_ADMIN_PASSWORD
  --skip-install           Do not run npm install
  --skip-db                Do not run prisma generate / db push
  --force-env              Re-copy defaults even if the env file exists
  -h, --help               Show this help

Examples:
  bash scripts/bootstrap-local.sh
  bash scripts/bootstrap-local.sh --skip-install --skip-db
  bash scripts/bootstrap-local.sh --base-url http://127.0.0.1:3002/kipdok
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

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
    --base-url)
      APP_BASE_URL_OVERRIDE="$2"
      shift 2
      ;;
    --admin-username)
      ADMIN_USERNAME_OVERRIDE="$2"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD_OVERRIDE="$2"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --skip-db)
      SKIP_DB=1
      shift
      ;;
    --force-env)
      FORCE_ENV=1
      shift
      ;;
    -h|--help|help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "${ENV_FILE}" != /* ]]; then
  ENV_FILE="${APP_DIR}/${ENV_FILE}"
fi

PYTHON_BIN="$(resolve_python_bin)"

require_cmd "${PYTHON_BIN}"
require_cmd npm

if [[ ! -f "${APP_DIR}/.env.example" ]]; then
  echo "Missing .env.example in ${APP_DIR}" >&2
  exit 1
fi

mkdir -p "$(dirname "${ENV_FILE}")"

if [[ ! -f "${ENV_FILE}" || "${FORCE_ENV}" -eq 1 ]]; then
  cp "${APP_DIR}/.env.example" "${ENV_FILE}"
fi

bootstrap_raw="$(
  "${PYTHON_BIN}" - "${ENV_FILE}" "${APP_BASE_URL_OVERRIDE}" "${ADMIN_USERNAME_OVERRIDE}" "${ADMIN_PASSWORD_OVERRIDE}" <<'PY'
from pathlib import Path
import secrets
import sys

env_path = Path(sys.argv[1])
base_url_override = sys.argv[2]
admin_username_override = sys.argv[3]
admin_password_override = sys.argv[4]

raw = env_path.read_text(encoding="utf-8")
lines = raw.splitlines()

values = {}
for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip()
    if value.startswith('"') and value.endswith('"'):
        value = value[1:-1]
    elif value.startswith("'") and value.endswith("'"):
        value = value[1:-1]
    values[key] = value

defaults = {
    "DATABASE_URL": "file:./data/db/app.db",
    "DATA_ROOT": "./data",
    "SESSION_SECRET": "replace-with-a-long-random-secret",
    "INITIAL_ADMIN_USERNAME": "admin",
    "INITIAL_ADMIN_PASSWORD": "replace-with-a-strong-password",
    "APP_NAME": "Kipdok",
    "APP_BASE_URL": "http://127.0.0.1:3000/kipdok",
    "MAX_UPLOAD_SIZE_MB": "100",
}

for key, value in defaults.items():
    values.setdefault(key, value)

secret_generated = False
password_generated = False

if values.get("SESSION_SECRET") in {"", "replace-with-a-long-random-secret"}:
    values["SESSION_SECRET"] = secrets.token_urlsafe(48)
    secret_generated = True

if admin_username_override:
    values["INITIAL_ADMIN_USERNAME"] = admin_username_override

if admin_password_override:
    values["INITIAL_ADMIN_PASSWORD"] = admin_password_override
elif values.get("INITIAL_ADMIN_PASSWORD") in {"", "replace-with-a-strong-password"}:
    values["INITIAL_ADMIN_PASSWORD"] = secrets.token_urlsafe(16)
    password_generated = True

if base_url_override:
    values["APP_BASE_URL"] = base_url_override

ordered_keys = [
    "DATABASE_URL",
    "DATA_ROOT",
    "SESSION_SECRET",
    "INITIAL_ADMIN_USERNAME",
    "INITIAL_ADMIN_PASSWORD",
    "APP_NAME",
    "APP_BASE_URL",
    "MAX_UPLOAD_SIZE_MB",
]


def escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


output_lines = []
seen = set()
for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in line:
        output_lines.append(line)
        continue

    key, _ = line.split("=", 1)
    key = key.strip()
    if key in values:
        output_lines.append(f'{key}="{escape(values[key])}"')
        seen.add(key)
    else:
        output_lines.append(line)

for key in ordered_keys:
    if key not in seen:
        output_lines.append(f'{key}="{escape(values[key])}"')

env_path.write_text("\n".join(output_lines).rstrip() + "\n", encoding="utf-8")

print("1" if secret_generated else "0")
print("1" if password_generated else "0")
print(values["INITIAL_ADMIN_PASSWORD"])
print(values["INITIAL_ADMIN_USERNAME"])
print(values["DATA_ROOT"])
print(values["APP_BASE_URL"])
PY
)"

OLD_IFS="${IFS}"
IFS=$'\n'
bootstrap_output=(${bootstrap_raw})
IFS="${OLD_IFS}"

secret_generated="${bootstrap_output[0]}"
password_generated="${bootstrap_output[1]}"
admin_password="${bootstrap_output[2]}"
admin_username="${bootstrap_output[3]}"
data_root_value="${bootstrap_output[4]}"
app_base_url="${bootstrap_output[5]}"

if [[ "${ENV_FILE}" == "${APP_DIR}/"* || "${ENV_FILE}" == "${APP_DIR}/.env" ]]; then
  bash "${APP_DIR}/scripts/ensure-single-env.sh" --env-file "${ENV_FILE}" --delete-conflicts
fi

if [[ "${data_root_value}" = /* ]]; then
  data_root_path="${data_root_value}"
else
  data_root_path="${APP_DIR}/${data_root_value}"
fi

for subdir in "" db uploads messages logs export; do
  if [[ -n "${subdir}" ]]; then
    mkdir -p "${data_root_path}/${subdir}"
  else
    mkdir -p "${data_root_path}"
  fi
done

cd "${APP_DIR}"

if [[ "${SKIP_INSTALL}" -eq 0 ]]; then
  if [[ ! -d "${APP_DIR}/node_modules" ]]; then
    npm install
  else
    echo "node_modules already exists, skipping npm install."
  fi
else
  echo "Skipping npm install."
fi

if [[ "${SKIP_DB}" -eq 0 ]]; then
  if [[ ! -d "${APP_DIR}/node_modules" ]]; then
    echo "node_modules is missing. Re-run without --skip-install or run npm install first." >&2
    exit 1
  fi

  npm run prisma:generate
  npm run prisma:push
else
  echo "Skipping prisma generate / db push."
fi

echo
echo "Bootstrap complete."
echo "Env file: ${ENV_FILE}"
echo "App base URL: ${app_base_url}"
echo "Data root: ${data_root_path}"

if [[ "${secret_generated}" -eq 1 ]]; then
  echo "Generated a random SESSION_SECRET."
fi

if [[ "${password_generated}" -eq 1 ]]; then
  echo "Generated an initial admin password for first login."
fi

echo "Admin username: ${admin_username}"
echo "Admin password: ${admin_password}"
echo
echo "Next steps:"
if [[ "${SKIP_DB}" -eq 0 ]]; then
  echo "  npm run dev"
else
  echo "  docker compose up -d --build"
fi
