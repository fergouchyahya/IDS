# IDS — Interactive Digital Signage

Monorepo structure:
- admin/   : control plane (API + UI later)
- player/  : signage runtime (renders content, reacts to events)
- shared/  : contracts (JSON schema + examples + validators)
- infra/   : docker/nginx local infrastructure
- deploy/  : Raspberry Pi deployment (env + systemd)
- assets-demo/: demo media for showcasing
- docs/    : architecture + decisions

# Ground Rules
- Node version: 20 LTS (keep in sync with CI).
- Naming conventions: JavaScript/TypeScript use camelCase for vars/functions, PascalCase for classes, UPPER_SNAKE for constants.
- Naming conventions: files use kebab-case, except class files may be PascalCase (e.g., DummyRenderer.js).
- Naming conventions: JSON fields use camelCase.
- File responsibility rules: one responsibility per file; avoid "misc" or "utils" grab-bags.
- File responsibility rules: if a file grows beyond a single responsibility, split it.
- File responsibility rules: contract and runtime logic must not be mixed.

# Project explenation 
## Root
README.md     : what the project is, how to navigate, how to run the minimal checks.

.gitignore    : what we intentionally never commit.

.editorconfig : formatting rules for consistent diffs and teamwork.

.env.example  : environment variables contract (what exists, what it controls).

Makefile      : single entry points (make validate, later make dev, make lint, etc.).

## Shared contract

### Config schema
This schema is the single source of truth for what the **player** accepts and what the **admin** must generate.
shared/contract/schema/config.schema.json    : what “valid config” means for admin → player.



### Contract validation (configs)
shared/contract/scripts/validate-config.js   : validates examples against schema; used by dev + CI.
IDS uses a JSON Schema as a shared contract between **admin** (produces configs) and **player** (consumes them).

Validate the example configs:

```bash
make validate
```


shared/contract/examples/config.welcome.json : simplest valid example; used for demo + tests.

shared/contract/examples/config.media.json   : example with media assets; covers more fields.

shared/contract/examples/config.invalid.json : intentionally invalid example (not validated by make validate).

### Contract usage (admin + player)
Admin must only generate configs that validate against the shared schema, and reject uploads that do not.
Player must validate configs on load and fail fast on invalid data, never attempting to render it.

## Player
player/scripts/run-dev.sh                       : how to launch player in dev mode (later: hot reload, local assets).

player/src/ (we’ll add actual code files later) : event ingestion, scheduling, rendering, timeout.

## Admin
admin/openapi/openapi.yaml : API contract for admin endpoints (create campaigns, push configs, etc.)

admin/src/ (later)         : server implementation + persistence.

admin/tests/ (later)       : API tests.

## Infra
infra/docker-compose.yml: local infrastructure wiring (nginx + later services).

infra/nginx/default.conf: routing rules (admin/player endpoints, static assets, etc.)

## Deploy
deploy/pi/env/ids.env: the Pi’s runtime config knobs.

deploy/pi/systemd/ids.service: how IDS runs as a service (start/stop/restart, logs).

## Docs
docs/architecture/deployment.md: how we deploy and why that approach.

docs/architecture/diagram.md: architecture diagrams + explanation of components.

docs/decisions/0001-record-architecture.md : recorded decision + tradeoffs.

## CI
.github/workflows/ci.yml: what the CI enforces (contract validation, later tests/lint).













