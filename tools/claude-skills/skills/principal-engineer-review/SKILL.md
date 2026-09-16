---
name: principal-engineer-review
description: >
  Review application code for architecture, maintainability, scalability,
  coupling, and testability. Identifies duplicated logic and maintenance risks.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Principal Engineer Review

Review application code changes in: $ARGUMENTS

## Checklist

- [ ] Module boundaries respected
- [ ] No duplicated logic introduced
- [ ] Functions follow Single Responsibility
- [ ] No N+1 query patterns
- [ ] Error handling appropriate
- [ ] TypeScript types properly defined (no `any`)
- [ ] Follows existing codebase patterns
- [ ] Test coverage for critical changes

## Output

Save to `<output_dir>/principal-engineer.md` with findings and recommendations.
