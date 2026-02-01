# IDS — Interactive Digital Signage

Monorepo structure:
- admin/   : control plane (API + UI later)
- player/  : signage runtime (renders content, reacts to events)
- shared/  : contracts (JSON schema + examples + validators)
- infra/   : docker/nginx local infrastructure
- deploy/  : Raspberry Pi deployment (env + systemd)
- assets-demo/: demo media for showcasing
- docs/    : architecture + decisions

## Quick start (placeholder)
- Contract validation: shared/contract/scripts/validate-config.js
