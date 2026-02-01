#!/usr/bin/env bash
set -euo pipefail

CONFIG="${1:-shared/contract/examples/config.welcome.json}"
PORT="${2:-7070}"
MODE="${IDS_MODE:-dev}"

node player/src/index.js --config "$CONFIG" --mode "$MODE" --serve --port "$PORT"
