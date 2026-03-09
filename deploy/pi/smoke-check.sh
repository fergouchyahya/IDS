#!/usr/bin/env bash

set -euo pipefail

ADMIN_BASE_URL="${ADMIN_BASE_URL:-http://127.0.0.1:8081}"
PLAYER_BASE_URL="${PLAYER_BASE_URL:-http://127.0.0.1:7070}"

echo "[smoke] admin health"
curl --fail --silent --show-error "${ADMIN_BASE_URL}/health" >/dev/null

echo "[smoke] admin state"
curl --fail --silent --show-error "${ADMIN_BASE_URL}/api/state" >/dev/null

echo "[smoke] admin runtime-config"
curl --fail --silent --show-error "${ADMIN_BASE_URL}/runtime-config" >/dev/null

echo "[smoke] admin static asset"
curl --fail --silent --show-error "${ADMIN_BASE_URL}/services/runtime-deps.js" >/dev/null

echo "[smoke] player health"
curl --fail --silent --show-error "${PLAYER_BASE_URL}/health" >/dev/null

echo "[smoke] all checks passed"
