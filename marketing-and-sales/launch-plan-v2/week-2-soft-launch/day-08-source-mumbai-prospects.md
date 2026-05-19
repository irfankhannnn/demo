# Day 08 — Source 30-40 Mumbai Beta Prospects (Enriched)

> **Type:** 🤖 AUTO
> **Phase:** Week 2 — Soft Launch
> **Skill(s):** `lead-enrichment` + `serpapi-scraping` + `firecrawl-agent` + `icp-research`
> **Estimated time:** 0.5h founder + 4h AI

## Objective
Build a clean list of 30-40 Mumbai real-estate brokers and small agencies (≤3 agents, active for 1+ year, WhatsApp-reachable) with enriched contact data, personalisation hooks, and ICP-fit scores — ready for Day 9 beta invite outreach.

## Why This Matters for RealEstateFlow
Beta cohort quality = launch quality. 30 well-fit testers > 200 random brokers. Day 8 invests upfront in research so Days 9-14 deliver real signal (testimonials, fixes, paying conversions).

## User Story
As founder running the soft launch, I want a CSV of 30-40 ICP-matched Mumbai brokers with phone + WhatsApp + LinkedIn + 1-line personalisation hook, so Day 9 invites are personal, not generic.

## Acceptance Criteria
- [ ] CSV at `marketing-and-sales/launch-implement/week-2/day-08-mumbai-prospects.csv` with 30-40 rows
- [ ] Columns: name, agency_name, role, locality, phone, email (best-effort), linkedin_url, whatsapp_business_y_n, years_active, est_team_size, icp_fit_score (1-10), personalisation_hook (1 line), source
- [ ] Diverse mix: solo brokers (40%), 2-3 agent agencies (40%), 4+ agencies (20%)
- [ ] Locality mix: Andheri W (8), Bandra W (6), Powai (5), Thane W (5), Goregaon E (4), Lower Parel (3), Worli (3), Borivali W (3), Juhu (2), Vashi (2)
- [ ] All phones validated (Indian 10-digit, leading 9/8/7)
- [ ] At least 25/40 with verified WhatsApp Business profile (preferred for Day 9)
- [ ] No duplicates (dedup by phone)
- [ ] Sources tracked: Google Maps, MagicBricks, 99acres, Housing.com, LinkedIn, Justdial
- [ ] DPDP-compliant: only public business contact info; no scraped personal data
- [ ] Cohort plan at `day-08-cohort-plan.md`: which 8-12 to target first for Day 9 invite (scored highest), which 18-22 for fallback

## Manual Steps (🧍 — small)

1. Approve the AI Prompt scope (cohort size, locality mix, sources).
2. After AI run, spot-check 5 random rows for accuracy (call 1, WhatsApp 1, look up 3 on Google).
3. Move CSV to outreach tooling (Instantly + AiSensy + manual WhatsApp).
4. Tick ACs.

## AI Prompt (🤖)

```
You are a senior B2B lead-enrichment specialist familiar with Indian real-estate broker market in Mumbai.

Inputs:
- `marketing-and-sales/research/icp-report-mumbai-launch.md` (ICP definition)
- `marketing-and-sales/research/buyer-personas-summary.md` (Priya / Arjun / Suresh archetypes)
- `marketing-and-sales/research/mumbai-positioning-strategy.md`
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`

Use these tools (skills) in sequence:

## Step 1 — Discovery
Use `firecrawl-agent` and `serpapi-scraping` to query:
- Google Maps: `real estate broker Mumbai`, `property dealer Andheri`, `real estate agency Bandra`, etc. (one query per locality)
- MagicBricks agent directory: filter by Mumbai
- 99acres agent directory: filter by Mumbai
- LinkedIn search: "real estate broker Mumbai" + "agency owner Mumbai"
- Justdial real estate Mumbai

Collect 80-120 raw candidate rows.

## Step 2 — Enrichment
For each candidate:
- Verify phone via Truecaller-style lookup or Google search (skip if can't verify)
- Find LinkedIn URL via name + agency name
- Check for WhatsApp Business (look for `wa.me` link on their listing or search WhatsApp web)
- Estimate years active (look at agency website "since YYYY" or LinkedIn role start date)
- Estimate team size (LinkedIn employee count or agency website team page)

## Step 3 — ICP scoring
Score each candidate 1-10 on ICP fit:
- +3 if 1-3 agents (sweet spot)
- +2 if active 1-5 years (not too new, not too entrenched)
- +2 if Mumbai-only operations
- +1 if has WhatsApp Business
- +1 if has Google Maps listing with photos + recent reviews
- +1 if LinkedIn shows real activity
- -2 if 10+ agents (out of M1 ICP)
- -1 if no online presence (hard to contact)
- -1 if appears inactive (>1 year no Google review or no LinkedIn post)

Keep candidates scoring 6+. Cap final list at 40.

## Step 4 — Personalisation hooks
For each, write 1-line personalisation hook drawn from public sources:
- "Saw your 5★ Google review re Andheri 2BHK closing — congrats"
- "Noticed you joined LinkedIn in 2019 with focus on Bandra — that's our exact ICP"
- "Your MagicBricks listing for Powai 3BHK ₹2.4Cr looks active — quick question..."
NEVER fabricate. NEVER use info from private sources.

## Step 5 — Locality balance
Adjust mix to hit the locality quotas in ACs:
- Andheri W: 8, Bandra W: 6, Powai: 5, Thane W: 5, Goregaon E: 4, Lower Parel: 3, Worli: 3, Borivali W: 3, Juhu: 2, Vashi: 2

If under-quota in any locality, scrape more from that locality. If over-quota, drop lowest-scoring entries.

## Step 6 — Deduplicate + validate
- Dedup by phone (10-digit normalize)
- Validate phone format (Indian: starts 9/8/7, 10 digits)
- Validate email if present (regex)
- Validate LinkedIn URL pattern

## Output
- `marketing-and-sales/launch-implement/week-2/day-08-mumbai-prospects.csv`: 30-40 rows with all columns
- `marketing-and-sales/launch-implement/week-2/day-08-cohort-plan.md`: top 8-12 (by ICP score) for Day-9 first wave + 18-22 fallback for Day-9 second wave + 5-10 alternates for Week 3 if Week 2 invites underperform

DPDP compliance:
- Only public business contact info
- No scraping of personal-non-business data (kids, home address, personal email)
- Document each row's source so we can defend later if asked

Stop. Do not auto-send any outreach (Day 9 manual).
```

## Inputs
- ICP / persona / positioning research
- Firecrawl + SerpAPI access (`firecrawl-agent` + `serpapi-scraping` skills)

## Outputs
- `marketing-and-sales/launch-implement/week-2/day-08-mumbai-prospects.csv`
- `marketing-and-sales/launch-implement/week-2/day-08-cohort-plan.md`

## Success Criterion
30-40 ICP-fit Mumbai prospects with verified phones + WhatsApp + LinkedIn + personalisation hooks; locality mix matches plan.

## Fallback / Plan B
If Firecrawl + SerpAPI yields <40 candidates, manual fill via founder's existing LinkedIn network + broker WhatsApp groups. Aim for 30 minimum.

## Risks
| Risk | Mitigation |
|---|---|
| Phone numbers stale | Validate via Truecaller spot-check; replace bad rows |
| DPDP scraping risk | Public sources only; source column in CSV |
| ICP miss (e.g., hire too many enterprise) | Score weighting + locality + size cap |
| Personalisation hook hallucinated | "NEVER fabricate" instruction in prompt |

## India / Mumbai-Specific Notes
- WhatsApp Business prevalent — verify by checking wa.me links
- LinkedIn presence variable — many Mumbai brokers minimal LinkedIn activity but Google Maps active
- Justdial + Sulekha legacy but still source for older brokers

## Dependencies
- **Blocks:** Day 9 (need this list)
- **Depends on:** Research/ docs

## Connected Skills
- `lead-enrichment` — primary
- `serpapi-scraping` — Google Maps + Justdial
- `firecrawl-agent` — structured extraction
- `icp-research` — scoring rubric
