# IDS Roadmap

Current planning baseline as of 2026-03-09.

## Intent

The next phase is not feature sprawl. The priority is to turn the current refactored codebase into a stable base for deployment and hardware work.

The order matters:

1. Stabilize and land the current cleanup work.
2. Harden Raspberry Pi deployment.
3. Refactor admin persistence to an async repository boundary.
4. Add SQL storage behind that boundary.
5. Add the NFC hardware module in the player.

## Phase 0: Stabilize Current Branch

Goal: finish the current cleanup branch cleanly before adding more scope.

Tasks:

- Commit the current docs, admin UI cleanup, and broader test coverage as one stabilization change.
- Keep the API contract frozen unless a change is intentional and documented in [`API_CONTRACT_BASELINE.md`](/home/fergyah/School/S8/PROJ/Project/ids/API_CONTRACT_BASELINE.md).
- Merge this work before starting SQL or NFC implementation.

Exit criteria:

- `./scripts/verify-all.sh` passes.
- The current branch is no longer carrying uncommitted cleanup work.
- The repo has one truthful README and one truthful roadmap.

## Phase 1: Raspberry Pi Deployment Hardening

Goal: make deployment repeatable and operationally sane on the Pi.

Tasks:

- Add `docs/deployment/pi.md` with install, upgrade, restart, verification, and rollback steps.
- Update [`deploy/pi/env/ids.env`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/env/ids.env) to include:
  - `IDS_PUBLIC_ADMIN_URL`
  - `IDS_ADMIN_DATA_DIR`
  - any detector or future NFC-related env vars that are actually supported
- Harden systemd units in:
  - [`deploy/pi/systemd/ids-admin.service`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/systemd/ids-admin.service)
  - [`deploy/pi/systemd/ids-player.service`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/systemd/ids-player.service)
- Add a post-deploy smoke-check script or checklist:
  - admin `/health`
  - admin `/api/state`
  - admin `/runtime-config`
  - player `/health`
  - one static admin asset
- Fix logging so services report the actual bound port, not just the requested one.

Exit criteria:

- A fresh Pi setup can be reproduced from docs.
- Media URLs are stable behind the deployed hostname.
- Restart and rollback steps are documented and tested.

## Phase 2: Admin Persistence Boundary Refactor

Goal: prepare the admin backend for SQL without forcing a risky rewrite later.

Tasks:

- Convert the admin storage/repository/service path to async.
- Introduce a repository interface with a file-backed implementation first.
- Keep existing HTTP routes and response shapes unchanged.
- Move all direct persistence assumptions behind the repository boundary.
- Expand integration tests to run against the repository abstraction, not only current storage internals.

Why this phase exists:

- The current admin storage path is synchronous.
- SQL integration will be painful and error-prone if it is attempted before this refactor.

Exit criteria:

- Handlers and services can await persistence operations.
- File storage still works through the new abstraction.
- Existing integration tests still pass with the refactored boundary.

## Phase 3: SQL Storage Integration

Goal: add a database-backed admin persistence implementation safely.

Tasks:

- Choose the DB strategy:
  - SQLite if the Pi is the only operational target and low-ops simplicity matters most.
  - PostgreSQL if remote hosting, shared access, or richer operational tooling is needed.
- Add DB config to shared/admin config handling.
- Create migrations and schema for:
  - `campaigns`
  - `campaign_items`
  - `students`
  - `student_profiles`
  - `settings`
  - `active_config`
  - optional `media_assets`
- Implement a SQL repository adapter.
- Keep file storage available during migration until parity is proven.
- Add repository-level integration tests for both file and SQL backends.

Exit criteria:

- The SQL backend passes the same functional checks as the file backend.
- HTTP behavior is unchanged from the admin client’s perspective.
- Migration and rollback steps are documented.

## Phase 4: NFC Module in the Player

Goal: move from simulated `nfc_tap` events to a real hardware-backed NFC service.

Tasks:

- Add `player/src/services/nfc-service.js`.
- Define a hardware adapter boundary:
  - `start()`
  - `stop()`
  - `onTag(callback)`
  - `getHealth()`
- Start with a mock adapter for development and test coverage.
- Normalize all tag reads into the existing player event shape:
  - `{ type: "nfc_tap", nfcUid }`
- Add debounce, duplicate suppression, and error handling.
- Expose NFC health in player `/health`.
- Add structured logging for tag read success/failure.
- Only after that, integrate the actual Pi reader hardware module.

Exit criteria:

- The player can run with mock NFC and real NFC adapters behind the same service interface.
- NFC failures do not crash the player.
- Player health output shows NFC readiness clearly.

## Phase 5: Deployment of SQL + NFC Together

Goal: combine the two larger changes only after both are independently stable.

Tasks:

- Extend Pi env and systemd config for DB and NFC runtime requirements.
- Add startup ordering or readiness checks if external DB is used.
- Add smoke tests that verify:
  - admin startup
  - DB connectivity
  - player startup
  - runtime-config sync
  - NFC event ingestion path
- Document rollback for both DB-backed admin and NFC-enabled player.

Exit criteria:

- Pi deployment supports the chosen DB backend and NFC hardware.
- Startup and recovery procedures are written down and tested.

## Git Plan

Do not stack all of this on one long-lived branch.

Recommended branch sequence:

1. `chore/stabilize-cleanup-baseline`
2. `chore/pi-deploy-hardening`
3. `refactor/admin-async-repository`
4. `feat/admin-sql-storage`
5. `feat/player-nfc-service`
6. `chore/pi-sql-nfc-rollout`

Rules:

- Keep deployment, SQL, and NFC changes in separate branches until integration time.
- Prefer small reviewable commits, not new snapshot commits.
- Merge each phase only after its tests and docs are in place.
- Rebase or merge from `main` regularly, but avoid mixing unrelated concerns in one PR.

## Decision Rule

If a task reduces ambiguity around deployment, persistence, or hardware integration, it comes first.

If a task adds new scope before those boundaries are stable, defer it.
