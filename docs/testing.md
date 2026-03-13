# Testing And Verification

This document explains what is tested in the current working tree and records the present verification state.

## Main Commands

Install dependencies:

```bash
make install
```

Validate the shared config example:

```bash
make validate
```

Run all available test suites individually:

```bash
npm --prefix admin test
npm --prefix player test
node --test shared/test/*.test.js
```

Run the repo verification helper:

```bash
make verify-all
```

## What Each Suite Covers

### Admin

Package command:

```bash
npm --prefix admin test
```

Coverage areas:

- integration HTTP coverage in `admin/test/integration/`
- storage/repository flow coverage
- service delegation tests
- validator tests
- admin public service tests

Important test files:

- [`../admin/test/integration/admin-api.test.js`](/home/fergyah/School/S8/PROJ/Project/ids/admin/test/integration/admin-api.test.js)
- [`../admin/test/integration/storage-flow.test.js`](/home/fergyah/School/S8/PROJ/Project/ids/admin/test/integration/storage-flow.test.js)
- [`../admin/test/unit/services.test.js`](/home/fergyah/School/S8/PROJ/Project/ids/admin/test/unit/services.test.js)

### Player

Package command:

```bash
npm --prefix player test
```

Coverage areas:

- state transition integration
- state machine unit behavior
- regression coverage for single-item campaign scrolling

Important test files:

- [`../player/test/integration/state-flow.test.js`](/home/fergyah/School/S8/PROJ/Project/ids/player/test/integration/state-flow.test.js)
- [`../player/test/unit/state-machine.test.js`](/home/fergyah/School/S8/PROJ/Project/ids/player/test/unit/state-machine.test.js)

### Shared

Command:

```bash
node --test shared/test/*.test.js
```

Coverage areas:

- config parsing
- error behavior
- generic validation helpers

## Current Verification Status

On the current working tree:

- the admin package test command passes in a normal local environment
- the player package test command passes
- the shared package test command passes

Important environment note:

- the admin integration tests start a real local HTTP server bound to `127.0.0.1`
- in restricted sandboxes that forbid opening local listening sockets, those tests fail with `listen EPERM`
- that sandbox restriction is not a repo regression when the same suite passes outside the sandbox

## Practical Verification Checklist For Documentation Changes

- confirm every documented route exists in `router.js`
- confirm every documented env var exists in `.env.example`, `shared/config`, or deploy env files
- confirm every documented command exists in the `Makefile`, package scripts, or deploy scripts
- check internal Markdown links after deleting obsolete docs
