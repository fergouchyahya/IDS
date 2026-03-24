#!/usr/bin/env bash

set -euo pipefail

ADMIN_BASE_URL="${ADMIN_BASE_URL:-http://127.0.0.1:8081}"
PLAYER_BASE_URL="${PLAYER_BASE_URL:-http://127.0.0.1:7070}"
TIMEOUT="${SMOKE_TIMEOUT:-5}"

echo "[smoke] admin health"
curl --fail --silent --show-error --max-time "$TIMEOUT" "${ADMIN_BASE_URL}/health" >/dev/null

echo "[smoke] admin state"
curl --fail --silent --show-error --max-time "$TIMEOUT" "${ADMIN_BASE_URL}/api/state" >/dev/null

echo "[smoke] admin runtime-config"
curl --fail --silent --show-error --max-time "$TIMEOUT" "${ADMIN_BASE_URL}/runtime-config" >/dev/null

echo "[smoke] admin static asset"
curl --fail --silent --show-error --max-time "$TIMEOUT" "${ADMIN_BASE_URL}/services/runtime-deps.js" >/dev/null

echo "[smoke] player health"
curl --fail --silent --show-error --max-time "$TIMEOUT" "${PLAYER_BASE_URL}/health" >/dev/null

echo "[smoke] player current state"
curl --fail --silent --show-error --max-time "$TIMEOUT" "${PLAYER_BASE_URL}/current" >/dev/null

echo "[smoke] nfc service active"
if systemctl is-active --quiet ids-nfc 2>/dev/null; then
  echo "[smoke] ids-nfc service is running"
else
  echo "[smoke] WARNING: ids-nfc service is not running (optional — skip if no NFC reader attached)"
fi

echo "[smoke] all checks passed"
