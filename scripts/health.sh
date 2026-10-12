#!/usr/bin/env bash
# Usage: ./scripts/health.sh <blue|green|router>
case "${1:?usage: health.sh blue|green|router}" in
  blue) PORT=5001 ;; green) PORT=5002 ;; router) PORT=8080 ;;
  *) echo "unknown target"; exit 2 ;;
esac
for i in $(seq 1 10); do
  if curl -fsS "http://localhost:$PORT/health" >/dev/null; then
    echo "Health check PASSED on $1"; exit 0
  fi
  echo "Attempt $i failed, retrying..."; sleep 2
done
echo "Health check FAILED on $1"; exit 1
