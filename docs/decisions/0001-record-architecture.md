# ADR 0001 — Monorepo + shared contract

## Context
We need a clean separation between admin, player, shared contracts, and deployment.

## Decision
Use a monorepo with:
- admin/
- player/
- shared/contract/ as the single source of truth for config schema and examples.

## Consequences
- Easier to keep schema and implementations aligned.
- CI can validate schema/examples centrally.
