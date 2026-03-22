#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${APP_DIR}/.env"
DEFAULT_LABEL="com.example.kipdok"
LABEL="${KIPDOK_LAUNCH_LABEL:-}"
HOST="127.0.0.1"
PORT="3002"
HEALTH_HOST=""
SKIP_INSTALL=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/apply-config.sh [options]

Options:
  --env-file PATH     Env file to apply, defaults to .env in the repo root
  --label VALUE       launchd label, defaults to the detected Kipdok agent or com.example.kipdok
  --host VALUE        service host, defaults to 127.0.0.1
  --port VALUE        service port, defaults to 3002
  --health-host VALUE Host used for the post-reload health check
  --skip-install      Skip npm install even when node_modules is missing
  -h, --help          Show this help
EOF
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

detect_launch_label() {
  if [[ -n "${LABEL}" ]]; then
    return 0
  fi

  local launch_agents candidate
  launch_agents="${HOME}/Library/LaunchAgents"
  if [[ -d "${launch_agents}" ]]; then
    while IFS= read -r candidate; do
      [[ -n "${candidate}" ]] || continue
      LABEL="$(basename "${candidate}" .plist)"
      return 0
    done < <(
      find "${launch_agents}" -maxdepth 1 -type f \
        \( -name "*kipdok*.plist" -o -name "*tailscale-dropbox-web*.plist" \) | sort
    )
  fi

  LABEL="${DEFAULT_LABEL}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
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
    --health-host)
      HEALTH_HOST="$2"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=1
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

PYTHON_BIN="$(resolve_python_bin)"
detect_launch_label
command -v npm >/dev/null 2>&1 || {
  echo "Missing required command: npm" >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  echo "Missing required command: curl" >&2
  exit 1
}

if [[ "${ENV_FILE}" != /* ]]; then
  ENV_FILE="${APP_DIR}/${ENV_FILE}"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

if [[ -z "${HEALTH_HOST}" ]]; then
  case "${HOST}" in
    0.0.0.0|::|"[::]")
      HEALTH_HOST="127.0.0.1"
      ;;
    *)
      HEALTH_HOST="${HOST}"
      ;;
  esac
fi

cd "${APP_DIR}"

bash "${APP_DIR}/scripts/ensure-single-env.sh" --env-file "${ENV_FILE}" --delete-conflicts

"${PYTHON_BIN}" - "${ENV_FILE}" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1])
raw = env_path.read_text(encoding="utf-8")
normalized = raw.replace("\r\n", "\n").replace("\r", "\n")
if normalized != raw:
    env_path.write_text(normalized, encoding="utf-8")
    print(f"Normalized line endings: {env_path}")
PY

if [[ ! -d "${APP_DIR}/node_modules" ]]; then
  if [[ "${SKIP_INSTALL}" -eq 1 ]]; then
    echo "node_modules is missing and --skip-install was set." >&2
    exit 1
  fi
  npm install
else
  echo "node_modules already exists, skipping npm install."
fi

npm run prisma:generate
npm run prisma:push
npm run build
bash scripts/install-launchd-service.sh --label "${LABEL}" --host "${HOST}" --port "${PORT}" --env-file "${ENV_FILE}"

health_url="http://${HEALTH_HOST}:${PORT}/kipdok/login"
for _ in {1..20}; do
  if curl -fsS -o /dev/null "${health_url}"; then
    echo "Apply complete."
    echo "Env file: ${ENV_FILE}"
    echo "Health check: ${health_url}"
    exit 0
  fi
  sleep 1
done

echo "Service did not become healthy in time: ${health_url}" >&2
exit 1
