# Next Branch TODO - Refactors + DB Automation + NFC + Deployment

**Target branch:** `feature/db-automation-nfc-deploy`  
**Goal:** Finish remaining cleanup and deliver DB-backed campaign automation, NFC detection module integration, and production-ready deployment flow.

## 1. Remaining Refactor Cleanup

- [ ] Reduce `admin/public/admin-ui.js` from current residual orchestration to a thin composition layer.
- [ ] Extract remaining editor helpers (block mutation + duplicate mode) into dedicated modules.
- [ ] Add missing module-level tests for new UI services:
  - `services/actions.js`
  - `services/editor-state.js`
  - `services/ui-events.js`
- [ ] Add final `admin/public/app.js` wiring test (boot + module availability).
- [ ] Add/update architecture docs:
  - [ ] Admin UI module map
  - [ ] Data flow (state store -> selectors -> components -> actions)

## 2. Database Foundation (for Campaign Automation)

- [ ] Choose DB engine + access pattern (e.g. PostgreSQL + query builder/ORM).
- [ ] Add `shared/config` entries for DB connection env vars.
- [ ] Create DB schema/migrations:
  - [ ] campaigns
  - [ ] campaign_items
  - [ ] students
  - [ ] automation_rules
  - [ ] nfc_events (optional but recommended for audit/debug)
- [ ] Implement admin data layer abstraction:
  - [ ] keep current storage API stable
  - [ ] add DB-backed repository implementation
  - [ ] add fallback strategy (file storage in dev if needed)
- [ ] Add integration tests against DB-backed repository.

## 3. Campaign Automation from Database

- [ ] Define automation rule model:
  - [ ] trigger type (time/event/NFC/profile condition)
  - [ ] target campaign mapping
  - [ ] priority/conflict resolution
- [ ] Implement automation service in admin backend:
  - [ ] evaluate rules
  - [ ] select/compose active campaign set
  - [ ] publish runtime-config projection
- [ ] Add admin endpoints for automation management:
  - [ ] create/update/delete rules
  - [ ] simulate/evaluate rule outcome
- [ ] Add UI panel for rule management (later slice if backend-first).
- [ ] Add tests:
  - [ ] deterministic rule evaluation tests
  - [ ] conflict resolution tests
  - [ ] regression tests for existing manual publish flow

## 4. NFC Detection Module

- [ ] Define NFC module boundary in player:
  - [ ] hardware adapter interface
  - [ ] event normalization contract
  - [ ] retry/error handling behavior
- [ ] Implement NFC service module (`player/src/services/nfc-service.js`).
- [ ] Integrate NFC events into existing event pipeline/state machine.
- [ ] Add anti-noise protections:
  - [ ] debounce/duplicate tap filtering
  - [ ] invalid UID handling
  - [ ] timeout/fallback behavior
- [ ] Add health observability:
  - [ ] NFC module status in `/health`
  - [ ] structured logs for tap lifecycle
- [ ] Add tests:
  - [ ] simulated NFC adapter unit tests
  - [ ] state transition integration tests (`MENU -> STUDENT_INFO`, invalid UID, repeated UID)

## 5. Deployment (Systemd + Environment + Rollout)

- [ ] Prepare deployment config for DB + NFC:
  - [ ] update `deploy/pi/env/ids.env`
  - [ ] validate env var parsing/startup failure messages
- [ ] Update service files:
  - [ ] `deploy/pi/systemd/ids-admin.service`
  - [ ] `deploy/pi/systemd/ids-player.service`
  - [ ] add startup ordering/dependencies (network/db readiness)
- [ ] Add deployment scripts/checklist:
  - [ ] migrate DB
  - [ ] restart services
  - [ ] verify health endpoints
  - [ ] rollback commands
- [ ] Add post-deploy smoke checks:
  - [ ] admin health + state
  - [ ] player health + runtime-config sync
  - [ ] NFC event path sanity

## 6. Suggested PR Sequence (Next Branch)

1. `chore: db config + migration scaffold`
2. `refactor: repository abstraction (file + db adapters)`
3. `feat: campaign automation rules backend`
4. `feat: automation management endpoints + tests`
5. `feat: nfc service module + player integration`
6. `test: nfc + automation integration coverage`
7. `chore: systemd/env deploy updates + rollout docs`
8. `refactor: final admin-ui orchestration slimming`

## 7. Definition of Done

- [ ] DB-backed campaign data path is production-usable.
- [ ] Automation rules can drive campaign selection deterministically.
- [ ] NFC module is integrated, observable, and tested.
- [ ] Deployment artifacts are updated and documented for repeatable rollout.
- [ ] Full test suite + smoke checks pass before merge.
