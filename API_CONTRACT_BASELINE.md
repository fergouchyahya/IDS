# API Contract Baseline (Refactor Guardrail)

**Date frozen:** 2026-03-03  
**Purpose:** Preserve current endpoint behavior while refactoring internals.

## Admin Service Baseline

- `GET /`
- `GET /admin-ui.js`
- `GET /styles.css`
- `GET /services/*`
- `GET /components/*`
- `GET /health`
- `GET /api/state`
- `GET /runtime-config`
- `GET /media/:filename`
- `POST /api/media/upload`
- `POST /api/campaigns`
- `PUT /api/campaigns/:id`
- `DELETE /api/campaigns/:id`
- `POST /api/active`
- `POST /api/settings`
- `POST /api/menu-campaign`
- `POST /api/students`
- `POST /api/students/import`
- `GET /api/students/:uid/campaign`
- `DELETE /api/students/:uid`

## Player Service Baseline

- `GET /`
- `GET /current`
- `GET /health`
- `POST /events`
- `POST /detector/movement`
- `POST /detector/events`
- `POST /runtime-config`

## Contract Rules During Refactor

1. Do not change paths or HTTP methods without explicit migration notes.
2. Do not change success/error JSON envelope shapes unless versioned.
3. Keep existing status code behavior unless a bug fix is intentionally documented.
4. Any contract change must include tests and an entry in this file.
