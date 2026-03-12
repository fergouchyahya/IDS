# IDS

Interactive Digital Signage project with three active packages:

- `admin/` - control plane, storage, and browser admin UI
- `player/` - signage runtime and detector-aware event flow
- `shared/` - cross-package config, validation, errors, and contract assets

## Current Status

This repository is in a usable refactor state, not a greenfield state:

- Backend modularization for `admin` and `player` is in place.
- Shared config/error/validation modules exist and are used.
- The main remaining technical debt is `admin/public/admin-ui.js`, which is still a large transitional orchestration file.
- The current local verification baseline passes with `make verify-all`.

If you are resuming work, start from the current code and tests, not from older refactor planning documents.

## Repository Layout

```text
.
├── admin/                  Admin server, storage, tests, browser UI
├── deploy/                 Raspberry Pi env + systemd files
├── docs/                   Current project docs index and conventions
├── player/                 Player runtime, detector flow, tests
├── scripts/                Repo-level verification helpers
├── shared/                 Shared runtime helpers and JSON contract
├── API_CONTRACT_BASELINE.md
├── Makefile
├── PLAN_OF_WORK.md
├── REMAINING_WORK_BY_DIFFICULTY.md
└── ROADMAP.md
```

## Getting Started

Install package dependencies:

```bash
make install
```

Run the full verification suite:

```bash
make verify-all
```

Run the services locally in separate terminals:

```bash
make run-admin
make run-player
```

Validate the shared config example contract:

```bash
make validate
```

## Package Test Commands

```bash
npm --prefix admin test
npm --prefix player test
node --test shared/test/*.test.js
```

## Service Defaults

- Admin: `http://127.0.0.1:8081`
- Player: `http://127.0.0.1:7070`
- Default player config: `shared/contract/examples/config.welcome.json`

Environment variables are documented in [`.env.example`](/home/fergyah/School/S8/PROJ/Project/ids/.env.example). Raspberry Pi deployment values live in [`deploy/pi/env/ids.env`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/env/ids.env).

## Documentation Map

- [`ROADMAP.md`](/home/fergyah/School/S8/PROJ/Project/ids/ROADMAP.md) - current cleanup and next-work sequence
- [`PLAN_OF_WORK.md`](/home/fergyah/School/S8/PROJ/Project/ids/PLAN_OF_WORK.md) - phased task breakdown with status tracking
- [`REMAINING_WORK_BY_DIFFICULTY.md`](/home/fergyah/School/S8/PROJ/Project/ids/REMAINING_WORK_BY_DIFFICULTY.md) - phases ranked by difficulty
- [`API_CONTRACT_BASELINE.md`](/home/fergyah/School/S8/PROJ/Project/ids/API_CONTRACT_BASELINE.md) - endpoint guardrail during refactor
- [`docs/README.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/README.md) - doc ownership and what belongs where
- [`docs/deployment/pi.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/deployment/pi.md) - Raspberry Pi deployment, smoke checks, and rollback
- [`admin/README.md`](/home/fergyah/School/S8/PROJ/Project/ids/admin/README.md) - how the admin package is structured
- [`player/README.md`](/home/fergyah/School/S8/PROJ/Project/ids/player/README.md) - how the player package is structured
- [`shared/README.md`](/home/fergyah/School/S8/PROJ/Project/ids/shared/README.md) - shared modules and contract assets

## Working Rules

- Preserve the API contract unless a change is intentional and documented.
- Keep `router -> handler -> service -> storage/data` boundaries intact.
- Prefer adding tests around extracted logic before feature expansion.
- Finish the admin UI decomposition before starting larger new features such as DB automation or NFC hardware integration.
