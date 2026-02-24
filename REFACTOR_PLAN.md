# IDS Refactor Plan: Strip to Core Functionality

## Executive Summary
This refactor removes all non-essential files, logic, and documentation, keeping only:
1. **Admin**: Upload campaign → Validate → Store
2. **Player**: Fetch campaign → Parse → Execute sequence
3. **Shared Contract**: JSON schema (single source of truth)
4. **Core Infrastructure**: Minimal HTTP APIs and deployment hooks

---

## What to REMOVE

### 📁 Directories (Delete Entirely)
- `docs/` — All architectural diagrams, decisions, design docs, TODO lists
- `assets-demo/` — Demo media (fonts, images, videos)
- `player/tests/` — Test files (basic code first)
- `admin/tests/` — Test files (basic code first)
- `tools/` — Utility scripts (not core)

### 📄 Documentation Files (Delete)
- `docs/*.md` — All decision records, meeting notes, HOW-TOs
- `docs/architecture/` — All diagrams and deployment docs
- All `README.md` files except:
  - Root `README.md` (condensed to 2-3 paragraphs)
  - `shared/contract/README.md` (schema explanation only)

### 🔧 Configuration/Infrastructure (Simplify)
- `Makefile` — Keep only `make validate`
- `infra/docker-compose.yml` — Remove nginx, keep minimal services only
- `deploy/pi/` — Remove systemd service details, keep only `.env` skeleton
- Remove `.editorconfig` (less critical)

### 💾 Data Files (Clean)
- `admin/data/configs.jsonl` — Remove sample data (real configs come from API)
- `player/public/assets-demo/` — Remove demo media
- All `.md` files in nested directories

### 📋 Scripts (Simplify)
- `admin/scripts/demo.sh` — Remove demos
- `player/scripts/run-guided-flow.sh` — Remove guided demos
- Keep only:
  - `player/scripts/run-dev.sh` (basic player startup)
  - `player/scripts/run-serve.sh` (HTTP server)

### 🗂️ Source Code Cleanup
- Remove all "commented-out" code
- Remove all debug-specific logging beyond ERROR/INFO
- Remove FSM state machine (Phase 3+) — keep simple event→action mapping
- Simplify player rendering (no Renderer.js complex logic yet)
- No DummyRenderer — just console.log for now

---

## What to KEEP (Core Functionality)

### ✅ Admin Service
```
admin/
├── src/
│   ├── index.js          (entry point)
│   ├── server.js         (HTTP routes: POST /configs, GET /configs, GET /configs/:id)
│   └── storage.js        (append-only storage: save config → assign ID → return)
├── package.json
└── openapi/
    └── openapi.yaml      (API contract, minimal endpoints only)
```

**Admin Core Responsibility:**
1. Accept JSON POST → `/configs`
2. Validate against `shared/contract/schema/config.schema.json`
3. If valid: save to disk (or in-memory for MVP), return `{ id, timestamp, sha256 }`
4. If invalid: return `400 { error, details }`
5. Support `GET /configs` (list IDs + metadata)
6. Support `GET /configs/{id}` (fetch full config)

---

### ✅ Player Service
```
player/
├── src/
│   ├── index.js          (entry point: load config, start server)
│   ├── server.js         (HTTP server: POST /events, GET /fetch)
│   ├── config-loader.js  (load + validate config file)
│   └── campaign.js       (simple campaign executor: iterate items, apply timing)
├── public/
│   ├── index.html        (minimal kiosk HTML)
│   └── js/
│       └── player.js     (browser-side event sender + status display)
├── scripts/
│   ├── run-dev.sh        (run with local config)
│   └── run-serve.sh      (run as HTTP server)
└── package.json
```

**Player Core Responsibility:**
1. Load config from file or environment variable
2. Validate config against schema
3. Serve HTTP endpoints:
   - `GET /fetch` → return current campaign (or status)
   - `POST /events` → accept `{ type, data }` and trigger item transition
4. Execute campaign items in order (using `order` field)
5. Simple timing: wait `durationSec` per item, then move to next
6. Render to HTML (console.log for now, placeholder for future rendering)

---

### ✅ Shared Contract
```
shared/
├── contract/
│   ├── schema/
│   │   └── config.schema.json      (LOCKED: config structure definition)
│   ├── examples/
│   │   ├── config.welcome.json     (minimal example)
│   │   ├── config.media.json       (with assets)
│   │   └── config.invalid.json     (for negative tests later)
│   ├── scripts/
│   │   └── validate-config.js      (run validation on examples)
│   └── package.json
```

**Contract Core Responsibility:**
- Define what a valid config is (immutable source of truth)
- Validation script confirms examples stay valid
- Admin and Player both use this schema

---

### ✅ Minimal Infrastructure
```
infra/
├── docker-compose.yml  (minimal: just admin + player services, no nginx)
└── nginx/
    └── default.conf    (REMOVE — we'll use simple Node routing)

deploy/
└── pi/
    └── env/
        └── ids.env     (environment variables only)
```

---

## Refactoring Steps (In Order)

### Phase 1: Delete Non-Core Content
1. Delete `/docs` entirely
2. Delete `/assets-demo` entirely
3. Delete `/player/tests`, `/admin/tests`
4. Delete `/tools`
5. Delete all nested `README.md` files except contract

### Phase 2: Clean Up Root
1. Update root `README.md` to 3 paragraphs:
   - What is IDS (2 sentences)
   - How to run (dev: `make run-admin`, `make run-player`)
   - How to validate (make validate)

2. Simplify `Makefile`:
   ```makefile
   validate:
       node shared/contract/scripts/validate-config.js
   
   run-admin:
       node admin/src/index.js
   
   run-player:
       node player/src/index.js --config shared/contract/examples/config.welcome.json
   ```

3. Remove `.editorconfig` (optional — keep if already committed)

### Phase 3: Simplify Admin
1. **admin/server.js**: Keep only 3 endpoints (no extraneous logic)
   - `POST /configs` — validate, store, return ID
   - `GET /configs` — return list of IDs + metadata
   - `GET /configs/{id}` — return full config
2. **admin/storage.js**: Use simple in-memory store (append to array) or file-based JSON lines
3. Remove `/admin/data/configs.jsonl` sample data
4. Simplify `/admin/openapi/openapi.yaml` to only these 3 endpoints

### Phase 4: Simplify Player
1. **player/src/index.js**: Remove FSM complexity
   - Just load config → validate → start server
2. **player/src/server.js**: 
   - `GET /fetch` — return current item (with timing info)
   - `POST /events` — accept event, move to next item
3. **player/public/index.html**: Minimal kiosk layout (no fancy UI)
4. **player/public/js/player.js**: Simple event sender (no complex state management)
5. Remove `/player/scripts/run-guided-flow.sh`
6. Remove Renderer.js complexity — just use console.log or simple HTML updates

### Phase 5: Infrastructure Cleanup
1. Simplify `/infra/docker-compose.yml` — just admin + player containers
2. Remove nginx (Node will route directly)
3. Update `/deploy/pi/env/ids.env` to minimal variables:
   ```env
   ADMIN_PORT=8081
   ADMIN_CONFIG_DIR=/data/configs
   PLAYER_PORT=7070
   PLAYER_CONFIG_PATH=/configs/current.json
   ```

### Phase 6: Code Cleanup
1. Remove all commented-out code
2. Remove debug logging (keep ERROR, INFO only)
3. Remove unused imports/variables
4. Simplify error messages (one sentence each)

---

## Final Minimal Repo Structure

```
ids/
├── Makefile                          (validate, run-admin, run-player)
├── README.md                         (3 paragraphs only)
├── .gitignore
├── package.json                      (root workspace)
│
├── admin/
│   ├── package.json
│   ├── src/
│   │   ├── index.js                  (50 lines)
│   │   ├── server.js                 (80 lines)
│   │   └── storage.js                (60 lines)
│   └── openapi/
│       └── openapi.yaml              (30 endpoints)
│
├── player/
│   ├── package.json
│   ├── src/
│   │   ├── index.js                  (60 lines)
│   │   ├── server.js                 (70 lines)
│   │   └── config-loader.js          (40 lines)
│   ├── scripts/
│   │   ├── run-dev.sh                (5 lines)
│   │   └── run-serve.sh              (5 lines)
│   └── public/
│       ├── index.html                (30 lines)
│       └── js/
│           └── player.js             (50 lines)
│
├── shared/
│   └── contract/
│       ├── package.json
│       ├── schema/
│       │   └── config.schema.json
│       ├── examples/
│       │   ├── config.welcome.json
│       │   ├── config.media.json
│       │   └── config.invalid.json
│       └── scripts/
│           └── validate-config.js
│
├── infra/
│   └── docker-compose.yml            (admin + player only)
│
└── deploy/
    └── pi/
        └── env/
            └── ids.env
```

---

## Lines of Code Estimate

| Component | Current | After Refactor |
|-----------|---------|-----------------|
| Admin     | ~200    | ~150           |
| Player    | ~500    | ~200           |
| Shared    | ~300    | ~300 (kept)    |
| Docs      | ~2000   | ~50 (README)   |
| **TOTAL** | **~3000** | **~700** |

---

## What You'll Have After Refactor

✅ **Admin can:**
- Accept JSON upload via API
- Validate against shared schema
- Store with ID + timestamp
- List and retrieve configs

✅ **Player can:**
- Load a config from file or API
- Validate it
- Serve HTTP endpoints for event/fetch
- Execute campaign items in sequence
- Simple timing/transitions

✅ **Shared Contract:**
- Single JSON schema (source of truth)
- Example configs (all valid)
- Validation script for CI

❌ **Removed:**
- All architecture/design docs
- Test files
- Demo scripts and assets
- FSM complexity
- Renderer logic
- Multiple environment configurations
- Systemd service details

---

## Next Steps (Post-Refactor)

Once stripped down, you can:
1. **Phase 1+**: Add tests (unit + integration)
2. **Phase 2+**: Add real rendering logic (Canvas, WebGL)
3. **Phase 3+**: Add event system (GPIO, HTTP webhooks)
4. **Phase 4+**: Add multi-campaign scheduling
5. **Phase 5+**: Add real Raspberry Pi deployment

Each phase will be much clearer with a clean foundation.
