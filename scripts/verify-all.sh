#!/usr/bin/env bash
#
# Runs the full repository verification suite for refactoring safety.
# Includes admin, player, and shared package tests.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[verify-all] Running admin tests..."
npm --prefix "$ROOT_DIR/admin" test

echo "[verify-all] Running player tests..."
npm --prefix "$ROOT_DIR/player" test

echo "[verify-all] Running shared tests..."
node --test "$ROOT_DIR/shared/test/"*.test.js

echo "[verify-all] All checks passed."
