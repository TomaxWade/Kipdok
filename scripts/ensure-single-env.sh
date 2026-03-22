#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_FILE="${APP_DIR}/.env"
DELETE_CONFLICTS=0
QUIET=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ensure-single-env.sh [options]

Options:
  --env-file PATH       Primary env file, defaults to .env in the repo root
  --delete-conflicts    Remove conflicting .env* files automatically
  --quiet               Only print output on errors
  -h, --help            Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --delete-conflicts)
      DELETE_CONFLICTS=1
      shift
      ;;
    --quiet)
      QUIET=1
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

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

shopt -s nullglob
conflicts=()
for candidate in "${APP_DIR}"/.env*; do
  if [[ "${candidate}" == "${ENV_FILE}" ]]; then
    continue
  fi

  case "$(basename "${candidate}")" in
    .env.example)
      continue
      ;;
  esac

  conflicts+=("${candidate}")
done
shopt -u nullglob

if [[ "${#conflicts[@]}" -eq 0 ]]; then
  if [[ "${QUIET}" -eq 0 ]]; then
    echo "Using single env file: ${ENV_FILE}"
  fi
  exit 0
fi

if [[ "${DELETE_CONFLICTS}" -eq 1 ]]; then
  rm -f "${conflicts[@]}"

  if [[ "${QUIET}" -eq 0 ]]; then
    echo "Removed conflicting env files:"
    printf '  %s\n' "${conflicts[@]}"
    echo "Using single env file: ${ENV_FILE}"
  fi
  exit 0
fi

echo "Conflicting env files detected. Keep exactly one active env file." >&2
printf '  %s\n' "${conflicts[@]}" >&2
echo "Primary env file: ${ENV_FILE}" >&2
echo "Run: bash scripts/ensure-single-env.sh --delete-conflicts" >&2
exit 1
