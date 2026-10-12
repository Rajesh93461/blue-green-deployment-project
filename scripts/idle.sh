#!/usr/bin/env bash
# Prints the environment that is NOT serving users.
cd "$(dirname "$0")/.."
ACTIVE=$(cat .active 2>/dev/null || echo blue)
[ "$ACTIVE" = "blue" ] && echo green || echo blue
