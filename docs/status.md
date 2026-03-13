# Current Status And Next Work

This is the single source-of-truth status page for unfinished work in the `ids/` workspace. It should stay short, factual, and aligned with the real repo state.

## Current State

- The documentation set has been consolidated into `docs/` and reflects the current working tree.
- The main backend/service structure is in place:
  - admin uses `router -> handler -> service -> storage -> repository`
  - player uses `router -> handler -> service/state-machine`
- Admin persistence is async and repository-backed through `FileRepository`.
- Admin, player, and shared test suites all pass in a normal local environment.
- `admin/public/admin-ui.js` has been reduced to a composition root; the former browser-UI hotspot has been split into extracted runtime, orchestration, and legacy-bridge services.

## Known Problems

### 1. Working tree is still in transition

Current signal:

- there are substantial uncommitted code changes in admin, player, deploy, and docs

Impact:

- before starting the next major refactor or feature, the current baseline should be stabilized and understood as one coherent state

## Recommended Next Tasks

### Priority 1: Stabilize and commit the current baseline

Do next:

1. review the existing uncommitted code changes
2. make sure the docs still match the final code state
3. land the current cleanup as a coherent baseline before adding new scope

Success criteria:

- docs and code describe the same system
- there is a clean baseline branch or commit to build on

## Verification Note

- the repo verification baseline is green in a normal local environment
- admin integration tests require the ability to bind a local socket on `127.0.0.1`
- restricted sandboxes can still fail those tests with `listen EPERM` even when the repo is healthy

## Deferred But Likely Future Work

- stronger admin persistence options beyond the current file-backed repository
- hardware-backed NFC integration in player rather than only event-based simulation
- broader deployment hardening and rollout automation for Raspberry Pi environments
- SQL-backed persistence implementation

## How To Use This File

- update it when the repo’s real unfinished work changes
- keep it short and factual
- do not recreate multiple competing roadmap/status files elsewhere in the repo
