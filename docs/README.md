# Docs Guide

This directory is for durable project documentation, not working scratchpads.

## What belongs here

- Architecture notes that still match the running code
- Deployment notes that match the current `deploy/` files
- Small decision records when a tradeoff needs to be preserved
- Contributor guidance that would otherwise bloat the root README

## What should not live here

- Large speculative refactor plans
- Duplicated README content
- Branch-specific TODO dumps that go stale after one round of changes

## Current Documentation Strategy

- The root [`README.md`](/home/fergyah/School/S8/PROJ/Project/ids/README.md) explains how to run and navigate the repo.
- [`ROADMAP.md`](/home/fergyah/School/S8/PROJ/Project/ids/ROADMAP.md) is the only root planning document.
- Package-specific README files explain `admin`, `player`, and `shared`.
- Module-deep documents should stay near the package they describe unless they are cross-cutting.

## Next Useful Docs

- `docs/deployment/pi.md` for Raspberry Pi install, restart, smoke-check, and rollback flow
- `docs/adr/` if architecture decisions start drifting again
- `docs/testing.md` if verification grows beyond the current Makefile/test commands
