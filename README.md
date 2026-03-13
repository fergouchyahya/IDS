# IDS

IDS is an interactive digital signage system with two running services:

- `admin/` manages campaigns, student data, uploads, and the browser-based control UI
- `player/` displays signage content, reacts to movement and NFC-style events, and can sync its runtime from `admin`
- `shared/` contains the common config, validation, logging, and contract code used by both services

The repository root for the actual project is `ids/`. Everything in this README describes that workspace and the current working tree.

## What The System Does

At a high level:

1. An operator uses the admin UI to define what should be shown.
2. The admin service stores that state on disk and exposes it through HTTP APIs.
3. The player service loads a startup config, optionally pulls live runtime config from admin, and renders a full-screen display.
4. Movement or NFC-like events change what the player shows.

If you have never seen the code before, read the docs in this order:

1. [`docs/architecture/overview.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/overview.md)
2. [`docs/glossary.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/glossary.md)
3. [`docs/architecture/admin.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/admin.md)
4. [`docs/architecture/player.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/player.md)
5. [`docs/api/admin.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/api/admin.md)
6. [`docs/api/player.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/api/player.md)

## Repository Map

```text
ids/
├── admin/                  Admin HTTP service, browser UI, tests, file storage
├── deploy/                 Raspberry Pi env, systemd units, smoke checks
├── docs/                   Canonical project documentation
├── player/                 Player HTTP service, state machine, detector flow
├── scripts/                Repo verification helpers
├── shared/                 Cross-service config, validation, errors, schema
├── .env.example            Example runtime environment file
└── Makefile                Common install, run, validate, and test commands
```

## Quick Start

Install dependencies:

```bash
make install
```

Run the admin service:

```bash
make run-admin
```

Run the player against the bundled example config:

```bash
make run-player
```

Validate the shared JSON contract example:

```bash
make validate
```

Run the verification suites:

```bash
npm --prefix admin test
npm --prefix player test
node --test shared/test/*.test.js
```

## Default Local Runtime

- Admin URL: `http://127.0.0.1:8081`
- Player URL: `http://127.0.0.1:7070`
- Default player startup config: `shared/contract/examples/config.welcome.json`
- Example environment file: [`.env.example`](/home/fergyah/School/S8/PROJ/Project/ids/.env.example)

## Documentation Index

- [`docs/README.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/README.md) - full doc index
- [`docs/status.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/status.md) - what is still unfinished and what should happen next
- [`docs/architecture/overview.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/overview.md) - system-level architecture and data flow
- [`docs/architecture/admin.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/admin.md) - admin internals and browser UI wiring
- [`docs/architecture/player.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/player.md) - player internals, state machine, detector flow
- [`docs/architecture/shared.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/shared.md) - shared config, validation, logging, contract assets
- [`docs/api/admin.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/api/admin.md) - admin route reference
- [`docs/api/player.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/api/player.md) - player route reference
- [`docs/operations/deployment-pi.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/operations/deployment-pi.md) - Raspberry Pi deployment and operations
- [`docs/testing.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/testing.md) - verification commands, suite coverage, current known gap
- [`docs/glossary.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/glossary.md) - beginner-friendly terms

## Current Engineering Notes

- The main architectural seams already exist: `router -> handler -> service -> storage/state`.
- Admin persistence is async and repository-backed through `FileRepository`.
- The admin browser UI has been partially decomposed into `public/services/*` and `public/components/*`, but `public/admin-ui.js` still acts as a large orchestration layer.
- The package test suites are green in a normal local environment; see [`docs/testing.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/testing.md) for the sandbox note on admin integration tests.
- The canonical “what still needs to be done” page is [`docs/status.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/status.md).
