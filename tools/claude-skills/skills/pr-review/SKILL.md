---
name: pr-review
description: >
  Review recent code changes for quality, performance, security, and best practices.
  Generates detailed review with actionable feedback and auto-updates documentation.
  Use after code modifications or before merging.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Pull Request Review

Review recent code changes and provide comprehensive feedback. Scope: $ARGUMENTS

## Review Process

### 1. Gather Changes
```bash
git diff --stat HEAD~1
git diff --name-only HEAD~1
git log --oneline -5
```

### 2. Review Checklist

**Code Quality:**
- [ ] Clear variable/function naming
- [ ] No duplicated code (DRY)
- [ ] Proper error handling (try/catch)
- [ ] No `console.log` in production code
- [ ] TypeScript: no `any` types
- [ ] Functions follow Single Responsibility

**Performance:**
- [ ] No N+1 DynamoDB query patterns
- [ ] React: proper `useMemo`/`useCallback` usage
- [ ] No unnecessary re-renders
- [ ] List rendering has `key` props

**Security:**
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Auth middleware applied
- [ ] Error messages don't leak internals

**Consistency:**
- [ ] Follows existing code patterns
- [ ] Matches project conventions
- [ ] Uses existing utilities where available

### 3. Generate Review Report

```markdown
## PR Review Summary

**Files Changed:** X | **Lines +/-:** Y/Z | **Risk:** Low/Medium/High

### Critical Issues (Must Fix)
### Warnings (Should Fix)
### Suggestions (Consider)
### Performance Notes
### Test Coverage Gaps
```

### 4. Update Documentation
After review, update any affected documentation files:
- CLAUDE.md, ARCHITECTURE.md, README files
- JSDoc comments for new/changed functions
- Type definitions for changed data models
