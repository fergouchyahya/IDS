# Admin Module Documentation

## Purpose
This document explains:
- Admin file structure and responsibilities
- How handlers, services, and storage interact
- End-to-end runtime scenarios

---

## 1. Admin File Inventory

## Entry and Composition
- `src/index.js`
  - Entry point.
  - Validates `ADMIN_PORT` and starts server.

- `src/server.js`
  - Composition root.
  - Builds shared dependencies and services.
  - Creates server and binds router.

- `src/router.js`
  - Route dispatcher only.
  - Maps HTTP method/path to handlers.

## Handlers (`src/handlers`)
- `ui.js`: serves `/` and `/admin-ui.js`
- `health.js`: serves `/health`
- `state.js`: serves `/api/state` and `/runtime-config`
- `media.js`: serves `/media/:filename` and `/api/media/upload`
- `campaigns.js`: handles `/api/campaigns` create/update/delete
- `config.js`: handles `/api/active`, `/api/settings`, `/api/menu-campaign`
- `students.js`: handles `/api/students`, `/api/students/import`, `/api/students/:uid/campaign`, student delete

## Services (`src/services`)
- `campaign-service.js`
  - Campaign CRUD operations.
- `config-service.js`
  - Active campaign, settings, menu campaign operations.
- `student-service.js`
  - Student upsert/delete/import and generated campaign queries.
- `state-service.js`
  - State projection (`/api/state`, `/runtime-config`).
- `health-service.js`
  - Health payload construction.
- `media-service.js`
  - Media file lookup and upload processing integration.

## Utilities (`src/utils`)
- `request-utils.js`
  - JSON/raw body readers and validation error formatting.
- `media-utils.js`
  - Multipart parsing, upload persistence helpers, MIME resolution.

## Existing Core
- `src/storage.js`
  - Persistent state engine and validation rules.
  - Source of truth for admin data and runtime projection.
- `src/render-admin-page.js`
  - Server-side admin page renderer.
- `public/admin-ui.js`
  - Admin browser application script.

---

## 2. Architecture and Interaction

```text
index.js
  -> server.createServer()
      -> build services (campaign/config/student/state/health/media)
      -> createAdminRouter(deps)
          -> handlers/*
              -> services/*
                  -> storage.js
```

### Key design rules
- Router does no business logic.
- Handlers orchestrate HTTP only (parse input -> call service -> send response).
- Services encapsulate domain operations.
- Storage remains persistence/validation core.

---

## 3. Endpoint Ownership

- `GET /` -> `handlers/ui.js`
- `GET /admin-ui.js` -> `handlers/ui.js`
- `GET /health` -> `handlers/health.js`
- `GET /api/state` -> `handlers/state.js`
- `GET /runtime-config` -> `handlers/state.js`
- `GET /media/:filename` -> `handlers/media.js`
- `POST /api/media/upload` -> `handlers/media.js`
- `POST /api/campaigns` -> `handlers/campaigns.js`
- `PUT /api/campaigns/:id` -> `handlers/campaigns.js`
- `DELETE /api/campaigns/:id` -> `handlers/campaigns.js`
- `POST /api/active` -> `handlers/config.js`
- `POST /api/settings` -> `handlers/config.js`
- `POST /api/menu-campaign` -> `handlers/config.js`
- `POST /api/students` -> `handlers/students.js`
- `POST /api/students/import` -> `handlers/students.js`
- `GET /api/students/:uid/campaign` -> `handlers/students.js`
- `DELETE /api/students/:uid` -> `handlers/students.js`

---

## 4. Scenario Example

## Scenario: Admin creates campaign and player receives runtime update

### Step-by-step
1. Admin UI sends `POST /api/campaigns`.
   - `campaigns.js` reads JSON payload.
   - Calls `services.campaigns.create(...)`.
   - Service delegates to `storage.createCampaign(...)`.
   - Updated state returned.

2. Admin UI sets active campaigns via `POST /api/active`.
   - `config.js` handler calls `services.config.setActive(...)`.
   - Storage updates `state.active` mapping.

3. Player polls `GET /runtime-config` from admin.
   - `state.js` handler calls `services.state.getRuntimeConfig()`.
   - Service projects current storage state into runtime model.
   - Player receives normalized runtime config.

4. Player applies runtime config and updates displayed campaign.
   - Admin and player stay synchronized without direct DB coupling.

---

## 5. Phase 2 Outcome

Phase 2 adds a clear service layer and separates HTTP orchestration from domain calls while preserving the existing API contracts and storage behavior.

This reduces coupling and makes Phase 3 easier:
- isolate storage internals later
- add tests per service/handler
- refactor `render-admin-page.js` and `public/admin-ui.js` independently
