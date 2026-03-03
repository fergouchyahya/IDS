# IDS

Interactive Digital Signage project with `admin`, `player`, and shared modules.

## Verification

Run the full backend verification suite before and after refactor PRs:

```bash
make verify-all
```

Equivalent direct command:

```bash
./scripts/verify-all.sh
```

## Package Test Commands

```bash
npm --prefix admin test
npm --prefix player test
node --test shared/test/*.test.js
```
