#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-7070}"
AUTO="${AUTO:-1}"
MODE="${MODE:-visitor}" # visitor|student
UID="${UID:-demo-uid-001}"

node player/src/index.js --config shared/contract/examples/config.welcome.json --port "$PORT" &
PLAYER_PID=$!

cleanup() {
  kill "$PLAYER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
echo "Guided flow running at: http://127.0.0.1:${PORT}/"

if [[ "$AUTO" == "1" ]]; then
  curl -sS -X POST "http://127.0.0.1:${PORT}/events" \
    -H "content-type: application/json" \
    -d '{"type":"movement_detected"}' >/dev/null

  sleep 1

  if [[ "$MODE" == "student" ]]; then
    curl -sS -X POST "http://127.0.0.1:${PORT}/events" \
      -H "content-type: application/json" \
      -d "{\"type\":\"nfc_tap\",\"nfcUid\":\"${UID}\"}" >/dev/null
  else
    curl -sS -X POST "http://127.0.0.1:${PORT}/events" \
      -H "content-type: application/json" \
      -d '{"type":"visitor_selected"}' >/dev/null
  fi
fi

echo "Press Ctrl+C to stop."
wait "$PLAYER_PID"
