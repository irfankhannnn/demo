# 17 — Cost & Billing Architecture

> **Scope:** how RealEstateFlow prices AI-heavy capabilities to customers, and how it meters usage internally. Core principle from the vision: **customers must NOT be billed per token.** Builds on the existing Razorpay billing (`01 §3.5`). Research verified June 2026 (`20`).

---

## 1. Principle: sell business outcomes, meter tech units internally
Per-token billing is terrible UX (unpredictable, scary, meaningless to an agency owner). We **meter granular tech units internally** (tokens, minutes, messages, runs) for **cost control and margin**, but **bill customers in business units** they understand: conversations, AI minutes, listings posted, creatives generated — bundled into **plans + included credits + overage packs**.

## 2. The Model: Subscription tiers + included AI credits + overage
This hybrid is the 2025–26 norm for AI SaaS (Cursor, Lovable, HeyGen all use credit pools on top of a subscription):

```
 Plan (seats + features + INCLUDED monthly credits)
   + Credits denominated in business actions (not tokens)
   + Overage credit packs (top-ups) when included credits run out
   + Premium add-ons (Voice minutes, Marketing reels, Portal automation)
```

### Credit unit design (a "RealEstateFlow Credit" = a business action)
| Action | Indicative credits | Underlying cost driver |
|---|---|---|
| AI conversation handled (chat) | 1 | LLM tokens (Haiku/Sonnet + caching) |
| AI voice minute | higher | telephony + voice platform + LLM |
| AI follow-up message sent | low | LLM + WhatsApp template cost |
| Lead qualified + scored | low | LLM |
| Marketing image | medium | image API |
| Marketing reel/video | **high** | generative video (most expensive unit) |
| Portal listing posted (automation) | medium | browser minutes + maintenance |

Credits **abstract away** the messy per-unit tech costs while keeping our margin intact, because we set credit→action ratios from real measured costs (next section). Include generous credits in plans so most agencies never hit overage (engagement > nickel-and-diming).

## 3. Internal Metering (the meter behind the credits)
A **usage meter** captures every billable tech event from the **audit log** (`15`): tokens (by model, cached vs not), voice minutes, messages by WhatsApp category, browser-run minutes, images/reels. This:
- converts tech units → credits per the configured ratios,
- decrements the tenant's credit balance,
- enforces **per-tenant budget caps & circuit breakers** (cost safety — `04 §7`),
- feeds margin/COGS analytics per tenant and per feature.

**Metering infra options:** **Stripe Billing + Meters** (~0.7% of volume; fast if/when we use Stripe globally) vs **Lago (open-source, self-host free)** vs **OpenMeter** (OSS metering feeding a billing engine). **Recommendation:** **Lago (self-hosted)** for the metering/credit ledger to avoid per-event fees and keep control, integrated with **Razorpay** for India collection. Revisit Stripe Meters if we expand billing outside India.

## 4. India Payment Reality (critical constraint)
- **Razorpay** for subscriptions (already integrated, webhook-idempotent). 
- **RBI e-mandate / UPI Autopay no-AFA cap is ₹15,000 per transaction** (the ₹1L limit is **only** for insurance/MF-SIP/CC bills — **not** SaaS). **Implication:** recurring auto-debit works **without** per-cycle 2FA **only if each charge ≤ ₹15,000.** Design plans + overage so a single auto-debit stays under ₹15k; for larger enterprise bills expect manual approval / invoicing. Honor the 24h pre-debit notification rule (effective ~Apr 2026 consolidated directions).
- **Overage handling:** pre-purchased credit packs (one-time payments) avoid surprise overage auto-debits that could exceed mandate caps.

## 5. Existing Plans → New Structure
Today: solo ₹999/1-seat, team ₹1,999/3, teamplus ₹4,999/5, + "AI Employee" ~₹5,000/mo (human). Evolve to:

| Tier | Seats | Included credits | AI scope |
|---|---|---|---|
| **Starter** | 1–2 | small | CRM + basic AI chat assistant |
| **Growth** | 3–5 | medium | + acquisition engine, qualification, scoring, follow-up |
| **Pro/Agency** | 5–15 | large | + voice, marketing, portal automation, analytics |
| **Add-ons** | — | packs | Voice-minute packs, Reel packs, Automation packs |

The "AI Employee" stops being a ₹5k human-with-SLA and becomes the **always-on agent included in Growth/Pro** — a far stronger product story and margin once agents replace the human provisioning.

## 6. Margin & Cost Control Levers (so credits stay profitable)
- **Haiku-first** for high-volume tasks ($1/$5 vs Sonnet $3/$15); Sonnet only for customer conversation.
- **Prompt caching** of stable catalog/system prompt (1-hr TTL → cached reads ~0.1× input) — biggest LLM lever.
- **WhatsApp:** keep conversations in the **free 24h window**; prefer free **service**/Utility over paid Marketing templates (`08 §4`).
- **Voice:** evaluate self-host (Nova Sonic/Pipecat) vs ElevenLabs per-minute at volume (`12`).
- **Generative video** priced to cover its high cost; favor **Remotion** templated video where it suffices (`13`).
- **Serverless scale-to-zero** + avoid OpenSearch/EKS floors (`16`).
- Per-tenant **budget guards** prevent a runaway tenant from destroying margin.

## 7. Billing System Architecture
```
 Audit/usage events → Meter (Lago) → credit ledger per tenant
        │                                   │
        │                          enforce caps / circuit breakers (04)
        ▼                                   ▼
 Razorpay (subscriptions + credit-pack purchases, ≤₹15k auto-debit)
        │
   webhooks (idempotent, existing pattern) → entitlement updates
        ▼
 Dashboard: plan, credit balance, usage breakdown, upgrade/top-up
```

## 8. KPIs
Gross margin per tenant/feature, credit utilization (engagement proxy), overage attach rate, COGS per AI action, % conversations in free WhatsApp window, voice cost/min, failed-mandate rate, ARPU, plan upgrade rate.

## 9. Phasing
- **P1:** internal meter (Lago) + audit-event capture; keep current Razorpay plans; budget caps.
- **P2:** credit model live (conversations/qualification) in plans; dashboard usage view.
- **P3:** voice/marketing/automation credit metering + add-on packs; margin analytics; "AI employee included" repackaging.
