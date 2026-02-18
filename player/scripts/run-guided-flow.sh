#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-7070}"
NAME="${1:-Visitor}"
AUTO="${AUTO:-1}"

node player/src/index.js --guided-flow --serve --port "$PORT" &
PLAYER_PID=$!

cleanup() {
  kill "$PLAYER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
echo "Guided flow running at: http://127.0.0.1:${PORT}/"
echo "Initial page: Hello"

if [[ "$AUTO" == "1" ]]; then
  echo "Sending motion event..."
  curl -sS -X POST "http://127.0.0.1:${PORT}/events" \
    -H "content-type: application/json" \
    -d '{"type":"VISION_PRESENT","timestamp":"2026-02-18T10:00:00Z"}' >/dev/null

  sleep 2

  echo "Sending tap event for name: ${NAME}"
  curl -sS -X POST "http://127.0.0.1:${PORT}/events" \
    -H "content-type: application/json" \
    -d "{\"type\":\"NFC_TAP\",\"studentId\":\"${NAME}\",\"timestamp\":\"2026-02-18T10:00:10Z\"}" >/dev/null
fi

echo "Press Ctrl+C to stop."
wait "$PLAYER_PID"
