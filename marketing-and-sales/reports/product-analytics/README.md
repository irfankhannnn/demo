# Product Analytics Data — Input Drop Zone

This directory is where humans (or automation) drop data exports from PostHog, the CRM,
and other product analytics sources. The funnel-analysis and retention-analysis skills
read from here.

## Required Files

### events-YYYY-W##.csv (Weekly Upload)
PostHog event export. Required columns:
```
user_id, event_name, timestamp, properties, source
```

Required event names (must be instrumented in the Cloudberry CRM):
- `user_signed_up`
- `first_property_listed`
- `crm_contact_added`
- `team_member_invited`
- `whatsapp_connected`
- `dashboard_viewed`
- `user_session_start`

How to export from PostHog:
1. Open PostHog → Insights → New Insight → Trends
2. Filter for the required events above
3. Date range: last 7 days (weekly) or last 90 days (cohort analysis)
4. Export → CSV
5. Save here with naming: `events-YYYY-W##.csv`

### users-YYYY-W##.csv (Weekly Upload)
User properties snapshot. Required columns:
```
user_id, signup_date, plan, company_size, icp_segment, source_utm
```

How to export from CRM:
- DynamoDB users table → export user IDs + properties
- Join with pipeline.csv for `icp_segment` if not in CRM

### customers-YYYY-MM.csv (Monthly Upload)
Active customer list with churn data. Required columns:
```
user_id, signup_date, plan, mrr, last_login, days_active_last_30, churn_date (null if active)
```

## Upload Schedule

| File | Frequency | Day | Skill That Reads It |
|------|-----------|-----|---------------------|
| `events-YYYY-W##.csv` | Weekly | Sunday | funnel-analysis, retention-analysis |
| `users-YYYY-W##.csv` | Weekly | Sunday | funnel-analysis, retention-analysis |
| `customers-YYYY-MM.csv` | Monthly | 1st of month | retention-analysis |

## Data Quality Checklist

Before uploading, verify:
- [ ] Column headers match exactly (case-sensitive)
- [ ] No empty `user_id` rows
- [ ] Timestamps in ISO 8601 format
- [ ] All required events present in the export
- [ ] UTM `source` populated for at least 80% of users

If data quality is poor, the analysis skills will produce LOW confidence reports
or halt entirely. Better to fix at the source than receive bad insights.
