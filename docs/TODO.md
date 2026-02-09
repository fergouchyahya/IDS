# IDS — Master TODO List (Clean-Slate, Methodical)

This document is a **construction plan**, not a sprint backlog.  
It is intentionally boring, explicit, and methodical.

Each checkbox is designed to be ticked without improvisation, while still leading to a solid and defensible IDS implementation.

---

## PHASE 0 — Repository Hygiene & Ground Rules

**Goal:** The repository is clean, understandable, and safe to evolve.

- [ ] Ensure repo builds and validates from a fresh clone
- [ ] Confirm `make validate` works on a new machine
- [ ] Ensure `shared/contract/package.json` is committed
- [ ] Ensure CI passes on `main`
- [ ] Decide and document:
  - [ ] Node version (e.g. 20 LTS)
  - [ ] Naming conventions (camelCase vs snake_case)
  - [ ] File responsibility rules (no “misc” files)

**Deliverable:**  
The repository feels boring and predictable.

---

## PHASE 1 — Contract as Law (`shared/contract`)

**Goal:** Lock down what a “config” *is* before writing any runtime logic.

### Schema evolution

- [ ] Review `config.schema.json` field by field
- [ ] Decide which fields are:
  - [ ] mandatory forever
  - [ ] optional
  - [ ] future-reserved
- [ ] Add `$comment` explanations for:
  - [ ] top-level object
  - [ ] `items[]`
  - [ ] `type` enum semantics
- [ ] Decide whether ordering is:
  - [ ] explicit via `order`
  - [ ] implicit via array index
- [ ] Decide whether duration `0` is allowed or forbidden

### Examples

- [ ] Keep `config.welcome.json` minimal forever
- [ ] Ensure `config.media.json`:
  - [ ] includes IMAGE
  - [ ] includes VIDEO
  - [ ] uses realistic asset paths
- [ ] Add one **intentionally invalid** example (not validated in CI)
  - [ ] kept for documentation / teaching

### Validation tooling

- [ ] Ensure validator prints readable errors
- [ ] Ensure exit codes are meaningful
- [ ] Document how admin/player must use the schema

**Deliverable:**  
You trust the schema more than your memory.

---

## PHASE 2 — Player Core (Logic Before UI)

**Goal:** Player logic exists **without rendering**.

### Player skeleton

- [ ] Create `player/src/index.js` (or `main.ts`)
- [ ] Add top-level comment explaining:
  - [ ] lifecycle
  - [ ] inputs
  - [ ] outputs
- [ ] Parse CLI args or env vars:
  - [ ] config file path
  - [ ] dev / prod mode

### Config loading

- [ ] Load config JSON from disk
- [ ] Validate config using shared validator
- [ ] Fail fast on invalid config
- [ ] Log config metadata (campaignId, priority)

### Internal model

- [ ] Convert raw config into internal structures:
  - [ ] Playlist
  - [ ] RenderItem
- [ ] Sort items deterministically
- [ ] Validate logical constraints (e.g. duplicate order)

**Deliverable:**  
Running the player prints a clean, deterministic playlist summary.

---

## PHASE 3 — Event Model (Simulation First)

**Goal:** Player reacts to events *without hardware*.

### Event definitions

- [ ] Define event types:
  - [ ] IDLE
  - [ ] VISION_PRESENT
  - [ ] NFC_TAP
- [ ] Define event payloads:
  - [ ] studentId
  - [ ] timestamp
- [ ] Decide priority rules between events

### Event input

- [ ] Implement event ingestion via:
  - [ ] CLI input **or**
  - [ ] HTTP endpoint (localhost)
- [ ] Allow manual triggering of events
- [ ] Log every received event

### State machine

- [ ] Define player states:
  - [ ] Idle
  - [ ] Interactive
  - [ ] PlayingCampaign
- [ ] Define legal transitions
- [ ] Reject illegal transitions loudly

**Deliverable:**  
You can trigger events manually and observe state transitions in logs.

---

## PHASE 4 — Scheduling & Time

**Goal:** Time becomes deterministic and testable.

- [ ] Implement campaign priority resolution
- [ ] Decide preemption rules:
  - [ ] Can a campaign interrupt another?
- [ ] Implement duration timers
- [ ] Implement inactivity timeout
- [ ] Ensure return to Idle is guaranteed
- [ ] Log every timer start/stop

**Deliverable:**  
Player behavior is predictable on paper.

---

## PHASE 5 — Rendering (Last, Not First)

**Goal:** Pixels appear only after logic is correct.

### Renderer abstraction (2/02/2026)

- [x] Define renderer interface:
  - [x] renderText
  - [x] renderImage
  - [x] renderVideo
- [x] Create dummy renderer (console output)
- [x] Ensure renderer never owns logic

### Real rendering (3/02/2026 - 9/02/2026)

- [x] Decide rendering technology (browser, HTML, canvas, etc.)
- [?] Load assets safely
- [?] Handle missing assets gracefully 
-> Dans la version actuelle, si un item est manquant/introuvable, un texte est affiché "Image introuvable" etc.
- [x] Fullscreen mode
- [x] Renders items in 'order' and not by array position

### End-to-end wiring (after Admin is ready)

- [ ] Step 1: Admin exposes latest config via `GET /configs` or `GET /configs/{id}`.
- [ ] Step 2: Player fetches config from Admin at startup (optionally poll for updates).
- [ ] Step 3: Player emits render events to the browser (WebSocket or SSE).
- [ ] Step 4: Browser renderer listens and updates DOM with playlist items.
- [ ] Step 5: Verify in Firefox by uploading a config in Admin and seeing live playback.

**Deliverable:**  
Visual output matches internal state exactly.

---

## PHASE 6 — Admin (Control Plane)

**Goal:** Admin produces configs that always validate.

- [ ] Define admin responsibilities explicitly (what Admin does and does NOT do)
  - Why: prevents scope creep and keeps Admin focused on producing valid configs for the Player.
  - Do:
    - Accept config uploads.
    - Validate against shared schema.
    - Store immutable versions and metadata.
    - Provide list/read endpoints for Player or operators.
  - Do NOT:
    - Render content or run player logic.
    - Rewrite configs silently.
    - Depend on player internals beyond the shared contract.

- [ ] Write OpenAPI contract first (v0 admin API)
  - Why: API contract is the handshake between Admin UI/clients and the backend.
  - Include endpoints:
    - `POST /configs` upload a config JSON.
    - `GET /configs` list configs (metadata only).
    - `GET /configs/{id}` fetch a specific config (full JSON).
  - Include response/error shapes:
    - 201 on upload success with `configId`.
    - 400 on validation errors with readable error list.
    - 404 when a configId does not exist.
  - Include schemas:
    - Config payload references shared schema.
    - Metadata object (id, name, createdAt, checksum).

- [ ] Implement minimal API (no UI yet)
  - Why: start with a reliable backend that enforces the contract.
  - Implement routes:
    - Upload (validate, store, return id).
    - List (metadata only).
    - Get by id (full config).
  - Implement consistent error responses.

- [ ] Validate configs on upload (use shared schema)
  - Why: Admin must reject invalid configs before they reach the Player.
  - Use the same AJV validator as in `shared/contract/scripts/validate-config.js`.
  - Return clear, human-readable validation errors in the response.

- [ ] Store configs immutably (append-only)
  - Why: ensures reproducibility and audit trail.
  - Store each upload as a new version with:
    - `configId` (uuid or hash).
    - `createdAt` timestamp.
    - Original JSON (no mutation).
  - Optional: store checksum for integrity and dedupe.

**Deliverable:**  
Admin cannot generate invalid data.

---

## PHASE 7 — Infrastructure & Deployment

**Goal:** System runs unattended.

- [ ] Docker Compose runs locally
- [ ] Nginx routes cleanly
- [ ] Player logs are persistent
- [ ] Systemd service restarts on crash
- [ ] Environment variables documented and minimal

**Deliverable:**  
Power cut → system recovers.

---

## PHASE 8 — Documentation & Demo Readiness

**Goal:** Someone else understands the project.

- [ ] README walkthrough (simple)
- [ ] Architecture diagram
- [ ] Demo script:
  - [ ] Idle
  - [ ] Presence
  - [ ] NFC
- [ ] Known limitations documented

**Deliverable:**  
You can demo calmly, without improvising.

---

## PHASE 9 — Polishing (Optional but Honest)

- [ ] Remove dead code
- [ ] Remove TODOs you will not do
- [ ] Add warnings where assumptions exist
- [ ] Final CI pass

---

## Meta-rule (Important)

If at any point you think:

> “I’ll just quickly hack this”

Stop.  
Add a TODO instead.
