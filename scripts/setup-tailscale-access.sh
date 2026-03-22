#!/usr/bin/env bash

set -euo pipefail

ACTION="${1:-status}"
if [[ $# -gt 0 ]]; then
  shift
fi

PATH_PREFIX="/kipdok"
LEGACY_PATH_PREFIX="/dropbox"
TARGET_URL="http://127.0.0.1:3002/kipdok"
HTTPS_PORT="443"
SERVE_ROOT=""
HTTP_PORT="80"
RESET_FIRST=1
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/setup-tailscale-access.sh status
  bash scripts/setup-tailscale-access.sh reset
  bash scripts/setup-tailscale-access.sh tailnet-only [options]
  bash scripts/setup-tailscale-access.sh open [options]

Options:
  --path VALUE         Published path, defaults to /kipdok
  --legacy-path VALUE  Optional legacy path alias, defaults to /dropbox
  --target URL         Local target URL, defaults to http://127.0.0.1:3002/kipdok
  --https-port VALUE   HTTPS port for tailscale serve/funnel, defaults to 443
  --serve-root URL     Optional extra tailnet HTTP root, for example http://127.0.0.1:3002
  --http-port VALUE    HTTP port for --serve-root, defaults to 80
  --no-reset           Do not reset existing serve/funnel config first
  --dry-run            Print the commands without applying them
  -h, --help           Show this help

Examples:
  bash scripts/setup-tailscale-access.sh tailnet-only
  bash scripts/setup-tailscale-access.sh open --target http://127.0.0.1:3000/kipdok
  bash scripts/setup-tailscale-access.sh tailnet-only --legacy-path /dropbox
  bash scripts/setup-tailscale-access.sh tailnet-only --serve-root http://127.0.0.1:3002
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

run_cmd() {
  printf '+'
  for arg in "$@"; do
    printf ' %q' "${arg}"
  done
  printf '\n'

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    return 0
  fi

  "$@"
}

apply_primary_and_legacy_paths() {
  run_cmd "${TAILSCALE_BIN}" "$1" --bg --https "${HTTPS_PORT}" --set-path "${PATH_PREFIX}" "${TARGET_URL}"

  if [[ -n "${LEGACY_PATH_PREFIX}" && "${LEGACY_PATH_PREFIX}" != "${PATH_PREFIX}" ]]; then
    run_cmd "${TAILSCALE_BIN}" "$1" --bg --https "${HTTPS_PORT}" --set-path "${LEGACY_PATH_PREFIX}" "${TARGET_URL}"
  fi
}

reset_proxying() {
  run_cmd "${TAILSCALE_BIN}" funnel reset
  run_cmd "${TAILSCALE_BIN}" serve reset
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      PATH_PREFIX="$2"
      shift 2
      ;;
    --legacy-path)
      LEGACY_PATH_PREFIX="$2"
      shift 2
      ;;
    --target)
      TARGET_URL="$2"
      shift 2
      ;;
    --https-port)
      HTTPS_PORT="$2"
      shift 2
      ;;
    --serve-root)
      SERVE_ROOT="$2"
      shift 2
      ;;
    --http-port)
      HTTP_PORT="$2"
      shift 2
      ;;
    --no-reset)
      RESET_FIRST=0
      shift
      ;;
    --no-legacy-path)
      LEGACY_PATH_PREFIX=""
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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

TAILSCALE_BIN="$(resolve_tailscale_bin)"
require_cmd "${TAILSCALE_BIN}"

case "${ACTION}" in
  status)
    "${TAILSCALE_BIN}" serve status
    ;;
  reset)
    reset_proxying
    ;;
  tailnet-only)
    if [[ "${RESET_FIRST}" -eq 1 ]]; then
      reset_proxying
    fi

    apply_primary_and_legacy_paths serve

    if [[ -n "${SERVE_ROOT}" ]]; then
      run_cmd "${TAILSCALE_BIN}" serve --bg --http "${HTTP_PORT}" "${SERVE_ROOT}"
    fi
    ;;
  open)
    if [[ "${RESET_FIRST}" -eq 1 ]]; then
      reset_proxying
    fi

    apply_primary_and_legacy_paths funnel

    if [[ -n "${SERVE_ROOT}" ]]; then
      run_cmd "${TAILSCALE_BIN}" serve --bg --http "${HTTP_PORT}" "${SERVE_ROOT}"
    fi
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown action: ${ACTION}" >&2
    usage
    exit 1
    ;;
esac
