#!/usr/bin/env bash
# Usage: [BROKEN=1] ./scripts/deploy.sh <tag>   -> builds image and deploys to the IDLE env
set -euo pipefail
cd "$(dirname "$0")/.."
TAG=${1:?usage: deploy.sh <tag>}
[ -f .active ] || ./scripts/setup.sh
IDLE=$(./scripts/idle.sh)
VAR=$(echo "$IDLE" | tr a-z A-Z)_TAG
docker build --build-arg BROKEN="${BROKEN:-0}" -t "bluegreen-app:$TAG" app/
sed -i "s/^$VAR=.*/$VAR=$TAG/" .env
docker compose up -d --no-deps --force-recreate "$IDLE"
echo "Deployed $TAG to $IDLE (no user traffic yet)"
