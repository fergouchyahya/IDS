#!/usr/bin/env bash
set -euo pipefail

# Local player synced to Admin runtime config
PORT="${1:-7070}"
ADMIN_URL="${2:-http://127.0.0.1:8081}"
CONFIG="${3:-shared/contract/examples/config.welcome.json}"

node player/src/index.js --config "$CONFIG" --port "$PORT" --admin-url "$ADMIN_URL"
