# IDS Plan of Work

Based on repo state as of 2026-03-12.

## Phase 0: Stabilize Current Branch

**Branch:** `chore/stabilize-cleanup-baseline`
**Effort:** Small — closest to done

| # | Task | Status |
|---|------|--------|
| 1 | Fix failing `admin-api.test.js` so `./scripts/verify-all.sh` passes | Not started |
| 2 | Fix malformed `deploy/pi/smoke-check.sh` (corrupted `PLAYER_BASE_URL`) | Not started |
| 3 | Commit `REMAINING_WORK_BY_DIFFICULTY.md` and any uncommitted cleanup | Not started |
| 4 | Verify `README.md` and `ROADMAP.md` are truthful and aligned | Not started |
| 5 | Confirm API contract is frozen per `API_CONTRACT_BASELINE.md` | Not started |

**Exit criteria:** `make verify-all` green, no uncommitted work, docs are accurate.

## Phase 1: Raspberry Pi Deployment Hardening

**Branch:** `chore/pi-deploy-hardening`
**Effort:** Small-Medium — partially landed

| # | Task |
|---|------|
| 1 | Fix and validate the smoke-check script end-to-end |
| 2 | Harden systemd units — verify restart/crash recovery behavior |
| 3 | Confirm `deploy/pi/env/ids.env` only includes actually-supported vars (`IDS_PUBLIC_ADMIN_URL`, `IDS_ADMIN_DATA_DIR`, etc.) |
| 4 | Fix player logging to report the **actual** bound port (admin already does this) |
| 5 | Ensure media URLs are stable behind the deployed hostname |
| 6 | Test fresh Pi setup from `docs/deployment/pi.md` — document restart and rollback |

**Exit criteria:** Reproducible Pi setup from docs, stable media URLs, restart/rollback documented.

## Phase 2: Admin Persistence Boundary Refactor

**Branch:** `refactor/admin-async-repository`
**Effort:** Medium-Large — wide refactor

| # | Task |
|---|------|
| 1 | Define a repository interface (campaigns, students, settings, active config) |
| 2 | Convert admin handlers → services → storage path from sync to async (`await`) |
| 3 | Implement a file-backed repository adapter behind the new interface |
| 4 | Keep all HTTP routes and response shapes unchanged |
| 5 | Refactor integration tests to target the repository abstraction, not storage internals |
| 6 | Verify all existing tests still pass through the new boundary |

**Exit criteria:** Handlers/services use `await`, file storage works through the abstraction, tests green.

## Phase 3: SQL Storage Integration

**Branch:** `feat/admin-sql-storage`
**Effort:** Large — biggest backend change

| # | Task |
|---|------|
| 1 | Choose DB: SQLite (simpler, Pi-only) vs PostgreSQL (remote/shared access) |
| 2 | Add DB config to shared/admin config handling |
| 3 | Create migrations and schema: `campaigns`, `campaign_items`, `students`, `student_profiles`, `settings`, `active_config` |
| 4 | Implement SQL repository adapter with parity to file storage |
| 5 | Add repository-level integration tests for both file and SQL backends |
| 6 | Keep file storage available during migration period |
| 7 | Document migration and rollback steps |

**Exit criteria:** SQL backend passes same checks as file backend, HTTP behavior unchanged, migration docs in place.

## Phase 4: NFC Module in the Player

**Branch:** `feat/player-nfc-service`
**Effort:** Medium — player already supports simulated `nfc_tap` events

| # | Task |
|---|------|
| 1 | Create `player/src/services/nfc-service.js` with `start()`, `stop()`, `onTag(callback)`, `getHealth()` |
| 2 | Start with a mock adapter for dev/testing |
| 3 | Normalize all tag reads into `{ type: "nfc_tap", nfcUid }` |
| 4 | Add debounce, duplicate suppression, and error handling |
| 5 | Expose NFC readiness in player `/health` |
| 6 | Add structured logging for tag read success/failure |
| 7 | Integrate real Pi NFC reader hardware behind the adapter boundary |

**Exit criteria:** Mock and real NFC adapters work behind the same interface, NFC failures don't crash player, health shows NFC status.

## Phase 5: Deployment of SQL + NFC Together

**Branch:** `chore/pi-sql-nfc-rollout`
**Effort:** Medium — integration and operations

| # | Task |
|---|------|
| 1 | Extend Pi env and systemd config for DB + NFC runtime requirements |
| 2 | Add startup ordering / readiness checks for external DB |
| 3 | Add combined smoke tests: admin startup, DB connectivity, player startup, runtime-config sync, NFC event ingestion |
| 4 | Document rollback for both DB-backed admin and NFC-enabled player |

**Exit criteria:** Pi deployment supports chosen DB + NFC hardware, startup/recovery procedures documented and tested.

## Key Constraints

- **API contract is frozen** — no route/method/response shape changes without documenting in `API_CONTRACT_BASELINE.md`.
- **One phase per branch** — don't stack work on long-lived branches.
- **Small reviewable commits** — no snapshot commits.
- **Merge each phase only after tests and docs are in place.**
- **Decision rule:** if it reduces ambiguity around deployment, persistence, or hardware integration, it comes first. New scope before those boundaries are stable gets deferred.

## Git Branch Sequence

1. `chore/stabilize-cleanup-baseline`
2. `chore/pi-deploy-hardening`
3. `refactor/admin-async-repository`
4. `feat/admin-sql-storage`
5. `feat/player-nfc-service`
6. `chore/pi-sql-nfc-rollout`
