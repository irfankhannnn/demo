# Day 15 — Replace LP Placeholders With Real Testimonials + Numbers

> **Type:** 🤖 AUTO + 🧍
> **Phase:** Week 3 — Public Launch
> **Skill(s):** `copywriting` + `landing-page` + `copy-editing`
> **Estimated time:** 1h founder + 3h AI

## Objective
Swap every "Coming soon", placeholder testimonial, and lorem-ipsum metric across all 12 LPs with real Day-14 testimonials, real beta-tester counts, real Mumbai locality breakdown, and real product screenshots from the actual demo tenant.

## Why This Matters for RealEstateFlow
LPs went live Day 6 with placeholders. Day 17 cold prospects + organic traffic now visit. They need to see real people, real numbers, real product — not "Built for X agencies" with no proof.

## User Story
As a Mumbai broker visiting `realestateflow.in` on Day 17 morning, I want to see real testimonials from brokers I might know, real beta-cohort numbers, and real CRM screenshots, so I trust this is shipping software not vapourware.

## Acceptance Criteria
- [ ] All 12 LPs have testimonial slots filled with Day-14 captures (5+ testimonials cycled across pages)
- [ ] Beta-cohort number replaces placeholder ("Trusted by 8 Mumbai broker teams") — exact number based on Day-10 active testers
- [ ] Locality breakdown replaces lorem ("From Bandra, Andheri, Powai, Thane, and 4 other Mumbai localities")
- [ ] Product screenshots replaced with demo-tenant captures (mobile + desktop): CRM dashboard, AI Employee transcript, Khata book entry, lead pipeline
- [ ] Hero counters animate with real numbers: "30+ beta sessions this week", "120+ buyers tracked", "180+ properties in CRM" (use rounded real PostHog numbers)
- [ ] OG cards regenerated with new testimonial quote on social-share previews (P8 + P16 templates)
- [ ] Lighthouse re-run on all 12 — score still ≥90
- [ ] Schema validates — testimonials added as `Review` schema entries on /demo + /pricing
- [ ] All testimonials have signed consent (Day 14 forms attached)
- [ ] PR merged + deployed; Day 16 directory submissions reference live URLs

## Manual Steps (🧍)

1. **Capture demo-tenant screenshots** (5 min): open demo tenant, screenshot CRM dashboard / AI Employee transcript / Khata book / lead pipeline (mobile + desktop). Save to `marketing-and-sales/launch-implement/week-3/screenshots/day-15/`.
2. **Verify testimonials** at `marketing-and-sales/launch-implement/week-2/testimonials/` — 5+ ready with consent.
3. **Run AI Prompt below** to generate the diff for all 12 LPs.
4. **Review diffs** + visual regression check on local preview.
5. **Deploy** via Netlify CLI.
6. **Smoke test**: open all 12 LPs, scan testimonial sections, verify numbers + photos load.
7. **Re-submit sitemap** to GSC/Bing/Brave (P16) — content meaningfully changed.
8. **Daily standup**.

## AI Prompt (🤖)

```
Read inputs:
- All 12 LP HTML files in `marketing-and-sales/creative/landing-pages/{slug}/index.html`
- `marketing-and-sales/launch-implement/week-2/day-14-testimonials-index.md`
- All `marketing-and-sales/launch-implement/week-2/testimonials/{slug}/quote.txt` + photo paths
- PostHog dashboard saved Day 4 — pull current numbers (active beta testers, total buyers added, total properties added, sessions last 7d)
- `marketing-and-sales/launch-implement/week-3/screenshots/day-15/*.png` (founder captured demo screenshots)

For each of the 12 LPs:

## Step 1 — Find placeholder slots
Scan each HTML file for known placeholder patterns:
- `XXX customers`, `XXX brokers`, `XXX agencies`, `Coming soon`, `Lorem ipsum`, `[testimonial]`, `[number]`
- Generic stock-photo references in `<img src>`
- Hardcoded "5,000+" or pre-launch claims that aren't true

## Step 2 — Fill with real
For each placeholder:
- **Numbers**: substitute current PostHog numbers (round down for safety: 8 → "8 Mumbai brokers", 120 buyers → "120+ buyers tracked", etc.)
- **Locality**: pull unique localities from beta cohort → "Bandra · Andheri · Powai · Thane · Goregaon · Lower Parel"
- **Testimonials**: cycle through 5 testimonials across pages with appropriate context:
  - Main LP: 2 hero testimonials in carousel
  - /agency-owners: agency-owner-flavor testimonials
  - /agents: solo-broker-flavor testimonials
  - /ai-employee: AI-Employee-specific testimonials
  - /demo: long-form video testimonial embed
  - /pricing: 1-2 social-proof quotes
  - /vs/*: relevant competitor-comparison angle
- **Screenshots**: replace stock with `screenshots/day-15/*.png`

## Step 3 — Add Review schema
For /demo and /pricing, add JSON-LD `Review` blocks per testimonial:
```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "itemReviewed": {"@type": "SoftwareApplication", "name": "RealEstateFlow"},
  "author": {"@type": "Person", "name": "{{tester_name}}"},
  "reviewBody": "{{quote}}",
  "reviewRating": {"@type": "Rating", "ratingValue": 5, "bestRating": 5}
}
```

## Step 4 — Regenerate OG cards
Use `nano-banana-pro` to regenerate /demo and / OG cards with hero testimonial quote overlay (1200×630 + 1080×1080).

## Step 5 — Output diff
Save the full diff at `marketing-and-sales/launch-implement/week-3/day-15-lp-diffs.md` (per-file diff).
Save updated HTMLs in place.
Save new OG card paths.

## Step 6 — Verify
Run validators:
- HTML5 valid
- Schema.org validates
- Lighthouse mobile per page (output expected scores or note degradation risk)
- All `<img>` srcs resolve to real files

Stop. Do not auto-deploy (founder runs Netlify CLI).
```

## Inputs
- All 12 LPs
- Day-14 testimonials + photos + quotes
- PostHog current numbers
- Day-15 demo screenshots

## Outputs
- 12 LP files updated
- `day-15-lp-diffs.md`
- New OG cards in `realestateflow/assets/og/`
- Lighthouse reports

## Success Criterion
All placeholders replaced + Lighthouse still ≥90 + schema valid + LPs deployed Day 15 EOD.

## Fallback / Plan B
If a testimonial isn't ready (consent pending), use placeholder photo + text quote + cite "Beta tester, Andheri" without name until consent lands. Don't ship empty cards.

## Risks
| Risk | Mitigation |
|---|---|
| Numbers shift after deploy (more activity) | Round-down + accept staleness; refresh weekly |
| Photos low-resolution | Capture Day 15 high-res; founder approves before swap |
| Testimonial bias (only positive) | Mix willingness scores 7/10 + 9/10 — not all "perfect" |
| Schema validation fails | Run validator pre-deploy; fix before push |
| OG cards heavy | Compress via Squoosh (P8 pipeline) |

## India / Mumbai-Specific Notes
- Names + photos = real Mumbai brokers; consent explicit
- Localities sound Mumbai-credible (Bandra W, Andheri W — not just "Mumbai")
- Hindi/Marathi names spelled accurately

## Dependencies
- **Blocks:** Day 16 directories (live URLs need real proof), Day 17 cold sequence (LP conversion)
- **Depends on:** Day 14 testimonials, P8 OG templates, P10 PostHog firing

## Connected Skills
- `copywriting` — quote selection
- `landing-page` — LP edits
- `copy-editing` — polish
- `schema-markup` — Review schema
