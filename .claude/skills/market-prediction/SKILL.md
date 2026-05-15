---
name: market-prediction
description: >
  Predict which CRM features, marketing hooks, and content strategies will deliver
  the highest conversion rates. Analyzes historical data and market signals to
  forecast performance. Use for feature prioritization, ad hook selection, and
  channel ROI forecasting.
allowed-tools: Read, Grep, Bash, Write
---

# Market Prediction

Generate data-driven predictions for Cloudberry growth decisions. Focus: $ARGUMENTS

## Prediction Models

### 1. Feature Impact Scoring (0-100)
- Demand Signals (0-30): competitor gaps, community requests, trend data
- Competitive Advantage (0-25): uniqueness, defensibility
- Implementation Feasibility (0-20): time-to-ship
- Revenue Potential (0-25): signup impact, churn reduction, upsell

Priority: Ship Now (80+) | Next Sprint (60-79) | Backlog (40-59) | Skip (<40)

### 2. Ad Hook Performance Prediction
For each hook, score:
- Emotional Resonance (1-10): pain, aspiration, urgency
- Pattern Match (1-10): similar hook historical CTR
- Platform Fit (1-10): per-platform alignment
- Audience Match (1-10): ICP alignment, segment size

Output: Predicted CTR range, CPA range, confidence level

### 3. Channel ROI Forecast
Model spend vs predicted leads/CPA/ROAS for:
Meta Ads, LinkedIn Ads, Google Ads, Content/SEO, Email, Referral

### 4. Seasonality Calendar
Map India and Dubai real estate market cycles to campaign strategy.

### 5. Output

Save to `marketing-and-sales/reports/predictions/prediction-[topic]-[date].md`:
```markdown
# Prediction: [Topic]
## Methodology & Assumptions
## Scenarios (optimistic/base/pessimistic)
## Recommendation with Confidence Level
## Risk Factors
## Tracking Plan (how to validate)
```
