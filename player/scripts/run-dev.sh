#!/usr/bin/env bash
set -euo pipefail

# Local player with static boot config (no Admin sync)
CONFIG="${1:-shared/contract/examples/config.welcome.json}"
PORT="${2:-7070}"

node player/src/index.js --config "$CONFIG" --port "$PORT"
