#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_LAUNCH_LABEL="com.example.kipdok"
LEGACY_LAUNCH_LABEL="com.example.tailscale-dropbox-web"
LAUNCH_LABEL="${KIPDOK_LAUNCH_LABEL:-${DEFAULT_LAUNCH_LABEL}}"
LAUNCH_AGENT="${KIPDOK_LAUNCH_AGENT:-${HOME}/Library/LaunchAgents/${LAUNCH_LABEL}.plist}"
PLIST_BUDDY="/usr/libexec/PlistBuddy"

usage() {
  cat <<'EOF'
Usage:
  scripts/network-profile.sh toggle
  scripts/network-profile.sh open
  scripts/network-profile.sh tailnet-only
  scripts/network-profile.sh status

Profiles:
  open          Restore the previous public profile:
                - next-server listens on 0.0.0.0:3002
                - Funnel is enabled for /kipdok and /dropbox

  tailnet-only  Keep the new private profile:
                - next-server listens on 127.0.0.1:3002
                - only /kipdok is exposed inside the tailnet
                - no Funnel config remains

Environment:
  KIPDOK_LAUNCH_LABEL  Override the launchd label to inspect
  KIPDOK_LAUNCH_AGENT  Override the LaunchAgent plist path directly
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

resolve_tailscale_bin() {
  if [[ -n "${TAILSCALE_BIN:-}" ]]; then
    echo "${TAILSCALE_BIN}"
    return 0
  fi

  if command -v tailscale >/dev/null 2>&1; then
    command -v tailscale
    return 0
  fi

  local candidate
  for candidate in \
    /usr/local/bin/tailscale \
    /opt/homebrew/bin/tailscale \
    /Applications/Tailscale.app/Contents/MacOS/Tailscale
  do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  echo "tailscale" >&2
  return 1
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

detect_launch_agent() {
  if [[ -n "${KIPDOK_LAUNCH_AGENT:-}" ]]; then
    LAUNCH_AGENT="${KIPDOK_LAUNCH_AGENT}"
    if [[ -z "${KIPDOK_LAUNCH_LABEL:-}" ]]; then
      LAUNCH_LABEL="$(basename "${LAUNCH_AGENT}" .plist)"
    fi
    return 0
  fi

  if [[ -f "${LAUNCH_AGENT}" ]]; then
    return 0
  fi

  local candidate
  for candidate in \
    "${HOME}/Library/LaunchAgents/${LEGACY_LAUNCH_LABEL}.plist"
  do
    if [[ -f "${candidate}" ]]; then
      LAUNCH_AGENT="${candidate}"
      LAUNCH_LABEL="$(basename "${candidate}" .plist)"
      return 0
    fi
  done

  while IFS= read -r candidate; do
    [[ -n "${candidate}" ]] || continue
    LAUNCH_AGENT="${candidate}"
    LAUNCH_LABEL="$(basename "${candidate}" .plist)"
    return 0
  done < <(
    if [[ -d "${HOME}/Library/LaunchAgents" ]]; then
      find "${HOME}/Library/LaunchAgents" -maxdepth 1 -type f \
        \( -name "*kipdok*.plist" -o -name "*tailscale-dropbox-web*.plist" \) | sort
    fi
  )
}

TAILSCALE_BIN="$(resolve_tailscale_bin)"
PYTHON_BIN="$(resolve_python_bin)"
detect_launch_agent

current_launch_host() {
  if "${PLIST_BUDDY}" -c 'Print :ProgramArguments:4' "${LAUNCH_AGENT}" >/dev/null 2>&1; then
    "${PLIST_BUDDY}" -c 'Print :ProgramArguments:4' "${LAUNCH_AGENT}"
    return 0
  fi

  local command
  command="$("${PLIST_BUDDY}" -c 'Print :ProgramArguments:2' "${LAUNCH_AGENT}")"
  awk '{
    for (i = 1; i < NF; i++) {
      if ($i == "--hostname") {
        print $(i + 1)
        exit
      }
    }
  }' <<<"${command}"
}

current_mode() {
  case "$(current_launch_host)" in
    127.0.0.1)
      echo "tailnet-only"
      ;;
    0.0.0.0)
      echo "open"
      ;;
    *)
      echo "custom"
      ;;
  esac
}

set_launch_host() {
  local host="$1"
  if "${PLIST_BUDDY}" -c 'Print :ProgramArguments:4' "${LAUNCH_AGENT}" >/dev/null 2>&1; then
    "${PLIST_BUDDY}" -c "Set :ProgramArguments:4 ${host}" "${LAUNCH_AGENT}"
    return 0
  fi

  "${PYTHON_BIN}" - "${LAUNCH_AGENT}" "${host}" <<'PY'
import plistlib
import re
import sys
from pathlib import Path

plist_path = Path(sys.argv[1])
host = sys.argv[2]
data = plistlib.loads(plist_path.read_bytes())
args = data.get("ProgramArguments", [])

if len(args) < 3:
    raise SystemExit("ProgramArguments does not contain a shell command entry")

command = args[2]
updated = re.sub(r"(--hostname\s+)\S+", rf"\1{host}", command)
if updated == command:
    raise SystemExit("Unable to locate --hostname in launchd command")

args[2] = updated
data["ProgramArguments"] = args
plist_path.write_bytes(plistlib.dumps(data, sort_keys=False))
PY
}

reload_launch_agent() {
  local gui_domain="gui/$(id -u)"
  launchctl bootout "${gui_domain}" "${LAUNCH_AGENT}" >/dev/null 2>&1 || true
  launchctl bootstrap "${gui_domain}" "${LAUNCH_AGENT}"
  launchctl kickstart -k "${gui_domain}/${LAUNCH_LABEL}"
}

wait_for_listener() {
  local host="$1"
  local port="$2"
  local attempts="${3:-30}"

  while (( attempts > 0 )); do
    if nc -z "${host}" "${port}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    attempts=$((attempts - 1))
  done

  echo "Timed out waiting for ${host}:${port}" >&2
  return 1
}

reset_tailscale_proxying() {
  "${TAILSCALE_BIN}" funnel reset >/dev/null 2>&1 || true
  "${TAILSCALE_BIN}" serve reset >/dev/null 2>&1 || true
}

apply_open_profile() {
  echo "Applying open profile..."
  set_launch_host "0.0.0.0"
  reload_launch_agent
  wait_for_listener "127.0.0.1" "3002"

  reset_tailscale_proxying

  "${TAILSCALE_BIN}" funnel --bg --https 443 --set-path /kipdok http://127.0.0.1:3002/kipdok
  "${TAILSCALE_BIN}" funnel --bg --https 443 --set-path /dropbox http://127.0.0.1:3002/kipdok
}

apply_tailnet_only_profile() {
  echo "Applying tailnet-only profile..."
  set_launch_host "127.0.0.1"
  reload_launch_agent
  wait_for_listener "127.0.0.1" "3002"

  reset_tailscale_proxying

  "${TAILSCALE_BIN}" serve --bg --https 443 --set-path /kipdok http://127.0.0.1:3002/kipdok
  "${TAILSCALE_BIN}" serve --bg --https 443 --set-path /dropbox http://127.0.0.1:3002/kipdok
}

serve_status_output() {
  "${TAILSCALE_BIN}" serve status 2>&1 || true
}

local_listener_output() {
  lsof -nP -iTCP:3002 -sTCP:LISTEN 2>/dev/null || true
}

show_status() {
  echo "Mode: $(current_mode)"
  echo "LaunchAgent host: $(current_launch_host)"
  echo
  echo "tailscale serve status:"
  serve_status_output
  echo
  echo "Local listener:"
  local_listener_output
}

show_status_json() {
  local mode launch_host serve_status listener_output
  mode="$(current_mode)"
  launch_host="$(current_launch_host)"
  serve_status="$(serve_status_output)"
  listener_output="$(local_listener_output)"

  "${PYTHON_BIN}" - "$mode" "$launch_host" "$serve_status" "$listener_output" <<'PY'
import json
import sys

print(json.dumps({
    "mode": sys.argv[1],
    "launchHost": sys.argv[2],
    "serveStatus": sys.argv[3],
    "localListener": sys.argv[4],
}, ensure_ascii=False))
PY
}

main() {
  require_cmd launchctl
  require_cmd nc
  require_cmd lsof
  require_cmd "${TAILSCALE_BIN}"
  require_cmd "${PYTHON_BIN}"

  if [[ ! -f "${LAUNCH_AGENT}" ]]; then
    echo "LaunchAgent not found: ${LAUNCH_AGENT}" >&2
    if [[ -z "${KIPDOK_LAUNCH_AGENT:-}" ]]; then
      echo "Checked labels: ${DEFAULT_LAUNCH_LABEL}, ${LEGACY_LAUNCH_LABEL}" >&2
    fi
    exit 1
  fi

  local action="${1:-toggle}"

  case "${action}" in
    open)
      apply_open_profile
      ;;
    tailnet-only)
      apply_tailnet_only_profile
      ;;
    toggle)
      case "$(current_mode)" in
        open)
          apply_tailnet_only_profile
          ;;
        tailnet-only)
          apply_open_profile
          ;;
        *)
          echo "Current mode is custom; specify 'open' or 'tailnet-only' explicitly." >&2
          exit 1
          ;;
      esac
      ;;
    status)
      show_status
      exit 0
      ;;
    status-json)
      show_status_json
      exit 0
      ;;
    -h|--help|help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac

  echo
  show_status
}

main "$@"
