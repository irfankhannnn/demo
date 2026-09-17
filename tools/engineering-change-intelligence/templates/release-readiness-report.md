# Release Readiness Report

<!-- Do not rename the "## ..." headings, the "Risk Level" and "Release Readiness Score" table labels, or the "## Recommendation" + **GO_NO_GO** shape: scripts/post-to-slack.sh parses them. GO_NO_GO is one of Approve, Review Required, Block. -->

## Metadata
- **PR:** #{{PR_NUMBER}} — {{PR_URL}}
- **Branch:** {{BRANCH}}
- **Base:** {{BASE_BRANCH}}
- **Analyzed:** {{TIMESTAMP}}
- **Agents Run:** {{AGENTS_RUN}}

## Executive Summary

| Metric | Value |
|--------|-------|
| Files Changed | {{FILES_CHANGED}} |
| Lines Added | +{{LINES_ADDED}} |
| Lines Removed | -{{LINES_REMOVED}} |
| Commits | {{COMMIT_COUNT}} |
| Release Readiness Score | {{READINESS_SCORE}}/100 |
| Risk Level | {{RISK_LEVEL}} |
| Rollback Complexity | {{ROLLBACK}} |
| Deployment Complexity | {{DEPLOYMENT_COMPLEXITY}} |

## Features

{{FEATURES_IMPACTED}}

## Services

{{SERVICES_IMPACTED}}

## Infrastructure

{{INFRASTRUCTURE_CHANGES}}

## Security

{{SECURITY_SUMMARY}}

## Cost Impact

{{COST_IMPACT}}

## Observability

{{OBSERVABILITY_GAPS}}

## Rollback

{{ROLLBACK_ASSESSMENT}}

## Top Risks

1. {{RISK_1}}
2. {{RISK_2}}
3. {{RISK_3}}
4. {{RISK_4}}
5. {{RISK_5}}

## Recommended Monitoring

{{MONITORING_RECOMMENDATIONS}}

## Agent Findings Summary

| Agent | Status (Ran / Skipped) | Critical/High Findings |
|-------|--------|-------------------|
| PR Intelligence | {{PR_INTEL_STATUS}} | {{PR_INTEL_SUMMARY}} |
| Architecture | {{ARCH_STATUS}} | {{ARCH_SUMMARY}} |
| CI/CD | {{CICD_STATUS}} | {{CICD_SUMMARY}} |
| Database | {{DB_STATUS}} | {{DB_SUMMARY}} |
| Security | {{SEC_STATUS}} | {{SEC_SUMMARY}} |
| SRE & Observability | {{SRE_STATUS}} | {{SRE_SUMMARY}} |
| FinOps | {{FINOPS_STATUS}} | {{FINOPS_SUMMARY}} |
| Principal Engineer | {{PE_STATUS}} | {{PE_SUMMARY}} |

## Recommendation

**{{GO_NO_GO}}**

{{RECOMMENDATION_RATIONALE}}
