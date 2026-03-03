# IDS Refactoring Next Steps Plan (Current-State Based)

**Date:** 2026-03-03  
**Purpose:** Turn the existing refactor progress into an execution-ready cleanup plan based on what is already in the repo.

## 1. Inputs Reviewed

- `REFACTORING_SUMMARY.md`
- `REFACTORING_PLAN.md`
- `REFACTORING_QUICK_GUIDE.md`
- `PHASE_1_IMPLEMENTATION.md`
- `REFACTORING_EXECUTION_PLAN.md`
- `admin/ADMIN_MODULES_DOCUMENTATION.md`
- `player/PLAYER_MODULES_DOCUMENTATION.md`
- Current code state in `admin/`, `player/`, `shared/`

## 2. Current State Snapshot

## Completed or Mostly Completed

- Player backend decomposition is complete in structure:
  - `player/src/server.js` is now thin (~105 LOC)
  - routing/handlers/services/detector split exists
- Admin backend decomposition is in place:
  - handlers/services/utils modules exist
  - `admin/src/storage.js` now acts as a facade over `storage/repository.js`, `storage/validators.js`, `storage/runtime-mapper.js`
- Shared foundation exists:
  - `shared/config/`, `shared/errors/`, `shared/validation/`
- Test suites exist and pass:
  - `admin`: `npm test` passes
  - `player`: `npm test` passes
  - `shared`: `node --test shared/test/*.test.js` passes

## Main Remaining Hotspot

- `admin/public/admin-ui.js` remains monolithic (~1652 LOC).
- UI extraction started (`public/index.html`, `public/styles.css`, `public/services/http.js`, `public/components/blocks.js`) but major feature logic is still centralized in `admin-ui.js`.

## Documentation/Process Gaps

- No `CODING_STANDARDS.md` file in repo yet.
- No `docs/adr/` set yet.
- No CI workflow files present.
- No root-level unified verification script for all packages.

## 3. Refactor Goals From Here

1. Finish Admin UI modularization without changing current API behavior.
2. Hardening pass: validation coverage, error consistency, and regression tests.
3. Documentation + contributor workflow finalization.
4. Cleanup pass: dead code, duplicated logic, and naming consistency.

## 4. Execution Plan (From Today)

## Phase A (1-2 days): Stabilize Baseline and Guardrails

### Tasks

- Add one root verification command (Make target or script) to run:
  - `admin` tests
  - `player` tests
  - `shared` tests
- Freeze API contracts for current endpoints (admin/player) in docs.
- Add a short PR checklist template focused on:
  - no API contract drift
  - no behavior regressions
  - tests updated

### Exit Criteria

- Single command verifies the full backend baseline.
- API contract reference committed.

## Phase B (4-6 days): Admin UI Decomposition (Primary Work)

### Strategy

Use behavior-preserving extraction in small PRs. Do not rewrite logic first; move logic into modules and keep identical behavior.

### PR Slice Order

1. **State Store Module**
   - Create `admin/public/services/state-store.js`
   - Move global UI state (`state`, selected IDs, filters, builder/menu issues, etc.) into one store API.

2. **Campaign Data Selectors Module**
   - Create `admin/public/services/campaign-selectors.js`
   - Move pure selectors/transformers:
     - generated/manual student campaign lookup
     - campaign normalization for overview cards
     - campaign type mapping helpers

3. **Validation Module**
   - Create `admin/public/services/validation.js`
   - Move `validateBlocks`, `validateBuilder`, `validateMenu`, and issue-to-field helpers.

4. **Overview Component**
   - Create `admin/public/components/overview.js`
   - Move sidebar/overview rendering and filtering logic.

5. **Builder Component**
   - Create `admin/public/components/builder.js`
   - Move block editor rendering, drag/drop ordering, block field updates, add/remove/duplicate logic.

6. **Inspector Component**
   - Create `admin/public/components/inspector.js`
   - Move inspector rendering and block/campaign property edit bindings.

7. **Actions Service**
   - Create `admin/public/services/actions.js`
   - Move async action flows:
     - refresh
     - save campaign
     - publish
     - delete
     - upload media

8. **App Orchestrator**
   - Create `admin/public/app.js`
   - Keep startup, wiring, and event binding only.
   - Shrink `admin/public/admin-ui.js` to compatibility shim or remove it (update `index.html` accordingly).

### Exit Criteria

- No single admin UI file over ~400 LOC.
- `admin-ui.js` reduced to thin bootstrapping or deleted.
- Existing UI behavior remains unchanged for core flows:
  - create/edit/delete campaign
  - publish active campaigns
  - student campaign edit
  - media upload

## Phase C (2-3 days): Hardening + Regression Tests

### Tasks

- Add browserless UI logic tests for extracted pure modules (selectors/validation/state-store).
- Expand admin integration tests for:
  - menu campaign update path
  - student import + generated campaign retrieval
  - media upload error paths
- Add player integration checks for:
  - detector event auth failures
  - runtime-config update edge cases

### Exit Criteria

- New module tests added for admin UI pure logic.
- Integration tests cover all major admin/player paths and key edge cases.

## Phase D (1-2 days): Docs + Standards + Cleanup

### Tasks

- Add `CODING_STANDARDS.md` with:
  - file/function headers (JSDoc requirements)
  - naming conventions
  - handler/service/storage boundaries
  - error handling and logging patterns
- Add `docs/adr/` with at least:
  - modular architecture
  - JSDoc-over-TypeScript
  - validation boundary approach
- Final dead-code pass across `admin/public` and backend modules.

### Exit Criteria

- Standards and ADR docs are committed.
- No stale or unused modules from transitional refactor.

## 5. Quality Gates Per PR

- Tests pass for affected package(s).
- API behavior unchanged unless explicitly noted.
- File-level and function-level headers present in newly added modules.
- No direct cross-layer shortcuts (UI component -> raw fetch when service exists, handler -> repository when service exists).
- Clear rollback path (single PR revert should restore previous behavior).

## 6. Immediate Next 10 PRs (Concrete)

1. Root verification command + readme update.
2. Admin UI `state-store.js` extraction.
3. Admin UI campaign selectors extraction.
4. Admin UI validation extraction.
5. Admin UI overview component extraction.
6. Admin UI builder component extraction.
7. Admin UI inspector component extraction.
8. Admin UI actions service extraction.
9. Admin UI app orchestrator creation + `index.html` script wiring update.
10. Shrink/remove legacy `admin-ui.js` + cleanup and test pass.

## 7. Risks and Mitigations

- **Risk:** UI refactor causes silent behavior regressions.  
  **Mitigation:** Extract pure logic first; keep action flows unchanged until module boundaries stabilize.

- **Risk:** Over-large PRs slow review and increase breakage.  
  **Mitigation:** Keep each PR to one extraction target and one verification scope.

- **Risk:** Inconsistent coding style after parallel edits.  
  **Mitigation:** Commit `CODING_STANDARDS.md` before midpoint of Phase B.

## 8. Definition of Done

- Admin UI is modular (components/services/app entrypoint), and monolith is retired.
- Backend modularization remains stable with passing tests.
- Shared config/errors/validation are consistently used.
- Standards + ADR + module docs are present and up to date.
- End-to-end core flows pass without API regressions.
