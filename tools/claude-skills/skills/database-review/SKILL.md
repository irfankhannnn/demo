---
name: database-review
description: >
  Review database migrations, SQL, and schema changes. Assesses locking risk,
  migration risk, rollback complexity, and query performance impact.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Database Review

Review database changes in: $ARGUMENTS

## Checklist

- [ ] Schema changes documented (tables, columns, indexes)
- [ ] Migration locking risk assessed
- [ ] Backward compatibility maintained
- [ ] Rollback path defined
- [ ] Index impact on write performance
- [ ] DynamoDB GSI implications (eventual consistency, cost)
- [ ] Data migration needed for schema changes

## Output

Save to `<output_dir>/database.md` with risk assessment and recommendations.
