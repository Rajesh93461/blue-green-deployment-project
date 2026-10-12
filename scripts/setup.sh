#!/usr/bin/env bash
# One-time setup: builds v1, starts Blue + Green + Nginx, Blue is live.
set -euo pipefail
cd "$(dirname "$0")/.."
docker build -t bluegreen-app:v1 app/
printf 'BLUE_TAG=v1\nGREEN_TAG=v1\n' > .env
cat nginx/blue.conf > nginx/active.conf
echo blue > .active
docker compose up -d
echo "Ready: http://localhost:8080 -> BLUE (v1)"
