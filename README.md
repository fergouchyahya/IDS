# IDS (Interactive Digital Signage)

This repository provides a working MVP for an interactive signage flow:

- `IDLE` campaign (admin-selected)
- motion -> `MENU`
- menu choice -> `VISITOR_INFO` or `STUDENT_INFO` (via NFC UID)
- `scroll_next` / `scroll_prev` with circular navigation
- inactivity timeout back to `IDLE`

The Admin controls all content (idle campaigns, visitor campaigns, student campaigns, menu content, timeout) through a simple web UI. The Player renders the flow and accepts simulated events.

## 1. Requirements (Laptop)

- Node.js 20+ (tested with Node 22)
- npm
- Linux/macOS terminal (or WSL on Windows)

## 2. Install dependencies

From repo root:

```bash
npm --prefix admin install
npm --prefix player install
npm --prefix shared/contract install
```

## 3. Start services

Terminal A (Admin):

```bash
node admin/src/index.js
```

Terminal B (Player, synced with Admin):

```bash
node player/src/index.js \
  --config shared/contract/examples/config.welcome.json \
  --admin-url http://127.0.0.1:8081 \
  --port 7070
```

Open:

- Admin UI: `http://127.0.0.1:8081`
- Player UI: `http://127.0.0.1:7070`

## 4. Full functionality rundown

### Admin UI capabilities

In Admin (`http://127.0.0.1:8081`), you can:

- Set inactivity timeout (`Settings`)
- Choose active Idle and Visitor campaigns (`Active Campaign Selection`)
- Build campaigns using a guided block editor (no raw JSON input)
- Choose campaign type (`Idle`, `Visitor`, `Student`)
- Duplicate existing campaigns or create new ones
- Upload image/video files directly and bind them to blocks
- Edit the Menu campaign with the same block builder
- Add/update students by NFC UID with personal campaigns
- Delete campaigns/students

All data is persisted in `admin/data/state.json` and uploaded media in `admin/data/uploads/` (auto-created).

### Player flow and events

Canonical events:

- `movement_detected`
- `visitor_selected`
- `nfc_tap` (requires `nfcUid`)
- `scroll_next`
- `scroll_prev`

Behavior:

1. Startup state is `IDLE` using active Idle campaign.
2. In `IDLE`, content auto-scrolls like a ticker:
   - `VIDEO`: waits for playback end, then advances
   - `TEXT`/`IMAGE`: waits item `durationSec`, then advances
3. `movement_detected` moves to `MENU`.
4. `visitor_selected` from menu goes to active Visitor campaign.
5. `nfc_tap` from menu:
   - known UID -> `STUDENT_INFO`
   - unknown UID -> returns to menu
6. `scroll_next` and `scroll_prev` are circular.
7. inactivity timeout returns to `IDLE`.

### Quick API tests (optional)

```bash
# Check current state
curl -s http://127.0.0.1:7070/current | jq

# movement -> menu
curl -s -X POST http://127.0.0.1:7070/events \
  -H 'content-type: application/json' \
  -d '{"type":"movement_detected"}' | jq

# visitor path
curl -s -X POST http://127.0.0.1:7070/events \
  -H 'content-type: application/json' \
  -d '{"type":"visitor_selected"}' | jq

# student path (known demo UID)
curl -s -X POST http://127.0.0.1:7070/events \
  -H 'content-type: application/json' \
  -d '{"type":"movement_detected"}' >/dev/null
curl -s -X POST http://127.0.0.1:7070/events \
  -H 'content-type: application/json' \
  -d '{"type":"nfc_tap","nfcUid":"demo-uid-001"}' | jq
```

## 5. Automated checks

From repo root:

```bash
node shared/contract/scripts/validate-config.js
npm --prefix admin test
npm --prefix player test
```

## 6. Useful scripts

```bash
# Player only, static config
./player/scripts/run-dev.sh

# Player synced with Admin
./player/scripts/run-serve.sh

# Guided simulated sequence
./player/scripts/run-guided-flow.sh
```

## 7. Notes

- Admin remains source of truth for content selection.
- Player supports simulated events now; hardware adapters for NFC/gesture can be integrated later.
- Current data model is JSON-file based for simplicity on Raspberry Pi. SQLite can be introduced later without changing UI flow.
