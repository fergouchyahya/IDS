# Project Status & Roadmap

> Single source of truth for what's done, what's next, and what's deferred.

---

## Current State

The core system is functional:

- Admin and Player services are running with the full layered architecture
- `router -> handler -> service -> storage -> repository` pipeline is in place for Admin
- `router -> handler -> service/state-machine` pipeline is in place for Player
- Admin persistence is async and repository-backed through `FileRepository`
- Browser admin UI has been partially decomposed into `services/` and `components/`
- All test suites pass in a normal local environment
- Raspberry Pi deployment structure exists with systemd units and environment templates
- Documentation set covers architecture, API, deployment, and testing

---

## Next Steps

### Phase 1 — Deployment Hardening

**Goal:** Reliable, reproducible deployment to the Raspberry Pi target.

| Task | Details | Status |
|------|---------|--------|
| Automate deployment script | Create a single `deploy.sh` that syncs code, installs deps, restarts services | To Do |
| Healthcheck integration | Wire `smoke-check.sh` into systemd `ExecStartPost` or a watchdog timer | To Do |
| Auto-restart on failure | Configure systemd `Restart=on-failure` with backoff for both services | To Do |
| Environment validation | Fail fast at boot if required env vars are missing or malformed | To Do |
| Log rotation | Set up `logrotate` or journald limits for `/var/log/ids` | To Do |
| Network resilience | Handle player startup when admin is temporarily unreachable | To Do |

### Phase 2 — Camera & Motion Detection

**Goal:** Fix the camera logic and make motion detection reliable.

| Task | Details | Status |
|------|---------|--------|
| Camera initialization | Fix camera startup sequence — handle device busy, permissions, fallback | To Do |
| PIR sensor integration | Wire physical PIR sensor GPIO events to `/detector/movement` endpoint | To Do |
| Camera-based motion | Implement frame-diff or background-subtraction for software motion detection | To Do |
| Sensitivity tuning | Add configurable threshold and cooldown period via `IDS_DETECTOR_CONFIG` | To Do |
| False positive filtering | Debounce rapid triggers, ignore lighting changes, add minimum motion area | To Do |
| Detector health reporting | Expose detector status in `/health` response for monitoring | To Do |

### Phase 3 — NFC Integration & Testing

**Goal:** Hardware NFC working end-to-end with real student cards.

| Task | Details | Status |
|------|---------|--------|
| NFC reader driver | Connect physical NFC reader (e.g. PN532/RC522) via SPI/I2C on the Pi | To Do |
| UID extraction | Read raw NFC UID from card tap and forward to player events endpoint | To Do |
| Student lookup flow | Verify full flow: tap -> player -> admin sync -> student campaign -> render | To Do |
| Unknown card handling | Define UX for unregistered cards — show message, log UID for later registration | To Do |
| Multi-tap resilience | Handle rapid successive taps, same-card re-tap, and reader timeout gracefully | To Do |
| End-to-end test | Full test with real NFC cards on the Pi: tap -> display student info | To Do |

### Phase 4 — Motion Detection Fine-Tuning

**Goal:** Production-quality motion detection with minimal false positives.

| Task | Details | Status |
|------|---------|--------|
| Threshold calibration | Test and document optimal sensitivity for the target Pi environment | To Do |
| Zone masking | Allow defining active zones in the frame to ignore irrelevant movement areas | To Do |
| Time-based profiles | Different sensitivity during day vs. night or high-traffic vs. quiet periods | To Do |
| Performance profiling | Measure CPU/memory impact of motion detection on the Pi | To Do |
| Logging & metrics | Log detection events with timestamps for analysis and tuning | To Do |

### Phase 5 — SQL Persistence

**Goal:** Replace file-backed JSON storage with a proper database.

| Task | Details | Status |
|------|---------|--------|
| Database selection | Choose SQLite (embedded) or PostgreSQL (if network DB is needed) | To Do |
| Schema design | Design tables for campaigns, items, students, profiles, settings, media refs | To Do |
| Repository implementation | Create `SqlRepository` implementing the existing repository interface | To Do |
| Migration tooling | Script to migrate existing JSON state file to the new database | To Do |
| Transaction support | Ensure atomic writes for multi-entity operations (campaign + items) | To Do |
| Query optimization | Index frequently accessed fields (student UID, campaign ID, active flags) | To Do |
| Integration testing | Run existing test suites against the SQL backend | To Do |

---

## Deferred Work

These items are planned but not yet scheduled into a phase:

| Item | Notes |
|------|-------|
| **Project flyer** | Design a visual flyer presenting the project — for later |
| **Final documentation** | Comprehensive project documentation for submission — for later |
| Admin UI decomposition | Continue breaking `admin-ui.js` into smaller modules |
| CI/CD pipeline | GitHub Actions for automated testing and deployment |
| HTTPS / auth | Secure admin endpoints for production network exposure |
| Multi-display support | Allow multiple players with different configs |

---

## Verification Baseline

- Admin tests: **passing**
- Player tests: **passing**
- Shared tests: **passing**
- Note: admin integration tests require `127.0.0.1` socket binding — restricted sandboxes may fail with `listen EPERM`

---

## How To Use This File

- Update it when the repo's real unfinished work changes
- Keep it factual and aligned with the actual code state
- This is the only roadmap/status file — do not create competing ones
