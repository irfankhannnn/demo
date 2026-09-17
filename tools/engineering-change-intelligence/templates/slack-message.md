# Slack Message Template (manual paste / preview only)

Nothing reads this file. `scripts/post-to-slack.sh` builds the webhook payload itself from `release-readiness.md`. Use this layout only when you want to paste a summary into Slack by hand. It is written in Slack mrkdwn: `*bold*`, no `#` headings, `<url|text>` links.

---

```
*{{PR_LABEL}} - Engineering Change Intelligence*
<{{PR_URL}}|View change>

*Risk:* {{RISK_LEVEL}}
*Readiness:* {{READINESS_SCORE}}/100
*Recommendation:* {{GO_NO_GO}}

*Features*
{{FEATURES_LIST}}

*Services*
{{SERVICES_LIST}}

*Infrastructure*
{{INFRASTRUCTURE_LIST}}

*Security*
{{SECURITY_FINDINGS}}

*Cost Impact*
{{COST_ESTIMATE}}

*Observability*
{{OBSERVABILITY_GAPS}}

*Rollback*
{{ROLLBACK_COMPLEXITY}}

*Top Risks*
1. {{RISK_1}}
2. {{RISK_2}}
3. {{RISK_3}}
4. {{RISK_4}}
5. {{RISK_5}}

*Recommended Monitoring*
{{MONITORING_LIST}}

_Engineering Change Intelligence (local run)_
```
