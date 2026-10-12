#!/usr/bin/env bash
# Usage: ./scripts/switch.sh <blue|green>  -> points Nginx at that environment
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET=${1:?usage: switch.sh blue|green}
cat "nginx/$TARGET.conf" > nginx/active.conf
docker compose exec -T router nginx -s reload
echo "$TARGET" > .active
echo "Traffic switched -> $TARGET"
