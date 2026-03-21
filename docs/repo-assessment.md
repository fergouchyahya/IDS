# Repo Assessment

> Lean snapshot of repository health, code quality, and code distribution. This reflects the workspace as inspected on 2026-03-16.

---

## Repo Health

The repo is in a good working shape for a student or prototype system:

- Clear separation between `admin`, `player`, `shared`, `docs`, and deployment assets
- Consistent layered backend design across services
- Strong documentation coverage relative to repo size
- Tests exist across admin, player, and shared packages
- Deployment scaffolding for Raspberry Pi already exists

Current caveats:

- Admin remains the dominant code area, so most maintenance cost will land there
- JSON-file persistence is acceptable for demo scale but would need migration for production

### Snapshot (updated 2026-03-21)

| Metric | Value |
|--------|-------|
| Total files | `119` |
| Total lines | `17,152` |
| JavaScript files | `78` |
| JavaScript lines | `10,981` |
| Documentation lines | `4,135` |
| Test files | `10` |
| Test lines | `971` |

---

## Code Quality Review

### What Looks Strong

- The architecture is deliberate rather than ad hoc: router, handler, service, storage, and repository boundaries are documented and visible in code
- The player side has a focused state-machine core, which is a good fit for screen-state transitions
- Shared code is extracted into `shared/` instead of duplicated across services
- The project avoids framework overhead and keeps runtime dependencies understandable
- Documentation quality is above average for this repo size

### Main Risks

- Large files are beginning to accumulate in areas that will become harder to change safely
- Frontend/admin UI logic is spread across many vanilla JS modules without stronger type guarantees
- JSON-file persistence is acceptable for prototype scale but will become a concurrency and integrity limit
- Hardware-facing logic in the detector path is not yet production-ready according to the roadmap
- Test volume is decent but still modest compared with the amount of application code

### Files That Deserve Attention

These are not necessarily bad, but they are likely maintenance hotspots:

| File | Lines | Why it matters |
|------|-------|----------------|
| `player/src/services/render-service.js` | `~950` | Rendering logic is large and mixes layout, content shaping, and presentation concerns |
| `admin/public/styles.css` | `899` | Single large stylesheet makes UI changes harder to localize |
| `admin/public/services/orchestrator.js` | `379` | Central browser coordination code often becomes a change bottleneck |
| `admin/src/storage/repository.js` | `374` | Persistence code is critical and should stay simple and heavily tested |
| `admin/src/storage.js` | `368` | Storage facade size suggests growing domain complexity |
| `player/src/services/state-machine.js` | `315` | Core runtime behavior; high leverage, high regression risk |
| `player/src/detector/client-script.js` | `297` | Detector logic — MediaPipe hand gesture detection |

### Practical Quality Score

If you want a blunt summary:

- Architecture quality: `8/10`
- Documentation quality: `8/10`
- Test depth: `6/10`
- Operational maturity: `7/10`
- Long-term maintainability if left unchanged: `6/10`

Overall repo health: `8/10`

---

## Folder Breakdown

Percentages below are based on total line count (`15,554`).

| Area | Lines | Share |
|------|-------|-------|
| `admin/` | `8,029` | `51.6%` |
| `docs/` | `2,957` | `19.0%` |
| `player/` | `2,696` | `17.3%` |
| `shared/` | `1,170` | `7.5%` |
| root `README.md` | `434` | `2.8%` |
| `deploy/` | `117` | `0.8%` |
| everything else | `151` | `1.0%` |

### By File Type

| Type | Lines | Share |
|------|-------|-------|
| `.js` | `10,117` | `65.0%` |
| `.md` | `3,621` | `23.3%` |
| `.css` | `899` | `5.8%` |
| `.json` | `560` | `3.6%` |
| `.html` | `119` | `0.8%` |
| other | `238` | `1.5%` |

### By Purpose

| Purpose | Lines | Share |
|---------|-------|-------|
| Backend and service source (`src/`) | `5,103` | `32.8%` |
| Frontend public UI (`public/`) | `4,390` | `28.2%` |
| Documentation and READMEs | `3,591` | `23.1%` |
| Tests | `971` | `6.2%` |
| Remaining config and deploy assets | `1,499` | `9.6%` |

---

## Read Of The Repo

This codebase looks like a well-structured prototype moving toward a deployable product. The architecture is stronger than the operational maturity. The biggest concentration of code and future maintenance effort is in `admin/`, while the highest behavioral risk sits in player runtime and detector logic.

If the next goal is a better final submission, the highest-value improvements are:

1. Reduce the largest files in `player` and `admin/public`
2. Expand tests around state transitions, persistence, and detector behavior
3. Harden deployment and startup failure handling on Raspberry Pi
4. Replace or wrap JSON persistence before the data model grows much further
