# Player Package

The player package owns the signage runtime:

- HTTP server and route handling
- state machine and inactivity flow
- runtime-config loading and normalization
- detector-authenticated event ingestion
- HTML rendering for the signage UI

## Entry Points

- [`src/index.js`](/home/fergyah/School/S8/PROJ/Project/ids/player/src/index.js) parses startup options and loads config.
- [`src/server.js`](/home/fergyah/School/S8/PROJ/Project/ids/player/src/server.js) wires the state machine, router, sync service, and renderer.

## Main Layers

- `src/handlers/` - endpoint handlers
- `src/services/` - state machine, rendering, config, admin sync
- `src/detector/` - detector client script and event filtering helpers
- `src/utils/` - response helpers

## Verification

```bash
npm --prefix player test
```

See [`PLAYER_MODULES_DOCUMENTATION.md`](/home/fergyah/School/S8/PROJ/Project/ids/player/PLAYER_MODULES_DOCUMENTATION.md) for the detailed runtime walkthrough.
