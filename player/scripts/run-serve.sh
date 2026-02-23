#!/usr/bin/env bash
# IDS Player Serve Script
# Purpose: run Player HTTP server (event ingestion + UI + render stream).
# Fit: primary local entrypoint for end-to-end interaction testing.

set -euo pipefail

CONFIG="${1:-shared/contract/examples/config.welcome.json}"
PORT="${2:-7070}"
MODE="${IDS_MODE:-dev}"
ADMIN_URL="${IDS_ADMIN_URL:-}"
CONFIG_ID="${IDS_CONFIG_ID:-}"

if [[ -n "$ADMIN_URL" ]]; then
  ARGS=(--admin-url "$ADMIN_URL")
  if [[ -n "$CONFIG_ID" ]]; then
    ARGS+=(--config-id "$CONFIG_ID")
  fi
  node player/src/index.js --mode "$MODE" --serve --port "$PORT" "${ARGS[@]}"
else
  node player/src/index.js --config "$CONFIG" --mode "$MODE" --serve --port "$PORT"
fi
