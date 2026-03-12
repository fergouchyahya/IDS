# Remaining IDS Work by Difficulty

This ranking is based on the current repository state as of 2026-03-10, not only the original roadmap order.

## Phases: Harder to Simpler

1. **Phase 3: SQL Storage Integration**
2. **Phase 2: Admin Persistence Boundary Refactor**
3. **Phase 5: Deployment of SQL + NFC Together**
4. **Phase 4: NFC Module in the Player**
5. **Phase 1: Raspberry Pi Deployment Hardening**
6. **Phase 0: Stabilize Current Branch**

## Why This Order

- **Phase 3** is the largest remaining backend change: schema, migrations, repository adapter, backend parity, config work, and dual-backend testing.
- **Phase 2** is a wide refactor across admin handlers, services, and storage because the admin boundary is still synchronous even though low-level file persistence already uses async writes internally.
- **Phase 5** is mostly integration and operations complexity. It becomes hard because it combines DB rollout and NFC rollout at the same time.
- **Phase 4** is substantial, but the player already supports simulated `nfc_tap` events, so the missing work is narrower than a full new feature area.
- **Phase 1** is partly landed already: Pi docs, env template, systemd units, and a smoke-check script already exist.
- **Phase 0** is the smallest remaining scope, but it is still incomplete because verification is not yet clean.

## Tasks Within Each Phase: Harder to Simpler

### Phase 3: SQL Storage Integration

1. Implement a SQL repository adapter with parity to file storage.
2. Create migrations and schema for campaigns, students, settings, active config, and related tables.
3. Add repository-level integration tests for both file and SQL backends.
4. Add DB configuration to shared/admin config handling.
5. Keep file storage available during migration and parity validation.
6. Document migration and rollback steps.
7. Choose SQLite vs PostgreSQL.

### Phase 2: Admin Persistence Boundary Refactor

1. Convert handlers, services, and storage access to an async boundary without changing HTTP behavior.
2. Introduce a repository interface and move persistence assumptions behind it.
3. Refactor integration tests to target the repository abstraction instead of storage internals.
4. Keep the file-backed implementation working through the new boundary.

### Phase 5: Deployment of SQL + NFC Together

1. Add startup ordering and readiness handling for DB-backed deployment.
2. Extend Pi env and systemd config for DB and NFC runtime requirements.
3. Add combined smoke tests for admin, DB connectivity, player startup, runtime-config sync, and NFC ingestion.
4. Document rollback for DB-backed admin and NFC-enabled player.

### Phase 4: NFC Module in the Player

1. Integrate the real Pi NFC reader behind a hardware adapter boundary.
2. Add `player/src/services/nfc-service.js` with `start()`, `stop()`, `onTag(callback)`, and `getHealth()`.
3. Add debounce, duplicate suppression, and error handling.
4. Expose NFC readiness in player `/health`.
5. Add structured logging for NFC success and failure.
6. Start with a mock adapter for development and test coverage.
7. Normalize reads into `{ type: "nfc_tap", nfcUid }`.

### Phase 1: Raspberry Pi Deployment Hardening

1. Fix and validate the smoke-check flow.
2. Finish systemd hardening and verify restart behavior.
3. Document and test restart and rollback on a fresh Pi setup.
4. Confirm the env template only includes supported vars.
5. Fix player logging so it reports the actual bound port.
6. Keep generated media URLs stable behind the deployed hostname.

### Phase 0: Stabilize Current Branch

1. Get `./scripts/verify-all.sh` passing.
2. Resolve current uncommitted cleanup work.
3. Confirm the README and roadmap are both truthful and aligned.
4. Keep the API contract frozen unless intentionally documented in `API_CONTRACT_BASELINE.md`.

## Current Repo Signals Behind This Ranking

- The git repo root is `ids/`, not the workspace root.
- The repo currently has a modified deployment file: `deploy/pi/smoke-check.sh`.
- The smoke-check script is currently malformed and needs cleanup before Phase 1 can be considered complete.
- `npm --prefix ids/admin test` is not fully green right now because `admin-api.test.js` fails.
- Admin persistence is still synchronous at the service/storage API boundary.
- Admin logging already reports the actual bound port, but player logging still reports the requested port.
- NFC support is currently simulated/event-based; there is no dedicated hardware NFC service module yet.
