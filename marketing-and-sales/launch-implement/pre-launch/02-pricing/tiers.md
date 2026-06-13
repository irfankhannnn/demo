# Pricing Tier Rationale — RealEstateFlow

**Canonical pricing:** `marketing-and-sales/launch-plan-v2/pricing.json`  
**Last updated:** 2026-06-11

---

## Executive Summary

RealEstateFlow prices for the **Mumbai broker segment**: solo agents and small teams (1–10 members) who live on WhatsApp, not enterprise sales floors. Our tier structure anchors below ₹1,000 for solo brokers, scales predictably for teams, and prices AI Employee as a junior-agent replacement at ₹7,999/month.

---

## Tier-by-Tier Rationale

### Solo — ₹999/month (+ 18% GST)

**Why ₹999?**

Indian small-business SaaS research shows a psychological ceiling at ₹1,000/month for solo professionals. ₹999 is:
- Below one missed brokerage commission per month
- Less than ₹35/day — cheaper than daily chai + auto fare in Mumbai
- A credible "starter" anchor that doesn't signal "cheap toy"

**What's included:** Full CRM for one broker — unlimited properties, Khata book, analytics, OTP auth. No feature-gating that forces upgrade for core workflow.

**Trial:** 14 days, no card. Reduces friction for brokers sceptical of "another CRM."

**Refund:** 30-day money-back with anti-abuse guardrails (>100 exports or >50 WhatsApp sends = denied).

---

### Team — ₹1,999/month (+ 18% GST)

**Why ₹1,999?**

- Covers up to **3 members** — the modal Mumbai agency size (owner + 1–2 agents)
- 2× Solo price feels fair for 3× capacity without per-seat anxiety
- Still **10× cheaper** than Sell.do for a 3-person team
- "Most Popular" positioning — matches ICP (Priya the agency owner, 2–3 agents)

**Differentiators over Solo:** Shared Khata book, member activity reports, multi-agent hierarchy view.

---

### Team+ — ₹1,999 base + ₹500/seat/month (+ 18% GST)

**Why ₹1,999 + ₹500/seat?**

- Keeps the **same entry price as Team** for the first 3 seats — no penalty for starting small
- ₹500/seat for member 4+ is transparent and predictable (vs opaque "contact sales")
- **Prorated billing** mid-cycle removes upgrade friction when a 4th agent joins
- Unlimited members with priority support — scales to 10+ agent shops without enterprise pricing

**Why not per-seat from Day 1?** Indian brokers resist per-seat pricing on tools they haven't validated. A flat Team price for 3 seats lets them test collaboration before seat math kicks in.

---

### AI Employee — ₹7,999/month (+ 18% GST)

**Why ₹7,999?**

- Priced as a **junior agent replacement**, not a chatbot add-on
- Mumbai junior broker salary + overhead ≈ ₹15,000–25,000/month; ₹7,999 is defensible ROI if AI handles even 20% of follow-ups
- Manual concierge setup (~₹2,000–3,000 sunk cost per agency) justifies **no trial, no refund**
- Capped at **3 new signups/week in Month 1** to protect support capacity

**Requires active base plan.** AI Employee is an add-on, not standalone — ensures CRM data exists for the AI to operate on.

---

## Annual Discount — 20% Off

**Formula:** `annual = monthly × 12 × 0.8`

| Plan | Monthly | Annual | Savings |
|------|---------|--------|---------|
| Solo | ₹999 | ₹9,590 | ₹2,398 |
| Team | ₹1,999 | ₹19,190 | ₹4,798 |
| Team+ (base) | ₹1,999 | ₹19,190 | ₹4,798 |

**Why 20%?**
- Standard Indian SaaS annual discount (Zoho, Freshworks use 15–20%)
- 20% upfront discount is cheaper than 30% churn at month 3 (retention math)
- AI Employee excluded — monthly only in M1

---

## Competitor Benchmark

| Competitor | Pricing (approx.) | Target | RealEstateFlow advantage |
|------------|-------------------|--------|--------------------------|
| **Sell.do** | ₹4,999–9,999/user/mo (annual) | Developers, 10–100+ users | 5–10× cheaper for brokers; WhatsApp-native |
| **Zoho CRM** | ₹720–1,500/user/mo | Generic sales teams | Purpose-built: Khata, RERA fields, RE modules |
| **LeadSquared** | ₹3,500+/user/mo | Enterprise sales | Built for solo/small teams, not call centres |
| **NoBroker Agent** | Commission-based | Lead marketplace | You own your CRM data; not a lead auction |
| **Excel + WhatsApp** | ₹0 tool cost | 70%+ of Mumbai brokers | ₹6,000+/mo opportunity cost in lost follow-ups |

*Competitor prices from public websites and G2; verify before outbound use.*

---

## Why This Structure Wins in Mumbai

1. **₹999 anchor** — breaks the "CRM is expensive" mental model
2. **WhatsApp-first** — competitors are desktop-first; we meet brokers where they work
3. **Khata book built-in** — no spreadsheet sidecar
4. **AI Employee upsell** — natural expansion revenue without forcing everyone to ₹7,999 on Day 1
5. **GST invoices (HSN 998314)** — CAs approve; ITC claimable for registered agencies
6. **Data in India** — AWS Mumbai; DPDP-compliant posture for security reviews

---

## Anti-Patterns We Avoided

| Anti-pattern | Our choice |
|--------------|------------|
| Per-seat from Day 1 | Flat Team price for 3 seats |
| Freemium forever | 14-day trial → paid (sustainable unit economics) |
| AI Employee free trial | No trial — concierge cost is sunk |
| Annual-only (Sell.do model) | Monthly default; annual optional |
| Hidden setup fees | ₹0 setup; free onboarding |

---

## Unit Economics Snapshot (M1 targets)

| Metric | Assumption |
|--------|------------|
| Solo ARPU (incl. GST) | ₹1,179/mo |
| Team ARPU (incl. GST) | ₹2,359/mo |
| AI Employee attach rate | 5–10% of paying customers by M3 |
| Trial → paid conversion | 15–25% (industry benchmark for B2B SMB India) |
| Refund rate | <5% with anti-abuse rules |

---

## Pricing Change Policy

- 30 days' written notice for price increases
- Grandfathering for annual subscribers until renewal
- All changes reflected in `pricing.json` first, then page copy
