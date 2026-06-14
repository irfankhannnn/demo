# PR Intelligence Report Template

## Metadata
- **PR:** #{{PR_NUMBER}}
- **URL:** {{PR_URL}}
- **Branch:** {{BRANCH}} → {{BASE}}
- **Date:** {{DATE}}

## Commit Timeline

| Commit | Author | Date | Message |
|--------|--------|------|---------|
{{COMMIT_ROWS}}

## Change Statistics

| Metric | Value |
|--------|-------|
| Total Commits | {{COMMIT_COUNT}} |
| Files Changed | {{FILES_CHANGED}} |
| Lines Added | +{{LINES_ADDED}} |
| Lines Removed | -{{LINES_REMOVED}} |
| Authors | {{AUTHORS}} |

## Files by Category

### Application
{{APP_FILES}}

### Infrastructure
{{INFRA_FILES}}

### Kubernetes
{{K8S_FILES}}

### CI/CD
{{CICD_FILES}}

### Database
{{DB_FILES}}

### Security
{{SEC_FILES}}

## Impact Analysis

### Services Impacted
{{SERVICES}}

### Features Impacted
{{FEATURES}}

### Business Capabilities Impacted
{{CAPABILITIES}}

## Executive Summary

{{EXECUTIVE_SUMMARY}}
