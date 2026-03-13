# Admin API

This reference describes the admin HTTP surface as implemented by [`admin/src/router.js`](/home/fergyah/School/S8/PROJ/Project/ids/admin/src/router.js) in the current working tree.

## Contract Policy

- Route paths and methods are part of the control-plane contract.
- Handlers generally return validation-style error payloads for bad input:
  `{"error":"validation_failed","issues":[...]}`
- Unknown routes return `404` with `{"error":"not_found: /path"}` for admin API paths.
- Successful mutation endpoints usually return a `{ state }` wrapper containing the updated full admin state.

## UI And Static Assets

### `GET /`

- Handler: `handlers/ui.js`
- Purpose: return the server-rendered admin HTML shell
- Response: `200 text/html`

### `GET /admin-ui.js`

- Handler: `handlers/ui.js`
- Purpose: return the main browser admin script
- Response: `200 application/javascript`

### `GET /styles.css`

- Handler: `handlers/ui.js`
- Purpose: return admin UI styles
- Response: `200 text/css`

### `GET /app.js`

- Handler: `handlers/ui.js`
- Purpose: return additional admin browser code
- Response: `200 application/javascript`

### `GET /services/*`

- Handler: `handlers/ui.js`
- Purpose: serve extracted browser service modules under `admin/public/services/`
- Response: `200 application/javascript`

### `GET /components/*`

- Handler: `handlers/ui.js`
- Purpose: serve extracted browser component modules under `admin/public/components/`
- Response: `200 application/javascript`

## Health And State

### `GET /health`

- Handler: `handlers/health.js`
- Purpose: report service and storage health
- Response body includes:
  - `status`
  - `timestamp`
  - `uptimeMs`
  - `storage`

### `GET /api/state`

- Handler: `handlers/state.js`
- Purpose: return the full persisted admin state plus generated student campaigns
- Response body:
  - `state.settings`
  - `state.active`
  - `state.menuCampaign`
  - `state.idleCampaigns`
  - `state.visitorCampaigns`
  - `state.students`
  - `state.studentProfiles`
  - `state.generatedStudentCampaigns`
  - `state.updatedAt`

### `GET /runtime-config`

- Handler: `handlers/state.js`
- Purpose: return the normalized player runtime projection
- Response body includes:
  - `settings`
  - `active`
  - `idleCampaign`
  - `menuCampaign`
  - `visitorCampaign`
  - `students`
  - `updatedAt`

## Media

### `GET /media/:filename`

- Handler: `handlers/media.js`
- Purpose: serve uploaded media from the upload directory
- Success response: binary body with `Content-Type`, `Content-Length`, and cache headers
- Common failures:
  - invalid path: `400 validation_failed`
  - missing file: `404 validation_failed`

### `POST /api/media/upload`

- Handler: `handlers/media.js`
- Purpose: upload one media file via `multipart/form-data`
- Success response: `201` with upload metadata returned by the media service
- Common failure:
  - non-multipart requests return `400 validation_failed` with `invalid_content_type`

## Campaign Management

### `POST /api/campaigns`

- Handler: `handlers/campaigns.js`
- Purpose: create a new idle or visitor campaign
- Expected body:
  - `kind`: `idle` or `visitor`
  - `campaignName`
  - `items`
- Success response: `201 { state }`

### `PUT /api/campaigns/:id`

- Handler: `handlers/campaigns.js`
- Purpose: update campaign name and/or items
- Success response: `200 { state }`

### `DELETE /api/campaigns/:id`

- Handler: `handlers/campaigns.js`
- Purpose: delete an existing campaign and repair active selections if needed
- Success response: `200 { state }`

## Active Config And Settings

### `POST /api/active`

- Handler: `handlers/config.js`
- Purpose: update active idle and visitor campaign ids
- Body can include:
  - `idleCampaignId`
  - `visitorCampaignId`
- Success response: `200 { state }`
- Missing referenced campaigns return `404 validation_failed`

### `POST /api/settings`

- Handler: `handlers/config.js`
- Purpose: update global settings
- Supported body:
  - `inactivityTimeoutMs`
- Success response: `200 { state }`

### `POST /api/menu-campaign`

- Handler: `handlers/config.js`
- Purpose: replace the menu campaign
- Body:
  - `campaignName`
  - `items`
- Success response: `200 { state }`

## Student Data

### `POST /api/students`

- Handler: `handlers/students.js`
- Purpose: create or replace a manual student campaign mapping
- Body:
  - `nfcUid`
  - `name`
  - `items`
- Success response: `200 { state }`

### `POST /api/students/import`

- Handler: `handlers/students.js`
- Purpose: replace `studentProfiles` with profile-style input used for generated campaigns
- Body:
  - `students`: array of objects with `nfcUid`, `displayName`, `timetableImageUrl`, optional `nextClassText`
- Success response:
  - `200`
  - `{ state, imported }`

### `GET /api/students/:uid/campaign`

- Handler: `handlers/students.js`
- Purpose: build and return the generated campaign for a student profile
- Success response:
  - `200`
  - `{ nfcUid, name, campaign }`
- Failure:
  - unknown UID returns `404 validation_failed`

### `DELETE /api/students/:uid`

- Handler: `handlers/students.js`
- Purpose: delete a manual student mapping from `state.students`
- Success response: `200 { state }`

## Validation Expectations

Campaign item validation currently enforces:

- at least one item
- unique `contentId` values within a campaign
- `type` in `TEXT | IMAGE | VIDEO`
- integer `order >= 1`
- integer `durationSec >= 1`
- non-empty `data`
- image/profile URLs limited to `/media/*` or `http(s)` for profile imports

For the exact rules, see [`admin/src/storage/validators.js`](/home/fergyah/School/S8/PROJ/Project/ids/admin/src/storage/validators.js).
