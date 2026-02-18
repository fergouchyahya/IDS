# IDS Admin (Phase 6)

Minimal control plane that accepts configs, validates them against the shared schema,
and stores them immutably.

## Why this exists
Admin is the gatekeeper for configs. It must reject invalid data before it can reach
the Player, and it must keep an append-only audit trail of uploads.

## Run locally
From repo root:

```bash
node admin/src/index.js
```

Server listens on `http://127.0.0.1:8081`.

## API (v0)
- `POST /configs` upload a config (validates against the shared schema).
- `GET /configs` list config metadata.
- `GET /configs/{id}` fetch a config by id.

## Contract usage
Admin always validates uploads using `shared/contract/schema/config.schema.json`.
If validation fails, Admin returns 400 with readable errors. Admin never mutates
the uploaded JSON.

