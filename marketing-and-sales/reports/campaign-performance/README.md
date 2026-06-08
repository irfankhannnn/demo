# Campaign Performance Data — Input Drop Zone

This directory holds ad performance exports from Meta Ads, LinkedIn Ads, Google Ads, etc.
The channel-cac-analysis and messaging-optimizer skills read from here.

## Required Files

### meta-YYYY-W##.csv (Weekly Upload)
Meta Ads Manager export. Required columns:
```
campaign_name, ad_set_name, ad_name, spend, impressions, clicks, leads,
ctr, cpl, frequency, date_range_start, date_range_end
```

How to export from Meta Ads Manager:
1. Open Ads Manager → Reporting
2. Date range: last 7 days
3. Breakdown by: Ad Set
4. Columns: include all required fields above
5. Export → CSV
6. Save here as `meta-YYYY-W##.csv`

### linkedin-YYYY-MM.csv (Monthly Upload)
LinkedIn Campaign Manager export. Required columns:
```
campaign_name, spend, impressions, clicks, leads, ctr, cpl, date_range
```

### google-YYYY-W##.csv (Weekly, if running Google Ads)
Google Ads export. Required columns:
```
campaign, ad_group, keyword, spend, impressions, clicks, leads, ctr, cpl
```

## Upload Schedule

| File | Frequency | Day | Skill That Reads It |
|------|-----------|-----|---------------------|
| `meta-YYYY-W##.csv` | Weekly | Monday AM | channel-cac-analysis, messaging-optimizer |
| `linkedin-YYYY-MM.csv` | Monthly | 1st of month | channel-cac-analysis |
| `google-YYYY-W##.csv` | Weekly (if running) | Monday AM | channel-cac-analysis |

## Cross-Reference with Pipeline

For channel-cac-analysis to compute EFFECTIVE CAC (not just CPL), it needs to join
this data with pipeline data using UTM parameters:
- Ad → tracks `utm_source=meta`, `utm_campaign=campaign_name`
- Pipeline lead → has matching `utm_source`, `utm_campaign`
- Customer conversion → traced back through pipeline to original ad

**Critical:** Every ad MUST have UTM params on its landing URL. Otherwise effective CAC
analysis is impossible.

## UTM Standard

```
utm_source=meta|linkedin|google|email|organic|referral
utm_medium=cpc|social|email|organic
utm_campaign=<campaign-name-slug>
utm_content=<creative-id>
utm_term=<keyword if applicable>
```
