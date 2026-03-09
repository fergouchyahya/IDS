# Shared Package

The shared package contains code and assets used by both `admin` and `player`.

## Responsibilities

- environment configuration parsing
- shared validation helpers
- shared error types
- shared HTTP/logger utilities
- JSON contract schema and validation script

## Important Paths

- [`config/index.js`](/home/fergyah/School/S8/PROJ/Project/ids/shared/config/index.js)
- [`errors/index.js`](/home/fergyah/School/S8/PROJ/Project/ids/shared/errors/index.js)
- [`validation/index.js`](/home/fergyah/School/S8/PROJ/Project/ids/shared/validation/index.js)
- [`contract/schema/config.schema.json`](/home/fergyah/School/S8/PROJ/Project/ids/shared/contract/schema/config.schema.json)
- [`contract/scripts/validate-config.js`](/home/fergyah/School/S8/PROJ/Project/ids/shared/contract/scripts/validate-config.js)

## Verification

```bash
node --test shared/test/*.test.js
make validate
```
