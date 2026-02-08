---
name: icp-research
description: >
  Conduct Ideal Customer Profile analysis, map firmographic data, build buyer personas,
  and estimate market sizes for target segments. Use for audience research, lead
  targeting strategy, and market sizing.
allowed-tools: Read, Bash, Write, Grep
---

# ICP Research

Conduct deep ICP (Ideal Customer Profile) analysis for Cloudberry CRM. Focus: $ARGUMENTS

## Research Framework

### 1. Define Target Segments

| Segment | Description | Estimated Size | Priority |
|---------|-------------|----------------|----------|
| Indian Developers | RE developers with 5+ active projects | ~15,000 | HIGH |
| Dubai Brokerages | Licensed brokerages with 10+ agents | ~5,000 | HIGH |
| Indian Brokerages | RERA-registered in top 10 cities | ~50,000 | MEDIUM |
| Property Managers | Managing 50+ units, India/Dubai | ~10,000 | MEDIUM |
| Boutique Agencies | Small teams (1-10) selling luxury | ~20,000 | MEDIUM |

### 2. Company Profile Template
For each target company, capture:
- Industry / sub-vertical / geography
- Company size / revenue / age
- Current CRM / tech maturity
- Key integrations needed (WhatsApp, calling, portals)
- Trigger events / budget cycle / decision speed

### 3. Buyer Persona Template
For each decision-maker type:
- Title / experience / reports to
- Primary goal / biggest frustration / success metric
- Role in purchase / evaluation criteria / common objections
- Information sources / trigger phrase

### 4. Lead Scoring Model
```
Lead Score (0-100) = Firmographic Fit (40%) + Behavioral Signals (30%) + Timing (30%)
```

### 5. Output

Save to `marketing-and-sales/research/icp-report-[segment].md`:
```markdown
# ICP Report: [Segment]
## Ideal Company Profile
## Buyer Personas (2-3)
## Market Size (TAM/SAM/SOM)
## Targeting Recommendations
## Lead List Schema (CSV columns)
```
