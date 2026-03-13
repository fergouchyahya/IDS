# IDS Docs

This directory contains the canonical documentation for the `ids/` workspace. The goal is durability: each file here should describe the code as it actually exists now, not a future plan.

## Read By Goal

- New to the project:
  [`architecture/overview.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/overview.md)
  [`glossary.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/glossary.md)
- Seeing what is still unfinished:
  [`status.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/status.md)
- Understanding the services:
  [`architecture/admin.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/admin.md)
  [`architecture/player.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/player.md)
  [`architecture/shared.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/architecture/shared.md)
- Calling the APIs:
  [`api/admin.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/api/admin.md)
  [`api/player.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/api/player.md)
- Deploying and operating:
  [`operations/deployment-pi.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/operations/deployment-pi.md)
- Running tests and understanding current verification status:
  [`testing.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/testing.md)

## Documentation Rules

- Keep docs source-backed: derive behavior from code, tests, env config, and deploy assets.
- Keep only one durable status tracker here: [`status.md`](/home/fergyah/School/S8/PROJ/Project/ids/docs/status.md). Do not recreate multiple roadmap or worklog files.
- When the code changes, update the canonical doc instead of adding a second competing note.
- If an old Markdown file stops matching reality, merge any still-useful content and delete the stale file.
