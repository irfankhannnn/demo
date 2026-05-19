# P2 — Pricing Strategy + Pricing Page Copy

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-17
> **Skill(s):** `pricing-strategy` + `copywriting`
> **Estimated time:** 0.5h founder · 3h AI

## Objective
Lock the canonical pricing data (`pricing.json`), generate the pricing-page English copy + `/pricing` page draft + 5 FAQs that becomes the single source-of-truth imported by both the SPA and the landing pages.

## Why This Matters for RealEstateFlow
Pricing in 6 different LP files is a maintenance trap. By forcing all pricing references to come from `pricing.json` + a single page-copy MD, every future change updates everywhere. We also use this to gate Razorpay product/plan creation in P7 + Razorpay dashboard.

## User Story
As a founder, I want one canonical `pricing.json` + an English `/pricing` page that includes all 4 tiers + annual toggle + AI-Employee no-trial badge + 5 FAQs, so all LPs and the CRM SPA reference the same numbers.

## Acceptance Criteria
- [ ] `marketing-and-sales/launch-plan-v2/pricing.json` exists and is valid JSON (already shipped)
- [ ] `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md` written, English, 1500-2000 words
- [ ] Page copy includes: hero, 4 tier cards, annual toggle UX spec, AI Employee add-on toggle, 5 FAQs, money-back guarantee badge, GST line, comparison table, CTA buttons spec
- [ ] 5 FAQs cover: (1) refund window + anti-abuse, (2) GST invoicing, (3) seat upgrade pro-rata, (4) AI Employee 24h SLA + no-trial reasoning, (5) data export on cancellation
- [ ] `marketing-and-sales/launch-implement/pre-launch/02-pricing/tiers.md` written — competitor benchmark + tier rationale
- [ ] Razorpay product/plan creation checklist at `marketing-and-sales/launch-implement/pre-launch/02-pricing/razorpay-products.md`
- [ ] All numbers match `pricing.json` exactly; no inline overrides

## AI Prompt (🤖)

```
You are a senior B2B SaaS pricing-page writer. Read these inputs:
- `marketing-and-sales/launch-plan-v2/pricing.json` (canonical pricing — DO NOT alter)
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md` (wedge + audience)
- `marketing-and-sales/research/icp-report-mumbai-launch.md` (target persona)
- `marketing-and-sales/research/buyer-personas-summary.md` (Priya / Arjun / Suresh)
- `marketing-and-sales/research/mumbai-positioning-strategy.md` (positioning angles)

Produce 3 outputs:

## 1. `marketing-and-sales/launch-implement/pre-launch/02-pricing/tiers.md` (1000-1500 words)
- Pricing rationale per tier (why ₹999, why ₹1,999, why ₹500 extra-seat, why ₹7,999 AI Employee)
- Competitor benchmark table: Sell.do (~₹1,500/user/mo) · Zoho CRM (~₹720/user/mo) · LeadSquared (~₹3,500/user/mo) · Excel (free) · Sell.Do AI add-on
- Why our pricing is defensible (Mumbai-specific, Indian-rupee-anchored, AI Employee priced as junior-agent replacement)
- Why annual = 20% off (cash-flow + retention math: 20% upfront discount is cheaper than 30% churn at month-3)
- Why Solo + Team + Team+ structure (not per-seat from day 1) — empirical: Indian small-team brokers want a "starter" price anchor below ₹1k
- Why AI Employee has no trial (concierge config cost ~₹2-3k per agency; trial would burn capital before validation)
- Why AI Employee has no refund (manual-config cost is sunk; refund would create gaming)

## 2. `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md` (1500-2000 words)
Section structure (Markdown with H2/H3):

### Hero
- H1: "Honest pricing for honest brokers."
- H2: "₹999 to start. ₹7,999 to hire an AI. No surprises, no hidden fees."
- Trust strip: "14-day free trial · No card · 1-month money-back · GST invoices · Data stays in India"
- Primary CTA: "Start 14-day Free Trial" (links to /signup)
- Secondary CTA: "Talk to a human" (links to /demo Cal.com)

### Annual / Monthly toggle
- Toggle UX: pill switcher above tier cards. Default = Monthly.
- When Annual: prices show "₹{annualPrice}/year (save 20%)" + monthly equivalent in small text.
- AI Employee tier shows "Annual not available" (no annual on add-ons in M1).

### Tier cards (4 cards, mobile = stacked)
For each tier:
- Tier name + price (live-bound to pricing.json)
- 14-day trial badge (Solo/Team/Team+) OR "Paid from day 1 — concierge setup" badge (AI Employee)
- 5-7 bullet features pulled from pricing.json
- "Most Popular" ribbon on Team
- CTA: "Start free trial" (Solo/Team/Team+) OR "Add AI Employee" (AI Employee, opens contact form to confirm AI-Employee plan + start concierge flow)

### Add-on box
- AI Employee row: "Add AI Employee — ₹7,999/mo. Works on WhatsApp + Telegram. Concierge setup within 24h."
- Note: AI Employee requires an active Solo/Team/Team+ subscription.

### Comparison table
- Columns: Solo | Team | Team+ | + AI Employee
- Rows: members, properties (unlimited all), CRM modules, hierarchy, analytics, Khata book, AI Employee add-on, GST invoices, support, refund, trial

### Trust badges
- Mumbai-built · GST 18% · Data in India · 1-month money-back · Razorpay secure

### 5 FAQs
1. **"How does the refund work?"** — 1-month money-back on Solo/Team/Team+ for first-time subscribers, denied if >100 records exported or >50 outbound WhatsApp during trial. AI Employee is non-refundable (concierge cost). Refund processed in 7-10 working days.
2. **"Do I get a GST invoice?"** — Yes, every payment generates an HSN 998314 invoice with our GSTIN. Maharashtra customers see CGST+SGST split; outside customers see IGST. Download from `Settings → Billing`.
3. **"What if I add a 4th team member mid-month?"** — Team+ kicks in. We charge ₹500 prorated for the remaining days of the cycle, then ₹500/month thereafter. Auto-handled in the in-app upgrade flow.
4. **"Why no trial on AI Employee?"** — Each AI Employee is configured by hand by our support team (24h SLA). The concierge cost is real and sunk; we'd rather charge fairly from day 1 than build trial-abuse safeguards. If your AI Employee isn't running 30 days after purchase, we refund pro-rata.
5. **"What happens to my data if I cancel?"** — You can export full CSV from `Settings → Data Export` for 30 days post-cancellation. After 30 days, we delete per Privacy Policy.

### Footer / final CTA
- Recap: "14 days. No card. Cancel anytime."
- Final CTA: "Start free trial" (large)
- Tertiary CTAs: "Compare to Sell.do" / "Compare to Zoho" / "Talk to founder on WhatsApp"
- Footer links: /legal/terms · /legal/privacy · /legal/refund · /legal/cookies · /grievance

## 3. `marketing-and-sales/launch-implement/pre-launch/02-pricing/razorpay-products.md` (300-500 words)
- One Razorpay Product per tier (4 products): Solo, Team, Team+, AI Employee
- One Razorpay Plan per Product per billing cycle:
  - Solo monthly (₹999), Solo annual (₹999 × 12 × 0.8 = ₹9,590)
  - Team monthly (₹1,999), Team annual (₹19,190)
  - Team+ monthly (₹1,999) + add-on plan `add_seat` (₹500/seat/mo, prorated)
  - AI Employee monthly (₹7,999), no annual
- Razorpay Subscription webhook events to handle: `subscription.charged`, `subscription.completed`, `subscription.cancelled`, `subscription.paused`, `subscription.updated` (for seat increments), `payment.failed`
- Item HSN: 998314 on every product
- GST: enable Razorpay GST settings, set GSTIN, enable place-of-supply auto-resolve
- Test mode plan IDs to capture for `pricing.json.razorpayPlanIds`
- Live mode plan IDs to capture once KYC done

Stop here. Do not generate the LP HTML — that's P15.
```

## Inputs
- `pricing.json` (already created)
- Persona docs at `research/`
- Master plan v2 §0.3

## Outputs
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/tiers.md`
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/page-copy.md`
- `marketing-and-sales/launch-implement/pre-launch/02-pricing/razorpay-products.md`

## Success Criterion
3 markdown files exist, all numbers identical to `pricing.json`, founder reads page-copy.md once and signs off without correction.

## Fallback / Plan B
If page-copy reads weak, run `copywriting` skill again with persona-specific input from `research/icp-report-mumbai-launch.md` to add Mumbai-broker idiom.

## Risks
| Risk | Mitigation |
|---|---|
| Pricing copy contradicts `pricing.json` | All numbers via `{{tier.price}}` placeholders; page-copy MD references json |
| AI hallucinates competitor prices | Prompt cites exact rupee anchors; founder verifies before publish |
| Annual math wrong | Annual = monthly × 12 × 0.8; explicit formula in prompt |

## India / Mumbai-Specific Notes
- All prices in INR with ₹ symbol
- GST line shown above CTA on every tier card
- Mumbai-built trust badge in trust strip
- Razorpay GST settings must be enabled in P7

## Dependencies
- **Blocks:** P7 (Razorpay GST + plans), P14 (paywall references prices), P15 (LP rewrite)
- **Depends on:** `pricing.json` (✅ shipped), persona docs (✅ exist)

## Connected Skills
- `pricing-strategy` — tier rationale + competitor benchmark
- `copywriting` — page copy
- `revops` — Razorpay plan checklist
