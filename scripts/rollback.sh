#!/usr/bin/env bash
# Sends traffic back to the previous environment.
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/switch.sh "$(./scripts/idle.sh)"
echo "ROLLBACK complete"
