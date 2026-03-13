# Player API

This reference describes the player HTTP surface as implemented by [`player/src/router.js`](/home/fergyah/School/S8/PROJ/Project/ids/player/src/router.js).

## Contract Policy

- Unknown routes return `404 { "error": "not_found" }`.
- The player API is mostly state-oriented: responses describe the current in-memory runtime status.
- Detector endpoints are intentionally separate from general event endpoints so motion input can be authenticated.

## Display And Status

### `GET /`

- Handler: `handlers/ui.js`
- Purpose: render the current signage page as HTML
- Query parameter:
  - `debug=1` forces debug UI
- Response: `200 text/html`

### `GET /current`

- Handler: `handlers/current.js`
- Purpose: return the current state-machine snapshot
- Response body:
  - `state`
  - `campaignId`
  - `campaignName`
  - `itemIndex`
  - `item`
  - `currentStudentUid`
  - `inactivityTimeoutMs`
  - `runtimeUpdatedAt`

### `GET /health`

- Handler: `handlers/health.js`
- Purpose: return service health, current runtime state, and admin sync status
- Response body includes:
  - `status`
  - `timestamp`
  - `uptimeMs`
  - `runtime`
  - `adminSync`

## General Event Ingestion

### `POST /events`

- Handler: `handlers/events.js`
- Purpose: accept manual or UI-triggered events
- Behavior:
  - parses JSON body
  - rejects movement events on this route
  - optionally syncs runtime from admin
  - optionally loads a generated student campaign for NFC-like events
  - forwards the event to the state machine
- Success response: `200` with the full `handleEvent()` result:
  - `status`
  - `normalizedEvent`
  - `action`
  - current runtime snapshot fields
- Common failure:
  - movement events return `403 { error: "movement_event_requires_detector" }`

Accepted event aliases are normalized by the state machine. Examples:

- `movement`, `vision_present` -> `movement_detected`
- `visitor_detected` -> `visitor_selected`
- `nfc` -> `nfc_tap`
- `right_hand_move` -> `scroll_next`
- `left_hand_move` -> `scroll_prev`

## Detector-Authenticated Endpoints

### Authentication Model

The player generates a random detector token at startup. Detector requests must send it in:

- `x-detector-token`

Wrong or missing tokens return:

- `403 { error: "forbidden_detector_source" }`

### `POST /detector/movement`

- Handler: `handlers/detector.js`
- Purpose: specialized movement endpoint that always emits `movement_detected`
- Optional body field:
  - `confidence`
- Behavior:
  - validate detector token
  - parse JSON
  - optionally sync runtime from admin
  - send `movement_detected` to the state machine

### `POST /detector/events`

- Handler: `handlers/detector.js`
- Purpose: authenticated detector event endpoint for allowed event types
- Allowed event types are filtered by `player/src/detector/event-utils.js`
- Common failure:
  - unsupported event type returns `400 { error: "invalid_detector_event_type" }`

## Runtime Config Updates

### `POST /runtime-config`

- Handler: `handlers/runtime-config.js`
- Purpose: replace the current runtime config in memory
- Success response:
  - `200 { status: "ok", current: <state snapshot> }`
- Failure:
  - invalid config returns `400 { error: "invalid_runtime_config" }`

## Status Snapshot Shape

The core runtime snapshot returned by `/current` and embedded in other responses comes from `PlayerStateMachine.getStatus()`:

- `state`
- `campaignId`
- `campaignName`
- `itemIndex`
- `item`
- `currentStudentUid`
- `inactivityTimeoutMs`
- `runtimeUpdatedAt`

The richer event response from `handleEvent()` adds:

- `status`
- `normalizedEvent`
- `action`

## Operational Notes

- The player only binds to `127.0.0.1` by default.
- When `IDS_ADMIN_URL` is configured, the player periodically refreshes runtime config from admin.
- Student-specific campaigns can be loaded lazily from admin during NFC-style interactions.
