#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"

node "$ROOT_DIR/admin/src/index.js" >/tmp/ids-admin.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sleep 0.5

echo "POST /configs (welcome)"
curl -s -X POST http://127.0.0.1:8081/configs \
  -H 'Content-Type: application/json' \
  -d @"$ROOT_DIR/shared/contract/examples/config.welcome.json"
echo ""

echo "GET /configs"
curl -s http://127.0.0.1:8081/configs
echo ""

FIRST_ID="$(curl -s http://127.0.0.1:8081/configs | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{const j=JSON.parse(d);console.log((j.configs&&j.configs[0]&&j.configs[0].configId)||"");}catch(e){console.log("");}})')"

if [ -n "$FIRST_ID" ]; then
  echo "GET /configs/$FIRST_ID"
  curl -s "http://127.0.0.1:8081/configs/$FIRST_ID"
  echo ""
else
  echo "No configId found; skipping GET /configs/{id}"
fi
