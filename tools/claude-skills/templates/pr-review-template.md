# PR Review Report

## Metadata
- **Reviewer:** PR Commander Agent
- **Date:** [YYYY-MM-DD]
- **Branch:** [branch-name]
- **Commit Range:** [hash1..hash2]

## Summary

| Metric | Value |
|--------|-------|
| Files Changed | X |
| Lines Added | +Y |
| Lines Removed | -Z |
| Risk Level | Low / Medium / High |
| Test Impact | None / Unit / Integration / E2E |

## Critical Issues (Must Fix Before Merge)

### Issue #1: [Title]
- **File:** `path/to/file.ts:line`
- **Category:** Security / Performance / Logic Error / Data Loss
- **Description:** [What's wrong]
- **Impact:** [What happens if not fixed]
- **Fix:**
```
[Suggested code fix]
```

## Warnings (Should Fix)

### Warning #1: [Title]
- **File:** `path/to/file.ts:line`
- **Category:** Code Quality / Maintainability / Convention
- **Description:** [What could be improved]
- **Suggestion:**
```
[Suggested improvement]
```

## Suggestions (Nice to Have)

1. **[Title]** — [Description] (`file:line`)

## Performance Analysis

| Area | Status | Notes |
|------|--------|-------|
| DynamoDB Queries | OK / Warning | [Details] |
| React Renders | OK / Warning | [Details] |
| Bundle Size | OK / Warning | [Details] |
| API Response Time | OK / Warning | [Details] |

## Security Quick Check

- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Auth middleware applied
- [ ] Error messages sanitized
- [ ] CORS properly configured

## Test Coverage

| Changed File | Has Tests | Coverage |
|-------------|-----------|----------|
| [file] | Yes/No | X% |

### Recommended Test Scenarios
1. [Scenario description]
2. [Scenario description]

## Documentation Updates Needed

- [ ] CLAUDE.md — [What to update]
- [ ] ARCHITECTURE.md — [What to update]
- [ ] API docs — [New/changed endpoints]
- [ ] Type definitions — [New/changed types]

## Verdict

- [ ] **APPROVE** — Ready to merge
- [ ] **REQUEST CHANGES** — Critical issues must be addressed
- [ ] **NEEDS DISCUSSION** — Architecture/design questions to resolve
