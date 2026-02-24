#!/bin/bash
# Test script: Admin upload → Player fetch → Trigger events

set -e

ADMIN_URL="http://127.0.0.1:8081"
PLAYER_URL="http://127.0.0.1:7070"
CAMPAIGN_FILE="shared/contract/examples/config.states.json"

echo "=== IDS End-to-End Test ==="
echo ""

# Step 1: Validate config locally
echo "[1] Validating config..."
node shared/contract/scripts/validate-config.js >/dev/null 2>&1 && echo "✓ Config valid" || exit 1

# Step 2: Upload campaign via Admin
echo "[2] Uploading campaign to Admin..."
UPLOAD_RESPONSE=$(curl -s -X POST "$ADMIN_URL/configs" \
  -H "Content-Type: application/json" \
  -d @"$CAMPAIGN_FILE")

echo "$UPLOAD_RESPONSE" | grep -q "configId" && echo "✓ Campaign uploaded" || {
  echo "✗ Upload failed:"
  echo "$UPLOAD_RESPONSE"
  exit 1
}

CONFIG_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"configId":"[^"]*' | cut -d'"' -f4)
echo "  Config ID: $CONFIG_ID"

# Step 3: List configs on Admin
echo "[3] Listing configs on Admin..."
LIST_RESPONSE=$(curl -s -X GET "$ADMIN_URL/configs")
echo "$LIST_RESPONSE" | grep -q "$CONFIG_ID" && echo "✓ Config listed" || exit 1

# Step 4: Fetch current item from Player
echo "[4] Fetching current item from Player..."
FETCH_RESPONSE=$(curl -s -X GET "$PLAYER_URL/fetch")
echo "$FETCH_RESPONSE" | jq . 2>/dev/null && echo "✓ Player fetch OK" || exit 1

# Step 5: Trigger events on Player
echo "[5] Triggering events on Player..."
for EVENT in idle connect nfc tap visitor; do
  echo "  → Sending event: $EVENT"
  EVENT_RESPONSE=$(curl -s -X POST "$PLAYER_URL/events" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"$EVENT\"}")
  echo "$EVENT_RESPONSE" | jq -r '.state' | grep -q "$EVENT" && echo "    ✓ State: $EVENT" || exit 1
done

echo ""
echo "=== All Tests Passed ✓ ==="
