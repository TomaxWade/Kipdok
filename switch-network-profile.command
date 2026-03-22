#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"${SCRIPT_DIR}/scripts/network-profile.sh" "${1:-toggle}"

echo
read -r -p "Press Enter to close..."
