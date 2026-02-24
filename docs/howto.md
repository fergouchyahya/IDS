# IDS How-To (Guided Flow Only)

This document only covers the current guided text flow.

## 1) Prerequisites
- Node.js 20+
- Run commands from repo root (`ids/`)
- Install dependencies once:

```bash
npm --prefix player install
```

## 2) Start the guided flow
```bash
player/scripts/run-guided-flow.sh Yahya
```

Open:
- `http://127.0.0.1:7070/`

## 3) Manual mode (recommended for testing)
```bash
AUTO=0 player/scripts/run-guided-flow.sh Yahya
```

Then send events manually.

Motion detected (go to choice screen):
```bash
curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"VISION_PRESENT","timestamp":"2026-02-18T10:00:00Z"}'
```

Choose visitor (NFC path):
```bash
curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"NFC_TAP","studentId":"Yahya","timestamp":"2026-02-18T10:00:10Z"}'
```

Choose connect:
```bash
curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"CONNECT","timestamp":"2026-02-18T10:00:12Z"}'
```

Force reset to idle:
```bash
curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"IDLE","timestamp":"2026-02-18T10:00:20Z"}'
```

## 4) Expected behavior
1. On load: text loop `IDLE 1`, `IDLE 2`, `IDLE 3`, `IDLE 4` (every 3 seconds).
2. `VISION_PRESENT`: text screen `CHOICE`.
3. `NFC_TAP`: text screen `VISITOR SELECTED`.
4. `CONNECT`: text screen `CONNECT SELECTED`.
5. After 10 seconds on visitor/connect screen: automatic return to the IDLE loop.
6. `NFC_TAP` and `CONNECT` are rejected in IDLE; movement (`VISION_PRESENT`) is required first.

## 5) Useful endpoint
Current state:
```bash
curl http://127.0.0.1:7070/state
```
