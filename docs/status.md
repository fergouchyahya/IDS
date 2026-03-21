# Project Status & Roadmap

> Single source of truth for what's done, what's next, and what's deferred.

---

## Current State

The system is **stage-ready** and deployed on Raspberry Pi:

- Admin and Player services run as systemd units with auto-restart
- Full layered architecture: `router -> handler -> service -> storage -> repository`
- Player state machine drives display: IDLE -> MENU -> VISITOR_INFO / STUDENT_INFO -> IDLE
- NFC reader runs as a dedicated systemd service (`ids-nfc.service`)
- Camera-based hand gesture detection via MediaPipe (movement triggers IDLE -> MENU)
- Browser admin UI for campaign/student/media management
- API key authentication protects all mutation endpoints
- SQLite-backed student profile storage (migrated from JSON)
- NFC error feedback ("Card not recognized" banner) and inactivity timeout warning toast
- Presence keepalive: display stays active while someone is in front of the camera
- NFC keepalive: same-card re-tap resets timer without restarting carousel
- GitHub Actions CI runs all tests on push/PR to main
- Delete confirmation dialogs and button loading states in admin UI
- Polytech Grenoble branding and professional demo data
- All test suites pass (`make test-all`, `make verify-all`)
- Raspberry Pi deployment with systemd, env templates, and smoke checks

---

## Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Core architecture (admin + player services) | Done |
| Phase 1 | Admin persistence and browser UI | Done |
| Phase 2 | Player state machine and server-side rendering | Done |
| Phase 3 | Shared contract, config schema, validation | Done |
| Phase 4 | Raspberry Pi deployment (systemd, env, smoke checks) | Done |
| Phase 5 | Admin-to-Player sync (runtime config push) | Done |
| Phase 6 | Camera & motion detection (MediaPipe hand gestures) | Done |
| Phase 7 | NFC integration (libnfc reader as systemd service) | Done |
| Phase 8 | Stage-ready polish (branding, UX, demo data) | Done |
| Phase 9 | API key auth middleware for admin mutations | Done |
| Phase 10 | SQLite for student profiles (better-sqlite3) | Done |
| Phase 11 | GitHub Actions CI pipeline | Done |
| Phase 12 | NFC error feedback + inactivity timeout warning | Done |
| Phase 13 | Delete confirmation + loading states in admin UI | Done |
| Phase 14 | Presence keepalive + NFC keepalive (stay active while present) | Done |

---

## Remaining Work

### Operational Hardening

| Task | Details | Status |
|------|---------|--------|
| Automated deploy script | Single `deploy.sh` that syncs code, installs deps, restarts services | To Do |
| Healthcheck integration | Wire smoke-check into systemd watchdog | To Do |
| Environment validation | Fail fast at boot if required env vars are missing | To Do |
| Log rotation | Set up journald limits for service logs | To Do |

### Future Improvements

| Task | Details | Status |
|------|---------|--------|
| HTTPS / TLS | Secure admin endpoints for network exposure | Deferred |
| Multi-display | Multiple players with different configs | Deferred |
| Admin login page | Replace API key prompt with a login form | Deferred |

---

## Deferred Work

| Item | Notes |
|------|-------|
| **Project flyer** | Visual flyer for project presentation — for later |
| **Final documentation** | Comprehensive project report for submission — for later |
| Admin UI decomposition | Continue breaking browser-side modules into smaller files |

---

## Verification Baseline

- Admin tests: **passing** (20 tests)
- Player tests: **passing** (5 tests)
- Shared tests: **passing** (9 tests)
- Schema validation: **passing** (`make validate`)
- CI: GitHub Actions on push/PR to main/master
- Note: admin integration tests require `127.0.0.1` socket binding — restricted sandboxes may fail with `listen EPERM`

---

## How To Use This File

- Update it when the repo's real unfinished work changes
- Keep it factual and aligned with the actual code state
- This is the only roadmap/status file — do not create competing ones
