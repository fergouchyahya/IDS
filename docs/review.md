# IDS Project Review (Current State)

This review identifies current shortcomings and concrete improvement actions.

## 1) Testing depth is too low
Shortcoming:
- There are almost no automated tests for Admin routes, Player FSM/scheduler behavior, and browser render stream integration.

How to improve:
- Add unit tests for `player/src/fsm.js`, `player/src/scheduler.js`, and event validation.
- Add API tests for `admin/src/server.js` upload/list/get behavior including error shapes.
- Add one end-to-end test script that starts services, uploads config, posts events, and verifies SSE output.

## 2) Observability is minimal
Shortcoming:
- Logs are unstructured and there are no health/readiness endpoints.

How to improve:
- Standardize logs as JSON lines with fields: timestamp, component, eventType, state, campaignId.
- Add `/healthz` and `/readyz` on Admin and Player.
- Add correlation IDs from event ingestion to render emission.

## 3) Security posture is placeholder-level
Shortcoming:
- Services are localhost-first and unauthenticated; upload/read endpoints have no auth controls.

How to improve:
- Add token-based auth for Admin write endpoints.
- Add request size/rate limits and strict CORS policy.
- Define threat model for kiosk deployment and harden exposed ports accordingly.

## 4) Schema lifecycle is not versioned formally
Shortcoming:
- Contract changes are occurring, but version management and backward compatibility policy are informal.

How to improve:
- Add explicit schema version field and migration strategy.
- Define compatibility rules (what is breaking vs non-breaking).
- Gate CI with compatibility checks across key example sets.

## 5) State/render coupling is still evolving
Shortcoming:
- Guided flow and campaign flow coexist, but separation is implementation-driven rather than architecture-driven.

How to improve:
- Introduce an explicit render-intent layer (domain events) independent of transport (SSE).
- Define clear mode contracts: guided demo mode vs campaign scheduler mode.
- Add integration tests for both modes to avoid regressions.

## 6) Deployment artifacts are placeholders
Shortcoming:
- `infra/nginx/default.conf` and `deploy/pi/systemd/ids.service` are not production-grade yet.

How to improve:
- Wire Nginx routes to real Admin/Player upstreams.
- Replace placeholder service `ExecStart` with real process commands.
- Add persistent log strategy and restart/backoff tuning.

## 7) Data durability needs clearer ownership
Shortcoming:
- Admin append-only JSONL is simple but lacks rotation, backup policy, and corruption recovery strategy.

How to improve:
- Define retention + backup policy.
- Add write-ahead integrity check and startup repair behavior.
- Consider migration path to lightweight embedded DB if scale/queries increase.

## 8) Documentation quality improved, but can be stricter
Shortcoming:
- Docs are now broader, but acceptance criteria are not always testable/measurable.

How to improve:
- For each phase item, add measurable done criteria and a verification command.
- Maintain a single source for runbooks and remove duplicated instructions.
- Add a release checklist before merges to `main`.

## Suggested execution order
1. Tests (unit + API + one e2e path).
2. Health endpoints + structured logs.
3. Deployment wiring (Nginx + systemd real commands).
4. Auth/rate-limit hardening for Admin.
5. Schema versioning policy + CI enforcement.
