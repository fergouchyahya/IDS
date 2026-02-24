#!/usr/bin/env bash
# IDS Guided Flow Script
# Purpose: launch guided demo mode and optionally auto-inject events.
# Fit: scripted demo of the guided text flow.

set -euo pipefail

PORT="${PORT:-7070}"
NAME="${1:-Visitor}"
AUTO="${AUTO:-1}"
CHOICE="${CHOICE:-visitor}"

node player/src/index.js --guided-flow --serve --port "$PORT" &
PLAYER_PID=$!

cleanup() {
  kill "$PLAYER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
echo "Guided flow running at: http://127.0.0.1:${PORT}/"
echo "Initial page: IDLE text loop (IDLE 1 -> IDLE 4)"
echo "Choice mode: ${CHOICE}"

if [[ "$AUTO" == "1" ]]; then
  echo "Sending motion event..."
  curl -sS -X POST "http://127.0.0.1:${PORT}/events" \
    -H "content-type: application/json" \
    -d '{"type":"VISION_PRESENT","timestamp":"2026-02-18T10:00:00Z"}' >/dev/null

  sleep 2

  if [[ "$CHOICE" == "connect" ]]; then
    echo "Sending connect choice event..."
    curl -sS -X POST "http://127.0.0.1:${PORT}/events" \
      -H "content-type: application/json" \
      -d '{"type":"CONNECT","timestamp":"2026-02-18T10:00:10Z"}' >/dev/null
  else
    echo "Sending visitor tap event for name: ${NAME}"
    curl -sS -X POST "http://127.0.0.1:${PORT}/events" \
      -H "content-type: application/json" \
      -d "{\"type\":\"NFC_TAP\",\"studentId\":\"${NAME}\",\"timestamp\":\"2026-02-18T10:00:10Z\"}" >/dev/null
  fi
fi

echo "Press Ctrl+C to stop."
wait "$PLAYER_PID"
