# IDS Refactoring Execution Plan (Kickoff)

**Date:** 2026-03-03  
**Input docs reviewed:** `REFACTORING_SUMMARY.md`, `REFACTORING_PLAN.md`, `REFACTORING_QUICK_GUIDE.md`, `PHASE_1_IMPLEMENTATION.md`  
**Purpose:** Convert planning docs into an executable, low-risk refactoring rollout.

## 1) Current Baseline (From Code)

- `player/src/server.js` is the main hotspot (~1637 LOC, mixed HTTP + state + rendering + detector config).
- `admin/public/admin-ui.js` is large (~1717 LOC, mixed rendering/state/network logic).
- `admin/src/storage.js` is large (~735 LOC, domain logic + persistence + validation behavior).
- `admin/src/server.js` (~244 LOC) and `admin/src/router.js` (~231 LOC) already split, but handlers/services are not yet extracted.
- Shared utilities exist (`shared/utils/logger.js`, `shared/utils/http-helpers.js`) but foundation pieces from plan are still missing:
  - No centralized `shared/config`.
  - No shared error hierarchy (`shared/errors`).
  - No shared validation framework (`shared/validation`).
- No committed test suite currently detected.

## 2) Refactor Strategy

1. Stabilize behavior first (golden-path tests + snapshots).
2. Build shared foundation once (config/errors/validation/logging contracts).
3. Refactor server code by extraction, not rewrite (small PRs, each behavior-preserving).
4. Move from monolith files to layered modules:
   - `server -> router -> handlers -> services -> storage/data`
5. Keep public API paths and payload shapes stable until Phase 5 hardening.

## 3) Delivery Model

## Branching

- `refactor/phase-0-safety`
- `refactor/phase-1-foundation`
- `refactor/phase-2-admin-extraction`
- `refactor/phase-3-player-extraction`
- `refactor/phase-4-admin-ui-modularization`
- `refactor/phase-5-hardening-docs`

## PR constraints

- Target PR size: 150-350 LOC net change.
- One concern per PR.
- Every PR must include:
  - behavior checks
  - rollback note
  - updated docs/changelog line

## 4) Execution Phases

## Phase 0: Safety Net + Baseline (2-3 days)

**Goal:** Prevent regressions before structural moves.

### Tasks

1. Add baseline smoke tests (Node test runner):
   - Admin: `/health`, `/api/state`, create/update/delete campaign flow.
   - Player: `/health`, `/current`, event transition basic flow.
2. Capture golden response fixtures for critical endpoints.
3. Add simple scripts for local verification in each package.
4. Add temporary request/response tracing toggle via env.

### Exit criteria

- Can run baseline tests locally and get deterministic pass/fail.
- Golden fixtures committed for top flows.

---

## Phase 1: Shared Foundation (4-5 days)

**Goal:** Introduce cross-cutting building blocks used by admin + player.

### Tasks

1. Create `shared/config/index.js`
   - schema-based env parsing
   - typed getters for admin/player/common
   - startup validation errors
2. Create `shared/errors/index.js`
   - `AppError`, `ValidationError`, `NotFoundError`, `ConflictError`, `InternalError`
   - `errorToResponse`
3. Create `shared/validation/index.js`
   - `validateField`, `validateObject`
   - validators for campaign/event/media
4. Upgrade `shared/utils/logger.js`
   - consistent signature (support `error(message, error, meta)`)
   - log level control and correlation id support
5. Update entry points:
   - `admin/src/index.js`
   - `player/src/index.js`
   to consume shared config/logger.

### Exit criteria

- Both services boot using shared config.
- Errors and validation share one framework.
- No direct `process.env` reads outside config layer (except bootstrapping edge cases).

---

## Phase 2: Admin Backend Extraction (5-7 days)

**Goal:** Split admin logic into handlers/services without changing API behavior.

### Target structure

- `admin/src/middleware/`
- `admin/src/handlers/`
- `admin/src/services/`
- keep `admin/src/router.js` and `admin/src/server.js` thin

### Task sequence (strict)

1. Extract pure helpers from `admin/src/server.js`:
   - multipart parsing
   - mime helpers
   - filename sanitize helpers
2. Create handlers by endpoint group:
   - `campaigns`, `media`, `settings`, `students`, `health`, `state`
3. Move business logic from router/storage touchpoints into services:
   - campaign service
   - student service
   - media service
4. Reduce `admin/src/router.js` to route mapping + delegation.
5. Reduce `admin/src/server.js` to HTTP wiring and middleware chain.

### Exit criteria

- No business logic in `server.js`.
- Router file is mostly route dispatch.
- Existing admin API golden tests pass unchanged.

---

## Phase 3: Player Backend Extraction (6-8 days)

**Goal:** Decompose `player/src/server.js` safely.

### Target structure

- `player/src/services/state-machine.js`
- `player/src/services/render-service.js`
- `player/src/services/config-service.js`
- `player/src/handlers/{ui,current,events,health,debug}.js`
- `player/src/router.js`

### Task sequence (strict)

1. Extract non-HTTP pure utilities first:
   - config normalization
   - detector config normalization
2. Extract state machine module.
3. Extract rendering module (`renderUI` + section renderers).
4. Add handlers and router.
5. Shrink `player/src/server.js` to composition/bootstrap.

### Exit criteria

- `player/src/server.js` under 300 LOC.
- State transitions validated by tests.
- Render outputs still match golden HTML snapshots for key states.

---

## Phase 4: Admin UI Modularization (5-7 days)

**Goal:** Split `admin/public/admin-ui.js` into components/services.

### Target structure

- `admin/public/index.html`
- `admin/public/styles.css`
- `admin/public/app.js`
- `admin/public/components/*.js`
- `admin/public/services/*.js`

### Task sequence

1. Extract static HTML skeleton and CSS first (no behavior change).
2. Extract API client and state manager.
3. Move feature groups one by one:
   - campaign editor
   - block builder
   - media uploader
   - student manager
   - settings panel
4. Keep global integration in `app.js`.

### Exit criteria

- No single UI file above 400 LOC.
- UI smoke flow: create campaign + upload media + save settings.

---

## Phase 5: Hardening, Docs, Cleanup (3-4 days)

**Goal:** Close quality gaps and lock in maintainability.

### Tasks

1. Add/finish docs:
   - `CODING_STANDARDS.md`
   - ADRs in `docs/adr/`
   - API docs and dev guide
2. Add CI gates:
   - test command for admin/player
   - optional lint + formatting checks
3. Remove dead code and migration shims.
4. Final profiling and log-noise reduction.

### Exit criteria

- Stable test baseline.
- Clear contributor onboarding path.
- Refactor complete without API regressions.

## 5) First 10 PRs (Concrete Start)

1. `phase-0`: Add admin/player smoke tests + fixture harness.
2. `phase-0`: Add golden fixture snapshots for critical endpoints.
3. `phase-1`: Introduce `shared/errors` and wire into admin response path.
4. `phase-1`: Introduce `shared/validation` and migrate campaign validation.
5. `phase-1`: Introduce `shared/config`; migrate `admin/src/index.js`.
6. `phase-1`: Migrate `player/src/index.js` to shared config.
7. `phase-1`: Upgrade logger API + correlation-id propagation.
8. `phase-2`: Extract admin media helpers to `admin/src/utils/`.
9. `phase-2`: Add `admin/src/handlers/campaigns.js`; router delegates.
10. `phase-2`: Add `admin/src/services/campaign-service.js`; remove logic from router/storage touchpoints.

## 6) Quality Gates (Per PR)

- All affected tests pass.
- No endpoint contract change unless explicitly planned.
- New module has JSDoc header and exported API docs.
- Logging added at boundaries (request start, business mutation, error path).
- Any sync I/O introduced in request path must be justified.

## 7) Risks and Mitigations

- **Risk:** Hidden behavior regressions in large files.  
  **Mitigation:** Golden fixtures + smoke tests before extraction.

- **Risk:** Team stalls due to broad changes.  
  **Mitigation:** Small PR slicing and strict module sequence.

- **Risk:** Refactor churn without visible progress.  
  **Mitigation:** Track completion by LOC reduction + module extraction count + passing baseline.

## 8) Done Definition (Project)

- `player/src/server.js` and `admin/public/admin-ui.js` decomposed into modules.
- Shared foundation (`config/errors/validation/logger`) used by both services.
- Baseline tests exist and pass in admin and player packages.
- API behavior maintained (or intentionally versioned/documented).
- Documentation updated for architecture and contributor workflow.

## 9) Immediate Next Action (Today)

1. Create `refactor/phase-0-safety`.
2. Implement minimal smoke tests for admin and player health/current/state flows.
3. Capture first golden fixtures.
4. Open PR #1 and merge before touching runtime logic.
