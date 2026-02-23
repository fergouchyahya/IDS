#!/usr/bin/env bash
# IDS Player Dev Script
# Purpose: run Player once in non-server mode using a local config file.
# Fit: fast validation path for config loading/validation/summary output.

set -euo pipefail

CONFIG="${1:-shared/contract/examples/config.welcome.json}"
MODE="${IDS_MODE:-dev}"

node player/src/index.js --config "$CONFIG" --mode "$MODE"
