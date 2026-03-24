## Summary

- 

## Refactor Scope

- [ ] Single concern PR (no unrelated changes)
- [ ] No endpoint contract change, or change is explicitly documented

## Verification

- [ ] `make verify-all` passed locally
- [ ] Added/updated tests for changed behavior
- [ ] Manual smoke check done for affected flow

## Quality Checklist

- [ ] File-level headers present in new files
- [ ] Function-level headers present for new/changed functions
- [ ] Layer boundaries respected (router -> handler -> service -> storage/data)
- [ ] Error path logging and user-facing error response verified

## Rollback

- [ ] Reverting this PR alone restores previous behavior

## Notes

- Risks:
- Follow-ups:
