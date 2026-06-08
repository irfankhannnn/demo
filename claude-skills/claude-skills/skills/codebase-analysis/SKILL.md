---
name: codebase-analysis
description: >
  Analyze the Cloudberry CRM codebase architecture, identify patterns, plan new modules,
  and generate Architecture Decision Records. Use when planning features, refactoring,
  or understanding the codebase structure.
allowed-tools: Read, Grep, Glob, Bash
context: fork
agent: Explore
---

# Codebase Analysis

Perform a comprehensive analysis of the Cloudberry CRM codebase. If arguments are provided, focus on the specified module or directory: $ARGUMENTS

## Analysis Steps

### 1. Map Directory Structure
Scan the project layout and identify key directories:
- `real-estate-crm-app/src/` — Frontend (React + TypeScript)
- `server/` — Backend (Node.js + Express + DynamoDB)
- `ai-calling-service/` — AI calling microservice
- `onboarding-page/` — Onboarding flow

### 2. Identify Key Patterns
For each module, document:
- **Data flow:** Frontend → API service → Express route → DynamoDB service
- **Naming conventions:** File naming, variable naming, route patterns
- **Error handling:** Try/catch patterns, error response formats
- **Authentication:** JWT middleware usage, protected vs public routes
- **Type definitions:** TypeScript interfaces and their usage

### 3. Module Inventory
List all existing modules with their status:
- Route files in `server/routes/`
- Service files in `server/`
- Frontend pages in `real-estate-crm-app/src/pages/`
- Type definitions in `real-estate-crm-app/src/types/`

### 4. Dependency Analysis
Check `package.json` files for:
- Core dependencies and their versions
- Potential version conflicts
- Missing or unused dependencies

### 5. Generate Report

Output a structured report:
```markdown
## Codebase Analysis Report

### Architecture Summary
[High-level architecture description]

### Module Map
[Table of all modules with status]

### Patterns Identified
[Coding patterns, conventions, anti-patterns]

### Technical Debt
[Issues identified, prioritized]

### Recommendations
[Actionable next steps]
```

## Additional Resources
- For architecture decisions, see [architecture-template.md](../templates/pr-review-template.md)
- For security concerns, delegate to the `sentry` agent
