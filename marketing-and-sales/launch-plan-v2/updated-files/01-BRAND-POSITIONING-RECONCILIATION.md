# 01 — Brand & Positioning Reconciliation

Maps to master-prompt **§1 (Company & Product Context)** and **§6 (Branding & Positioning Update)**.

The master prompt carried a brand system labelled **"Happy Properties"** and applied it as if that were the product. That is incorrect. **The product is RealEstateFlow.** "Happy Properties" is a **broker company — the first client / pilot user** of the CRM (it appears as the sample agency name in `real-estate-crm-app/src/pages/Profile.tsx` and `onboarding-page/web/index.html`). This file confirms the product brand, resolves the legacy-vs-canonical brand layers, and lists what to adopt from the master prompt.

---

## 1. Product brand layers in the repo

There are **two product-brand layers** (one superseded, one canonical). "Happy Properties" is **not** a brand layer — it is a customer.

| Layer | Source | Name | Market | Colours | Voice | Status |
|---|---|---|---|---|---|---|
| Legacy | `.brand/brand-kit.md`, `.brand/positioning.md`, `CLAUDE.md` | **RealtyFlow** | India multi-city + Dubai | Royal Blue `#2563EB` + Emerald | **Hinglish** | Superseded |
| **Canonical** | `launch-plan-v2/README.md`, `00-PLAN-OVERVIEW.md`, `pricing.json` | **RealEstateFlow** | **India / Mumbai-first** | Green `#22C55E` + Navy `#0F3A66` + Dark `#07111E` | **English** | **Locked (v2) — the product** |

| Not a brand | Source | What it actually is |
|---|---|---|
| "Happy Properties" | `HappyProperties-MasterPrompt.md`, `Profile.tsx`, `onboarding-page/` | **First/pilot broker client** + the in-product sample agency name. Use it as a pilot/testimonial reference, not as the product name. |

The v2 plan's `00-FINAL-REPORT.md` records the migration legacy RealtyFlow → canonical **RealEstateFlow** (English, new pricing, Mumbai-only, DPDP-first). That migration is the source of truth.

---

## 2. Brand name — RESOLVED

✅ **The product is `RealEstateFlow` / `realestateflow.in`.** No decision needed. The earlier "brand name" decision is closed.

The master prompt's UK constructs are still localised away (this is *not* a brand question, just market fit):

| Master-prompt item | Action |
|---|---|
| Name used as product = "Happy Properties" | Corrected → product is **RealEstateFlow**; Happy Properties = first broker client |
| GBP £ pricing | 🇮🇳 INR per `pricing.json` |
| GDPR framing | 🇮🇳 **DPDP** (already in `P1`/`P17`) |
| UK portals (Rightmove/Zoopla) | 🇮🇳 99acres / MagicBricks / Housing.com |
| Stripe | 🇮🇳 Razorpay (already the plan's choice) |
| IDX / MLS feed ingestion | Dropped (not the Indian broker workflow) |

---

## 3. Decisions required (2 remaining)

### ⚠️ D1 — Colour palette & typography

**Recommendation: keep the RealEstateFlow palette** (green `#22C55E`, navy `#0F3A66`, dark `#07111E`). Do **not** adopt the master prompt's amber `#F4A261` / navy `#0D1B2A`.

- The locked palette already flows through `P8` (logo/favicons/OG), `P15` (LPs), and the brand kit. Swapping introduces rework + inconsistency.
- Typography: `.brand` uses **Inter**. The master prompt suggests Sora / DM Sans / JetBrains Mono — an *optional* visual-polish upgrade, low priority. If adopted, it only touches the `P15` build pipeline's font import + the brand kit; defer to post-PMF.

> Action: log D1. Default = keep existing palette + Inter.

### ⚠️ D2 — Launch-scale targets

See `03-LAUNCH-PLAN-DELTA.md` §2. **Recommendation: keep existing M1 targets (3–5 paying, ₹0 ads, solo founder, PMF gate).** The master prompt's "50 paying in launch week / 200 by M6" assumes a funded team + paid media and is incompatible with the locked solo-founder constraint.

> Action: log D2.

---

## 4. What to ADOPT from the master prompt (no decision needed)

These do not conflict with RealEstateFlow and sharpen the plan.

### 4.1 Dual "AI Employee + CRM" framing (➕ from §1, §4.3)
The existing wedge front-runs the AI Employee. The master prompt's **equal-billing split** ("Not a chatbot. A genuine AI… + a purpose-built CRM") is a stronger homepage device. Adopt the two-column split (see `04` §4.3) while keeping the AI-Employee-on-WhatsApp wedge as the headline.

### 4.2 Brand-voice principles (🔁 reinforces v2 English direction)
Adopt verbatim into the brand kit + every copy task:
- **Confident but approachable** — "a brilliant colleague, not a pitch deck."
- **Outcome-first** — lead with deals closed / hours saved, not features.
- **Trustworthy & local** — trust language; India = WhatsApp-native, GST, data-in-India (AWS `ap-south-1`), DPDP.
- **Anti-jargon** — no "leverage synergies"; say "your AI handles the follow-up so you focus on closing."

> Note: this **supersedes** the legacy `.brand/brand-kit.md` Hinglish-website rule for the **website** (v2 locked English). Hinglish remains allowed for **ads** only (per `00-PLAN-OVERVIEW.md`: 60% English / 25% Hinglish / 15% Marathi).

### 4.3 Secondary umbrella tagline (🔁 from §6)
Keep the wedge as primary; add the master's positioning line as an **umbrella tagline** for decks/about page:

- **Primary wedge (unchanged):** "An AI Employee that runs your broking agency on WhatsApp + Telegram."
- **Umbrella tagline (new, optional):** "The AI-native operating system for real estate teams."
- **Mission (adopt):** "Eliminate the gap between a lead arriving and a deal closing."

### 4.4 Messaging hierarchy L1/L2/L3 (➕ from §6) — **adopt, India-localised**

Use this ladder as the canonical pitch for cold email (`day-09`, `day-17`), LP hero (`P15`), sales chat, and the about page. All naming is **RealEstateFlow**.

**Level 1 — Elevator (one sentence):**
> RealEstateFlow is the AI that qualifies your leads on WhatsApp, books your site visits, and updates your CRM and Khata book — automatically, around the clock.

**Level 2 — Short pitch (three sentences):**
> Most Mumbai broking teams lose deals not because of bad agents, but because leads go cold before anyone replies. RealEstateFlow gives you an AI Employee that answers every WhatsApp enquiry in under 60 seconds, qualifies the buyer, books the site visit, and follows up through your pipeline. Your agents focus on closing — the AI handles everything else.

**Level 3 — Full pitch (one paragraph):**
> RealEstateFlow is a real-estate-native AI platform that pairs an autonomous AI Employee with a purpose-built CRM for Indian brokers. The AI Employee handles every stage of lead engagement on WhatsApp and Telegram — instant response, qualification, site-visit booking, and follow-up — without manual input. The CRM centralises every lead (portals, WhatsApp, web, calls), scores prospects, routes them to the right agent, keeps the Khata book and settlements current, and gives owners full pipeline visibility. For broking teams tired of Excel, missed follow-ups, and patchwork tools, RealEstateFlow is the single system that works while you sleep — starting at ₹999/month, with an optional AI Employee add-on at ₹7,999/month.

### 4.5 Audience-segment mapping (🇮🇳 from §1)

| Master-prompt segment | RealEstateFlow equivalent | Tier | Persona |
|---|---|---|---|
| Solo agents | Solo brokers | Solo (₹999) | "Dev bhai" |
| Small teams (2–10) | Small broking teams (≤3, then Team+) | Team / Team+ | "Priya madam" |
| Brokerages (10–50) | Growing agencies | Team+ (₹500/seat) | "Rajesh bhai" |
| Property managers | Rental/tenant-heavy brokers | any + Rented Properties module | — |

> Pilot mapping: **Happy Properties** is the first agency to land in this funnel — treat it as the lead beta agency (E09-01) and the first case-study / testimonial source (`04` §4.4, `day-14`, `day-25`).

---

## 5. Logo, photography (already owned — no plan change)

| Master-prompt item | Action |
|---|---|
| Logo mark concept (house + neural node) | ✅ `P8-logo-and-favicons.md` already owns logo; master's concept can inform the P8 brief. RealEstateFlow logo only. |
| Photography style (real agents, real product, warm light) | ✅ Aligns with existing creative briefs; no change. |

---

## 6. Apply targets

| Change | Target existing file |
|---|---|
| Add brand-voice principles + dual framing note | `00-PLAN-OVERVIEW.md` (§1 wedge) and brand kit `creative/realestateflow-launch/brand-kit.md` |
| Add L1/L2/L3 messaging ladder | new section in `pre-launch-prep/P4-competitive-positioning.md` outputs (wedge.md) |
| Add umbrella tagline + mission | `00-PLAN-OVERVIEW.md`, `/about` page brief in `P15` |
| Note Happy Properties as pilot client | beta list `week-2/day-08`, case study `day-25`, testimonial in `P15` |
| Log D1 (palette/typography) + D2 (scale) | `00-DECISIONS-LOG.md` |
