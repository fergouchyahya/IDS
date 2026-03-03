# Player Module Documentation

## Purpose
This document explains:
- Which files make up the Player module
- What each file does
- How modules interact at runtime
- A concrete scenario walkthrough

---

## 1. Player File Inventory

## Entry and Composition
- `src/index.js`
  - Player process entrypoint.
  - Parses CLI/env options.
  - Loads JSON config files.
  - Validates config shape.
  - Starts HTTP server via `createServer`.

- `src/server.js`
  - Composition root.
  - Wires logger, state machine, sync service, router.
  - Creates HTTP server and lifecycle hooks.
  - Re-exports compatibility APIs (`STATE`, `PlayerStateMachine`, etc.).

- `src/router.js`
  - Central route dispatcher.
  - Maps method/path to route handlers.

## Handlers
- `src/handlers/ui.js`
  - Handles `GET /`.
  - Renders full player HTML page.

- `src/handlers/current.js`
  - Handles `GET /current`.
  - Returns current machine state JSON.

- `src/handlers/health.js`
  - Handles `GET /health`.
  - Returns health + uptime + sync status.

- `src/handlers/events.js`
  - Handles `POST /events`.
  - Accepts UI/manual events.
  - Blocks movement events from non-detector endpoint.
  - Loads student campaign from admin on NFC events when needed.

- `src/handlers/detector.js`
  - Handles detector-authenticated endpoints:
    - `POST /detector/movement`
    - `POST /detector/events`
  - Enforces detector token auth.
  - Forwards allowed detector events to state machine.

- `src/handlers/runtime-config.js`
  - Handles `POST /runtime-config`.
  - Applies new runtime config to the state machine.

## Services
- `src/services/config-service.js`
  - Defines `STATE` constants.
  - Normalizes runtime config (current + legacy compatibility).
  - Normalizes detector config with defaults and bounds.
  - Sorts campaign items by order.

- `src/services/state-machine.js`
  - Core business/state transition engine.
  - Handles events and transitions.
  - Maintains current state, campaign, item index, student context.
  - Manages inactivity timeout.

- `src/services/render-service.js`
  - Builds complete HTML output for player UI.
  - Renders header/viewport/footer/debug panel.
  - Injects main client script and detector script.

- `src/services/admin-sync-service.js`
  - Pulls runtime config from admin endpoint.
  - Pulls generated student campaign by NFC UID.
  - Tracks sync health and timer lifecycle.

## Detector Modules
- `src/detector/event-utils.js`
  - Classifies movement input events.
  - Validates which detector events are allowed.

- `src/detector/client-script.js`
  - Encapsulates browser-side motion detection logic.
  - Builds detector script injected by render service.

## Utils
- `src/utils/http-response.js`
  - HTML response helper (`html(...)`).

---

## 2. Runtime Interaction Flow

```text
index.js
  -> server.createServer(...)
      -> state-machine (core runtime state)
      -> admin-sync-service (optional admin pull)
      -> router
          -> handlers/*
              -> state-machine
              -> render-service (UI path)
              -> detector utils (detector paths)
```

### Key dependency rules
- Handlers do not create global state; they operate via injected `deps` from `server.js`.
- Router only dispatches; no domain logic.
- State transitions are centralized in `state-machine.js`.
- Detector browser algorithm is isolated in `detector/client-script.js`.

---

## 3. API Endpoints and Ownership

- `GET /` -> `handlers/ui.js`
- `GET /current` -> `handlers/current.js`
- `GET /health` -> `handlers/health.js`
- `POST /events` -> `handlers/events.js`
- `POST /detector/movement` -> `handlers/detector.js`
- `POST /detector/events` -> `handlers/detector.js`
- `POST /runtime-config` -> `handlers/runtime-config.js`

---

## 4. Scenario Example (End-to-End)

## Scenario: Idle -> Menu -> Student Info (NFC) -> Auto return Idle

### Initial conditions
- State machine starts in `IDLE`.
- Runtime config contains `idleCampaign`, `menuCampaign`, visitor campaign and students list.
- Admin sync may be enabled.

### Step-by-step
1. Browser opens `GET /`.
   - `ui.js` calls `render-service.renderUI(...)`.
   - Page displays IDLE content.

2. Movement is detected by detector script.
   - Detector script posts `POST /detector/events` with `type: movement_detected` and detector token.
   - `handlers/detector.js` validates token + event type.
   - Event goes to `stateMachine.handleEvent(...)`.
   - Transition: `IDLE -> MENU`.

3. User taps NFC card in MENU.
   - UI posts `POST /events` with `type: nfc_tap` and UID.
   - `handlers/events.js` runs optional admin sync and pulls student campaign (if admin configured).
   - State machine loads/updates student runtime campaign.
   - Transition: `MENU -> STUDENT_INFO`.

4. User stops interacting.
   - State machine inactivity timer expires.
   - Transition: `STUDENT_INFO -> IDLE`.

5. Frontend polling detects state/item changes.
   - Browser reloads when `/current` differs from initial page snapshot.

### Observability
- Health endpoint shows sync status and current runtime snapshot.
- Logger records sync failures and significant state operations.

---

## 5. What Was Removed

Removed non-runtime helper scripts from `player/scripts/`:
- `run-dev.sh`
- `run-guided-flow.sh`
- `run-serve.sh`

Reason:
- Not required by player runtime startup.
- Not referenced by package scripts, Makefile, or deploy service definitions.

---

## 6. Recommended Next Docs

1. Add `player/API.md` with request/response examples per endpoint.
2. Add `player/STATE_MACHINE.md` with transition table.
3. Add `player/DETECTOR_TUNING.md` explaining detector config knobs.
