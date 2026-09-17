---
name: security-audit
description: >
  Run a comprehensive security audit on the Cloudberry CRM codebase. Checks for
  OWASP Top 10 vulnerabilities, exposed secrets, auth issues, and dependency
  vulnerabilities. Use after code changes or periodically for security review.
allowed-tools: Read, Grep, Glob, Bash
context: fork
agent: Explore
---

# Security Audit

Run a comprehensive security scan of the Cloudberry CRM platform. Focus area: $ARGUMENTS

## Audit Phases

### Phase 1: Secret Detection
```bash
# Scan for hardcoded secrets, API keys, tokens
grep -rn --include="*.js" --include="*.ts" --include="*.tsx" --include="*.env" \
  -iE "(api[_-]?key|secret|password|token|credential|private[_-]?key)\s*[:=]" .

# Verify .env files are gitignored
cat .gitignore | grep -i "env"

# Check .env.example files don't contain real values
find . -name ".env.example" -exec cat {} \;
```

### Phase 2: Authentication & Authorization
- Review `agency-app/api/middleware/auth.js` for JWT implementation
- Check token expiration and refresh logic
- Verify auth middleware on all protected routes
- Check CORS configuration in `agency-app/api/server.js`
- Verify `x-api-key` validation on internal API routes

### Phase 3: Input Validation
- Check all route handlers for request body validation
- Look for NoSQL injection patterns in DynamoDB queries
- Check for XSS via `dangerouslySetInnerHTML` in React components
- Verify file upload validation if any

### Phase 4: Dependency Vulnerabilities
```bash
cd server && npm audit --json 2>/dev/null | head -100
cd real-estate-crm-app && npm audit --json 2>/dev/null | head -100
```

### Phase 5: Data Security
- Verify TENANT# prefix isolation in DynamoDB queries
- Check PII handling and logging practices
- Review CloudFormation IAM policies

## Output Format

```markdown
## Security Audit Report — [Date]

### Summary: X Critical | Y High | Z Medium | W Low

### Findings
[Ordered by severity with file:line references]

### Remediation Steps
[Prioritized fix list]
```
