---
name: principal-engineer-review
description: >
  Review application code under apps/, services/ and tests/ for architecture,
  maintainability, scalability, coupling and testability. This is the code-review
  gate of the Engineering Change Intelligence pipeline.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# Principal Engineer Review

Review application code changes in: $ARGUMENTS

Codebase: Node/Express on Lambda in `apps/crm/server/` (CommonJS, `routes/`, `middleware/`, `*DynamodbService.js`, REST paths `/api/crm/<resource>`), React + TypeScript + Vite frontends in `apps/*` with strict mode on, TypeScript services in `services/reality-flow-authentication` and `services/reality-flow-mcp`. Error responses are `{ error: string, details?: string }`.

## Checklist

- [ ] Module boundaries respected: routes call their own service module, not another service's table
- [ ] No logic duplicated from an existing module
- [ ] Functions follow single responsibility; no handler that grew a second job
- [ ] No N+1 access pattern (a `GetItem` per row where a `Query` or `BatchGetItem` belongs)
- [ ] Bounded fetches and pagination on anything that grows with tenant size
- [ ] No long or blocking work inside a Lambda handler; queue it instead
- [ ] No new shared mutable state at Lambda module scope (it survives between invocations)
- [ ] Error handling present; no empty `catch`, no missing `await`
- [ ] TypeScript: no new `any`, `@ts-ignore` or non-null `!` hiding a real nullable
- [ ] Follows existing patterns in this monorepo, including the error-response shape
- [ ] Cross-service calls use the domain + base path env pair, never a raw `execute-api` URL
- [ ] Tests updated for a changed contract; new behaviour is reachable from a test
- [ ] A changed API response shape has its matching frontend change in the same diff

Security findings belong to the `security` agent, DynamoDB access-pattern risk to `database`, and cost to `finops`. Note them in one line and name the owner instead of duplicating the review.

## Output

Save to `<output_dir>/principal-engineer.md` with Finding / File:line / Category / Risk / Recommendation. Review the diff, not the whole codebase.
