# Local Development Guide

> How to run, test, and debug IDS on your laptop — no Raspberry Pi needed.

---

## Prerequisites

| Requirement | Version | Check |
|------------|---------|-------|
| Node.js | 20+ | `node -v` |
| npm | Any | `npm -v` |
| Git | Any | `git --version` |

No other tools are required. IDS has minimal dependencies — the only native module is `better-sqlite3` (admin only), which installs pre-built binaries for most platforms.

---

## Quick Start (3 Commands)

```bash
# 1. Install all dependencies
make install

# 2. Start the admin service (terminal 1)
make run-admin

# 3. Start the player service (terminal 2)
make run-player
```

Then open:
- **Admin UI:** http://127.0.0.1:8081
- **Player display:** http://127.0.0.1:7070

The default API key is `admin` (set in `.env.example`).

---

## Step-by-Step Setup

### 1. Clone and Install

```bash
git clone git@github.com:fergouchyahya/IDS.git
cd IDS

# Install all packages (admin, player, shared contract)
make install
```

This installs:
- `admin/node_modules/` — `better-sqlite3` for student profile storage
- `player/node_modules/` — empty (pure Node.js, no dependencies)
- `shared/contract/node_modules/` — `ajv` for JSON schema validation

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

The defaults work out of the box for local development. Key settings:

| Variable | Default | Notes |
|----------|---------|-------|
| `IDS_ADMIN_API_KEY` | `admin` | Used to authenticate admin UI mutations |
| `ADMIN_PORT` | `8081` | Admin service port |
| `PLAYER_PORT` | `7070` | Player service port |
| `NODE_ENV` | `development` | Set to `production` on Pi |

### 3. Start Services

You need **two terminal windows** — one for each service.

**Terminal 1 — Admin:**
```bash
make run-admin
# or: node admin/src/index.js
```

You should see:
```
{"level":"info","service":"ids-admin-server","message":"server_listening","url":"http://127.0.0.1:8081"}
```

**Terminal 2 — Player:**
```bash
make run-player
# or: node player/src/index.js --config shared/contract/examples/config.welcome.json --admin-url http://127.0.0.1:8081 --port 7070
```

You should see:
```
{"level":"info","service":"ids-player-server","message":"server_listening","url":"http://127.0.0.1:7070"}
```

### 4. Verify It Works

```bash
# Admin health
curl http://127.0.0.1:8081/health

# Player health
curl http://127.0.0.1:7070/health

# Player current state
curl http://127.0.0.1:7070/current
```

Open http://127.0.0.1:8081 in your browser — the admin UI should load and prompt for the API key (`admin`).

Open http://127.0.0.1:7070 in another tab — you should see the player display in IDLE state.

---

## Running Tests

```bash
# Run everything
make test-all

# Individual suites
npm --prefix admin test        # 20 admin tests
npm --prefix player test       # 5 player tests
node --test shared/test/*.test.js  # 9 shared tests

# Validate JSON schema contract
make validate
```

All 34 tests should pass. If admin integration tests fail with `listen EPERM`, your environment restricts local socket binding — the code is fine.

---

## Debug Mode

Add `?debug=1` to the player URL to enable debug controls:

```
http://127.0.0.1:7070?debug=1
```

Debug mode provides:
- Manual event buttons (movement, visitor, NFC tap)
- NFC UID input field for simulating card taps
- State label and campaign info in the header
- Timeout countdown in the footer

### Simulating Events Without Hardware

**Trigger movement (IDLE → MENU):**
```bash
curl -X POST http://127.0.0.1:7070/events -H 'Content-Type: application/json' -d '{"type":"movement_detected"}'
```

> Note: `movement_detected` via `/events` returns `403` — use the detector endpoint instead:
```bash
# Get the detector token from the player startup logs, then:
curl -X POST http://127.0.0.1:7070/detector/movement \
  -H 'x-detector-token: <token-from-logs>'
```

**Trigger visitor selection (MENU → VISITOR_INFO):**
```bash
curl -X POST http://127.0.0.1:7070/events -H 'Content-Type: application/json' -d '{"type":"visitor_selected"}'
```

**Simulate NFC tap (MENU → STUDENT_INFO):**
```bash
curl -X POST http://127.0.0.1:7070/events -H 'Content-Type: application/json' -d '{"type":"nfc_tap","nfcUid":"04295202c66780"}'
```

The UID `04295202c66780` is the demo student (Fergyah) included in the demo config.

**Send presence keepalive (acknowledged but does not reset timer):**
```bash
# Get the detector token from the player startup logs, then:
curl -X POST http://127.0.0.1:7070/detector/events \
  -H 'Content-Type: application/json' \
  -H 'x-detector-token: <token-from-logs>' \
  -d '{"type":"presence_keepalive"}'
```

> Note: In normal operation, the browser detector sends `presence_keepalive` automatically every 3 seconds while the camera detects someone in front of the display. Keepalives are acknowledged by the state machine but do **not** reset the inactivity timer — only real interactions (gestures, NFC taps, scrolls) do. This means the display returns to IDLE after the configured timeout even if someone is still present.

---

## Using the Demo Config

For a realistic demo experience with pre-loaded content:

```bash
# Start player with the NFC demo config
node player/src/index.js \
  --config shared/contract/examples/config.nfc-demo.json \
  --port 7070 \
  --admin-url http://127.0.0.1:8081
```

This config includes:
- Polytech Grenoble idle campaign with campus images
- Visitor information campaign
- Menu campaign with visitor/student cards
- Demo student (Fergyah, UID: `04295202c66780`)

---

## Project Structure for Development

```
ids/
├── admin/
│   ├── src/              Backend source code
│   │   ├── index.js      Entry point
│   │   ├── server.js     Composition root (wires everything)
│   │   ├── router.js     Route dispatch + auth check
│   │   ├── middleware/    Auth middleware (API key)
│   │   ├── handlers/     HTTP request handlers
│   │   ├── services/     Domain business logic
│   │   ├── storage/      Persistence (JSON file + SQLite)
│   │   └── utils/        Helpers
│   ├── public/           Browser admin UI (vanilla JS)
│   ├── test/             Tests
│   └── data/             Runtime data (created automatically)
│       ├── state.json    Campaign/settings state
│       ├── students.db   Student profiles (SQLite)
│       └── uploads/      Uploaded media files
│
├── player/
│   ├── src/              Backend source code
│   │   ├── index.js      Entry point (CLI arg parsing)
│   │   ├── server.js     Composition root
│   │   ├── router.js     Route dispatch
│   │   ├── handlers/     Event + state handlers
│   │   ├── services/     State machine, rendering, admin sync
│   │   └── detector/     Motion detection, NFC events
│   └── test/             Tests
│
├── shared/               Common code for both services
├── deploy/               Raspberry Pi deployment assets
├── docs/                 Documentation
├── scripts/              Verification scripts
├── .env.example          Environment template
└── Makefile              Build + run commands
```

---

## Common Development Tasks

### Reset All Data

Delete the admin data directory to start fresh:

```bash
rm -rf admin/data
```

The directory is recreated automatically on next startup with an empty state.

### Change the API Key

Edit `.env` (or set the environment variable):

```bash
export IDS_ADMIN_API_KEY=my-secret-key
```

Restart the admin service. The browser admin UI will prompt for the new key.

### Run Player Without Admin

The player can run standalone with a static config (no admin sync):

```bash
make run-player-static
# or: node player/src/index.js --config shared/contract/examples/config.welcome.json --port 7070
```

Without `--admin-url`, the player won't sync from admin and won't load student campaigns on NFC tap.

### Add a Test Student via API

```bash
curl -X POST http://127.0.0.1:8081/api/students \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer admin' \
  -d '{
    "nfcUid": "AABBCCDD",
    "name": "Test Student",
    "items": [
      {"contentId": "t1", "type": "TEXT", "data": "Hello from test student!", "order": 1, "durationSec": 5}
    ]
  }'
```

### Watch Logs

Both services output structured JSON logs to stdout. Use `LOG_LEVEL=debug` for verbose output:

```bash
LOG_LEVEL=debug node admin/src/index.js
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm install` fails on `better-sqlite3` | Make sure you have Node.js 20+. On some systems you may need `python3` and a C++ compiler (`build-essential` on Ubuntu, Xcode CLI tools on macOS). |
| Port already in use | Another process is using 8081 or 7070. Kill it with `lsof -ti:8081 | xargs kill` or change the port in `.env`. |
| Admin UI prompts for API key | Enter `admin` (the default). Or check your `IDS_ADMIN_API_KEY` environment variable. |
| Player shows "Connecting to server..." | The admin service is not running. Start it first. |
| NFC tap returns "card_not_recognized" | The UID is not in the student database. Add the student via the admin API or UI. |
| Tests fail with `listen EPERM` | Your environment blocks local socket binding. The tests are correct — run them in an unrestricted environment. |
| `make: *** No rule to make target` | You are not in the `ids/` directory. `cd` into the project root. |

---

## Testing on the Pi After Local Development

Once your changes work locally:

1. Run all tests: `make test-all` (all 34 must pass)
2. Push your code or sync to the Pi (see [Deployment Guide](deployment-pi.md))
3. Run the smoke check on the Pi: `sudo -u ids bash ./deploy/pi/smoke-check.sh`
4. Test the full flow: IDLE → movement → MENU → visitor/NFC → content → timeout → IDLE

See [Deployment Guide](deployment-pi.md) for the full Pi update procedure.

---

## Related Docs

| Document | Description |
|----------|-------------|
| [Testing Guide](../testing.md) | Test suites and verification |
| [Deployment Guide](deployment-pi.md) | Raspberry Pi setup and operations |
| [Demo Script](../demo-script.md) | Step-by-step demo walkthrough |
| [Architecture Overview](../architecture/overview.md) | System design |
