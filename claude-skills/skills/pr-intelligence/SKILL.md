---
name: pr-intelligence
description: >
  Analyze PR commits, authors, file changes, and impact mapping. Groups files
  by category and identifies services/features impacted. First agent in the
  Engineering Change Intelligence pipeline.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Write
---

# PR Intelligence Analysis

Analyze the PR context in: $ARGUMENTS

## Process

1. Read `diff.patch`, `files-changed.txt`, `commits.txt`, `context.json`
2. Parse commit timeline and authors
3. Group files by category (application, infrastructure, k8s, cicd, database, security)
4. Map files to services in this monorepo:
   - `server/` → Backend API
   - `real-estate-crm-app/` → CRM Frontend
   - `ai-calling-service/` → AI Calling
   - `reality-flow-authentication/` → Auth Service
   - `onboarding-page/` → Onboarding
5. Infer features from changed routes, components, API endpoints
6. Write executive summary (< 200 words)

## Output

Save to `<output_dir>/pr-intelligence.md` using template at `engineering-change-intelligence/templates/pr-intelligence-report.md`
