# Admin Package

The admin package owns the control plane:

- admin HTTP API
- runtime-config projection for the player
- campaign and student storage
- media upload and serving
- browser admin UI

## Entry Points

- [`src/index.js`](/home/fergyah/School/S8/PROJ/Project/ids/admin/src/index.js) starts the service.
- [`src/server.js`](/home/fergyah/School/S8/PROJ/Project/ids/admin/src/server.js) wires dependencies and starts the HTTP server.
- [`src/router.js`](/home/fergyah/School/S8/PROJ/Project/ids/admin/src/router.js) dispatches routes.

## Main Layers

- `src/handlers/` - HTTP orchestration only
- `src/services/` - domain operations
- `src/storage/` - repository, validators, runtime projection helpers
- `src/utils/` - request and media helpers
- `public/` - browser UI and extracted frontend modules

## Frontend Modules

- `public/services/editor-view.js` - form synchronization and validation rendering
- `public/services/editor-controller.js` - campaign-level editor transitions and validation orchestration
- `public/services/runtime-deps.js` - dependency builders for the extracted frontend services
- `public/services/render-helpers.js` - overview, builder, and inspector render glue
- `public/services/block-ops.js` - builder/menu block mutation and drag/drop helpers
- `public/services/editor-state.js` - campaign load and duplicate flows
- `public/services/actions.js` - async save/publish/delete/upload flows

## Current Hotspot

`public/admin-ui.js` is still a transitional file. Several modules have already been extracted, but the final orchestration cleanup is not complete.

## Verification

```bash
npm --prefix admin test
```

See [`ADMIN_MODULES_DOCUMENTATION.md`](/home/fergyah/School/S8/PROJ/Project/ids/admin/ADMIN_MODULES_DOCUMENTATION.md) for the deeper module map.
