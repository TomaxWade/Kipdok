#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_DIR="${DEFAULT_APP_DIR}"
LABEL="com.example.kipdok"
HOST="127.0.0.1"
PORT="3002"
ENV_FILE=".env"
OUTPUT=""
NODE_ENV="production"
LOAD_AGENT=1
PATH_VALUE="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/install-launchd-service.sh [options]

Options:
  --app-dir PATH     App directory, defaults to the repository root
  --label VALUE      launchd label, defaults to com.example.kipdok
  --host VALUE       next start hostname, defaults to 127.0.0.1
  --port VALUE       next start port, defaults to 3002
  --env-file PATH    Env file path, defaults to .env under the app dir
  --output PATH      Output plist path, defaults to ~/Library/LaunchAgents/<label>.plist
  --node-env VALUE   NODE_ENV value, defaults to production
  --no-load          Only write the plist, do not load it with launchctl
  -h, --help         Show this help

Examples:
  bash scripts/install-launchd-service.sh
  bash scripts/install-launchd-service.sh --label com.example.my-inbox --port 3010
  bash scripts/install-launchd-service.sh --no-load --output /tmp/kipdok.plist
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
    --app-dir)
      APP_DIR="$2"
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
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --node-env)
      NODE_ENV="$2"
      shift 2
      ;;
    --no-load)
      LOAD_AGENT=0
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

require_cmd "${PYTHON_BIN}"
require_cmd node

if [[ "${APP_DIR}" != /* ]]; then
  APP_DIR="$(cd "${APP_DIR}" && pwd)"
fi

if [[ "${ENV_FILE}" != /* ]]; then
  ENV_FILE="${APP_DIR}/${ENV_FILE}"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

if [[ -z "${OUTPUT}" ]]; then
  OUTPUT="${HOME}/Library/LaunchAgents/${LABEL}.plist"
elif [[ "${OUTPUT}" != /* ]]; then
  OUTPUT="${APP_DIR}/${OUTPUT}"
fi

LOG_DIR="${APP_DIR}/data/logs"
STDOUT_PATH="${LOG_DIR}/${LABEL}.stdout.log"
STDERR_PATH="${LOG_DIR}/${LABEL}.stderr.log"

mkdir -p "$(dirname "${OUTPUT}")" "${LOG_DIR}"

"${PYTHON_BIN}" - "${OUTPUT}" "${LABEL}" "${APP_DIR}" "${HOST}" "${PORT}" "${ENV_FILE}" "${PATH_VALUE}" "${NODE_ENV}" "${STDOUT_PATH}" "${STDERR_PATH}" <<'PY'
import plistlib
import shlex
import sys
from pathlib import Path

output = Path(sys.argv[1])
label = sys.argv[2]
app_dir = sys.argv[3]
host = sys.argv[4]
port = sys.argv[5]
env_file = sys.argv[6]
path_value = sys.argv[7]
node_env = sys.argv[8]
stdout_path = sys.argv[9]
stderr_path = sys.argv[10]

command = (
    f"cd {shlex.quote(app_dir)} && "
    f"exec bash {shlex.quote(str(Path(app_dir) / 'scripts/run-next-with-env.sh'))} "
    f"--env-file {shlex.quote(env_file)} "
    f"start --hostname {shlex.quote(host)} --port {shlex.quote(port)}"
)

payload = {
    "Label": label,
    "WorkingDirectory": app_dir,
    "ProgramArguments": ["/bin/zsh", "-lc", command],
    "RunAtLoad": True,
    "KeepAlive": True,
    "EnvironmentVariables": {
        "PATH": path_value,
        "NODE_ENV": node_env,
    },
    "StandardOutPath": stdout_path,
    "StandardErrorPath": stderr_path,
}

output.write_bytes(plistlib.dumps(payload, sort_keys=False))
PY

echo "Wrote ${OUTPUT}"

if [[ "${LOAD_AGENT}" -eq 1 ]]; then
  require_cmd launchctl
  gui_domain="gui/$(id -u)"
  launchctl bootout "${gui_domain}" "${OUTPUT}" >/dev/null 2>&1 || true
  launchctl bootstrap "${gui_domain}" "${OUTPUT}"
  launchctl kickstart -k "${gui_domain}/${LABEL}"
  echo "Loaded ${LABEL}"
else
  echo "Skipped launchctl load."
fi

echo "Logs:"
echo "  env -> ${ENV_FILE}"
echo "  stdout -> ${STDOUT_PATH}"
echo "  stderr -> ${STDERR_PATH}"
