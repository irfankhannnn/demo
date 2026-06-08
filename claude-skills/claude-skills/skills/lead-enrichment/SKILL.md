---
name: lead-enrichment
description: >
  Enrich captured leads with firmographic, technographic, and contact data.
  Validates emails/phones, deduplicates records, applies lead scoring, and
  tracks progress toward the 100k lead goal. Use for lead data processing
  and enrichment workflows.
allowed-tools: Read, Write, Bash, Grep
---

# Lead Enrichment

Enrich and score leads for the Cloudberry pipeline. Focus: $ARGUMENTS

## Enrichment Pipeline

### Stage 1: Validation
- **Email:** Format check, MX records, disposable detection, role-based flagging
- **Phone:** E.164 format, India (+91, 10 digits), UAE (+971, 9 digits), DND check

### Stage 2: Company Enrichment
Firmographics: legal name, domain, industry, employees, revenue, location
Real Estate: RERA/DLD license, active projects, portfolio size, portal listings
Technographics: current CRM, website tech, marketing tools

### Stage 3: Contact Enrichment
Professional: full name, title, department, seniority, LinkedIn, direct phone
Behavioral: web visits, content downloads, social activity, job changes

### Stage 4: Lead Scoring (0-100)

| Component | Weight | Signals |
|-----------|--------|---------|
| Fit Score | 40% | Industry, size, geo, seniority, current CRM |
| Intent Score | 30% | Pricing page, demo request, CRM job postings |
| Engagement Score | 20% | Email opens, clicks, web visits, social |
| Timing Score | 10% | Trigger events, seasonality |

**Grades:** A (80-100) Hot → B (60-79) Warm → C (40-59) Cool → D (20-39) Cold → F (<20) Disqualified

### Stage 5: Deduplication
Match keys: email exact → phone exact → domain+name fuzzy → LinkedIn exact
Merge strategy: keep most complete record, append missing fields, preserve attribution

## Data Quality Targets

| Metric | Target |
|--------|--------|
| Email validity | >90% |
| Phone validity | >85% |
| Company enrichment | >75% |
| Duplicate rate | <5% |
| Scoring coverage | >95% |

## Lead Database Schema
```
lead_id, first_name, last_name, email, email_valid, phone, phone_valid,
company_name, company_domain, job_title, seniority, linkedin_url,
industry, employee_count, revenue_range, city, country, rera_number,
current_crm, fit_score, intent_score, engagement_score, total_score, lead_grade,
source, campaign_id, utm_source, utm_medium, capture_date, status
```

## 100K Progress Tracker
Track by source: Meta Ads (40k), LinkedIn (15k), Google (10k), Content (15k), Referral (5k), Events (5k), Outbound (10k)

Save to `marketing-and-sales/leads/enrichment-report-[date].md`
