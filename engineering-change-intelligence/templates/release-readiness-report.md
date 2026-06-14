# Release Readiness Report

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

| Agent | Status | Critical Findings |
|-------|--------|-------------------|
| PR Intelligence | ✅ | {{PR_INTEL_SUMMARY}} |
| Architecture | {{ARCH_STATUS}} | {{ARCH_SUMMARY}} |
| Kubernetes & Helm | {{K8S_STATUS}} | {{K8S_SUMMARY}} |
| CI/CD | {{CICD_STATUS}} | {{CICD_SUMMARY}} |
| Security | ✅ | {{SEC_SUMMARY}} |
| SRE & Observability | ✅ | {{SRE_SUMMARY}} |
| FinOps | {{FINOPS_STATUS}} | {{FINOPS_SUMMARY}} |
| Database | {{DB_STATUS}} | {{DB_SUMMARY}} |
| Principal Engineer | {{PE_STATUS}} | {{PE_SUMMARY}} |

## Recommendation

**{{GO_NO_GO}}**

{{RECOMMENDATION_RATIONALE}}
