# IDS How-To: Run and Test

This guide shows the fastest way to run and test the current IDS flow:
Admin -> Player -> Browser Renderer.

## 1) Prerequisites
- Node.js 20+ installed.
- Run commands from repo root: `ids/`.

## 2) Install dependencies
```bash
npm --prefix shared/contract install
npm --prefix admin install
npm --prefix player install
```

## 3) Validate shared contract examples
```bash
make validate
```

## 4) Start Admin API
```bash
node admin/src/index.js
```
Admin listens on `http://127.0.0.1:8081`.

## 5) Upload a config to Admin
```bash
curl -X POST http://127.0.0.1:8081/configs \
  -H "content-type: application/json" \
  --data-binary @shared/contract/examples/config.ENGAGED.json
```

Optional checks:
```bash
curl http://127.0.0.1:8081/configs
curl http://127.0.0.1:8081/configs/<configId>
```

## 6) Start Player (admin-backed + serve mode)
```bash
IDS_ADMIN_URL=http://127.0.0.1:8081 bash player/scripts/run-serve.sh
```
Player serves UI + event endpoints on `http://127.0.0.1:7070`.

## 7) Open renderer in browser
- Open: `http://127.0.0.1:7070/`

The page connects to `/render-stream` and waits for render events.

## 8) Trigger events to test playback
```bash
curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"VISION_PRESENT","timestamp":"2026-02-18T10:00:00Z"}'
```

Other examples:
```bash
curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"NFC_TAP","studentId":"s123","timestamp":"2026-02-18T10:00:10Z"}'

curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"IDLE","timestamp":"2026-02-18T10:00:20Z"}'
```

## 9) Useful debug endpoints
- Player state: `curl http://127.0.0.1:7070/state`
- Render stream (raw): `curl -N http://127.0.0.1:7070/render-stream`

## 10) Quick local mode (no Admin)
If you want file-based config mode:
```bash
bash player/scripts/run-serve.sh shared/contract/examples/config.welcome.json 7070
```

## 11) Guided demo flow (exact 3-screen sequence)
This mode gives:
1. `Hello` on page load
2. After motion event: `Visitor` + `Tap to connect`
3. After tap event: `Hello <name>`

Run automatic demo (events sent automatically):
```bash
player/scripts/run-guided-flow.sh Yahya
```

Run manual demo (you send events yourself):
```bash
AUTO=0 player/scripts/run-guided-flow.sh Yahya
```

Manual event injection example:
```bash
curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"VISION_PRESENT","timestamp":"2026-02-18T10:00:00Z"}'

curl -X POST http://127.0.0.1:7070/events \
  -H "content-type: application/json" \
  -d '{"type":"NFC_TAP","studentId":"Yahya","timestamp":"2026-02-18T10:00:10Z"}'
```

## Expected behavior
- No render until a non-IDLE event is posted.
- On event, scheduler starts campaign playback.
- Browser updates live from SSE `render` events.
- `IDLE` clears playback and renderer view.
