# IDS Deployment View

This document describes how IDS is expected to run in deployment-oriented environments.

## Current practical deployment model
- `Admin` runs as a Node.js HTTP service (default `127.0.0.1:8081`).
- `Player` runs as a Node.js HTTP service (default `127.0.0.1:7070`), serving:
  - `/` browser renderer page
  - `/events` event ingestion API
  - `/render-stream` SSE render stream
- `Nginx` can be used as an HTTP edge/reverse proxy in front of services.

## Data flow
1. Operator uploads config to Admin (`POST /configs`).
2. Player fetches config from Admin at startup.
3. Sensor simulation (or real source later) posts events to Player.
4. Player scheduler/state logic emits render events.
5. Browser page consumes SSE and updates displayed content.

## Operational notes
- Shared schema remains the contract boundary (`shared/contract/schema/config.schema.json`).
- Admin stores config uploads append-only (`admin/data/configs.jsonl`).
- Player can run in guided mode for deterministic UX demos.

## Next deployment hardening steps
- Add persistent storage path strategy for admin data and logs.
- Move from localhost-only bindings to secured LAN bindings for device deployment.
- Add health endpoints and startup dependency checks.
