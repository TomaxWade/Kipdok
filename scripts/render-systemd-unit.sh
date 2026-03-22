#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_DIR="${DEFAULT_APP_DIR}"
ENV_FILE=".env"
HOST="127.0.0.1"
PORT="3002"
SERVICE_NAME="kipdok"
DESCRIPTION="Kipdok"
USER_NAME="$(id -un)"
GROUP_NAME="$(id -gn)"
NODE_ENV="production"
PATH_VALUE="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
OUTPUT=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/render-systemd-unit.sh [options]

Options:
  --app-dir PATH        App directory, defaults to the repository root
  --env-file PATH       Env file path, defaults to .env under the app dir
  --host VALUE          next start hostname, defaults to 127.0.0.1
  --port VALUE          next start port, defaults to 3002
  --service-name VALUE  Unit name hint, defaults to kipdok
  --description VALUE   Unit description, defaults to Kipdok
  --user VALUE          Linux user that runs the service, defaults to current user
  --group VALUE         Linux group that runs the service, defaults to current group
  --node-env VALUE      NODE_ENV value, defaults to production
  --output PATH         Write the rendered unit to a file instead of stdout
  -h, --help            Show this help

Examples:
  bash scripts/render-systemd-unit.sh
  bash scripts/render-systemd-unit.sh --app-dir /opt/kipdok --output /tmp/kipdok.service
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --service-name)
      SERVICE_NAME="$2"
      shift 2
      ;;
    --description)
      DESCRIPTION="$2"
      shift 2
      ;;
    --user)
      USER_NAME="$2"
      shift 2
      ;;
    --group)
      GROUP_NAME="$2"
      shift 2
      ;;
    --node-env)
      NODE_ENV="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
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

if [[ "${APP_DIR}" != /* ]]; then
  APP_DIR="$(cd "${APP_DIR}" && pwd)"
fi

if [[ "${ENV_FILE}" != /* ]]; then
  ENV_FILE="${APP_DIR}/${ENV_FILE}"
fi

rendered_unit=$(
  cat <<EOF
[Unit]
Description=${DESCRIPTION}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER_NAME}
Group=${GROUP_NAME}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=${NODE_ENV}
Environment=PATH=${PATH_VALUE}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/env bash -lc 'npm run start -- --hostname ${HOST} --port ${PORT}'
Restart=always
RestartSec=5
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
EOF
)

if [[ -n "${OUTPUT}" ]]; then
  if [[ "${OUTPUT}" != /* ]]; then
    OUTPUT="${APP_DIR}/${OUTPUT}"
  fi
  mkdir -p "$(dirname "${OUTPUT}")"
  printf '%s\n' "${rendered_unit}" > "${OUTPUT}"
  echo "Wrote ${OUTPUT}"
  echo "Suggested install path: /etc/systemd/system/${SERVICE_NAME}.service"
else
  printf '%s\n' "${rendered_unit}"
fi
