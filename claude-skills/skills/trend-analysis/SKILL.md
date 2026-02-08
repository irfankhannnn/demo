---
name: trend-analysis
description: >
  Identify market trends, CRM pain points, and competitive signals by analyzing
  social media, forums, and competitor activity. Use for market research,
  content inspiration, and growth strategy.
allowed-tools: Read, Bash, Write, Grep
---

# Market Trend Analysis

Research and analyze current market trends for the real estate CRM space. Focus: $ARGUMENTS

## Research Protocol

### 1. Define Search Scope
Target keywords based on the focus area:
- CRM pain points: "CRM frustrating", "CRM alternative", "hate my CRM"
- Real estate tech: "proptech 2025", "real estate AI", "property management software"
- Buying signals: "looking for CRM", "switching CRM", "CRM recommendation"
- Geographic: "Dubai real estate tech", "India proptech", "RERA compliance CRM"

### 2. Analyze Competitor Activity
Track moves from: Salesforce, HubSpot, Zoho, Follow Up Boss, LionDesk, Propertybase, Sell.Do

### 3. Classify Findings

For each signal found:
```markdown
## Signal: [Title]
- **Source:** [Platform/URL]
- **Category:** Pain Point | Feature Request | Market Shift | Buying Signal
- **Strength:** Strong | Medium | Weak
- **Relevance:** High | Medium | Low
- **Actionable Insight:** [What Cloudberry should do]
- **Time Sensitivity:** Immediate | This Quarter | Long-term
```

### 4. Score Pain Points
Priority = (Frequency × 0.3) + (Intensity × 0.3) + (Addressability × 0.2) + (Uniqueness × 0.2)

### 5. Output Report

Save to `marketing-and-sales/research/trend-report-[date].md`:
```markdown
# Trend Report — [Date]

## Executive Summary
## Top 5 Trends
## Competitor Moves
## Recommended Actions (per team)
## Content Hook Opportunities
```
