# 01 — Brand & Positioning Reconciliation

Maps to master-prompt **§1 (Company & Product Context)** and **§6 (Branding & Positioning Update)**.

The master prompt carries a complete brand system for **"Happy Properties" (UK)**. The repo already has **three** brand layers. This file resolves them into one canonical decision set and lists what to adopt from the master prompt.

---

## 1. The three brand layers in the repo

| Layer | Source | Name | Market | Colours | Voice | Status |
|---|---|---|---|---|---|---|
| Legacy | `.brand/brand-kit.md`, `.brand/positioning.md`, `CLAUDE.md` | **RealtyFlow** | India multi-city + Dubai | Royal Blue `#2563EB` + Emerald | **Hinglish** | Superseded |
| **Canonical** | `launch-plan-v2/README.md`, `00-PLAN-OVERVIEW.md`, `pricing.json` | **RealEstateFlow** | **India / Mumbai-first** | Green `#22C55E` + Navy `#0F3A66` + Dark `#07111E` | **English** | **Locked (v2)** |
| Incoming | `HappyProperties-MasterPrompt.md` | **Happy Properties** | UK (£, Rightmove/Zoopla) | Navy `#0D1B2A` + Amber `#F4A261` | English | Template only |

The v2 plan's `00-FINAL-REPORT.md` explicitly records the migration from legacy RealtyFlow → RealEstateFlow (English, new pricing, Mumbai-only, DPDP-first). That migration is the source of truth.

---

## 2. Decisions required

### ⚠️ D1 — Brand name

**Recommendation: keep `RealEstateFlow` / `realestateflow.in`.**

Reasons:
- The entire v2 plan, domain, GST/legal entity (`P1`, `P7`), demo subdomain (`demo.realestateflow.in`), grievance email (`info@realestateflow.in`), OG assets (`P8`), and landing pages (`P15`) are RealEstateFlow.
- "Happy Properties" is a UK template artefact, not a deliberate rebrand request.
- Renaming now would invalidate ~70 plan files and live infra for zero market gain in India.

**If the founder *does* want "Happy Properties"** (e.g., for a UK expansion or a fresh identity): treat it as a separate program — it forces a domain, legal-entity, payments-KYC, and asset-regeneration cascade. Log the decision and a migration epic before any other delta in this pack is applied. **Do not apply this pack under a half-renamed brand.**

> Action: log D1 in `../00-DECISIONS-LOG.md`. The rest of this pack assumes **RealEstateFlow**.

### ⚠️ D2 — Colour palette & typography

**Recommendation: keep the RealEstateFlow palette** (green `#22C55E`, navy `#0F3A66`, dark `#07111E`). Do **not** adopt the master prompt's amber `#F4A261` / navy `#0D1B2A`.

- The locked palette already flows through `P8` (logo/favicons/OG), `P15` (LPs), and the brand kit. Swapping introduces rework + inconsistency.
- Typography: `.brand` uses **Inter**. The master prompt suggests Sora / DM Sans / JetBrains Mono. This is an *optional* visual-polish upgrade — low priority, founder's call. If adopted, it only touches the `P15` build pipeline's font import + the brand kit; defer to post-PMF.

> Action: log D2. Default = keep existing palette + Inter.

### ⚠️ D3 — Launch-scale targets

See `03-LAUNCH-PLAN-DELTA.md` §Scale. **Recommendation: keep existing M1 targets (3–5 paying, ₹0 ads, solo founder).** The master prompt's "50 paying in launch week / 200 by M6" assumes a funded team + paid media and is incompatible with the locked solo-founder constraint.

---

## 3. What to ADOPT from the master prompt (brand-safe, no decision needed)

These do not conflict with RealEstateFlow and sharpen the plan.

### 3.1 Dual "AI Employee + CRM" framing (➕ from §1, §4.3)
The existing wedge front-runs the AI Employee. The master prompt's **equal-billing split** ("Not a chatbot. A genuine AI… + a purpose-built CRM") is a stronger homepage device. Adopt the two-column split (see `04` §4.3) while keeping the AI-Employee-on-WhatsApp wedge as the headline.

### 3.2 Brand-voice principles (🔁 reinforces v2 English direction)
Adopt verbatim into the brand kit + every copy task:
- **Confident but approachable** — "a brilliant colleague, not a pitch deck."
- **Outcome-first** — lead with deals closed / hours saved, not features.
- **Trustworthy & local** — trust language; India = WhatsApp-native, GST, data-in-India, DPDP.
- **Anti-jargon** — no "leverage synergies"; say "your AI handles the follow-up so you focus on closing."

> Note: this **supersedes** the legacy `.brand/brand-kit.md` Hinglish-website rule for the **website** (v2 locked English). Hinglish remains allowed for **ads** only (per `00-PLAN-OVERVIEW.md`: 60% English / 25% Hinglish / 15% Marathi).

### 3.3 Secondary umbrella tagline (🔁 from §6)
Keep the wedge as primary; add the master's positioning line as an **umbrella tagline** for decks/about page:

- **Primary wedge (unchanged):** "An AI Employee that runs your broking agency on WhatsApp + Telegram."
- **Umbrella tagline (new, optional):** "The AI-native operating system for real estate teams."
- **Mission (adopt):** "Eliminate the gap between a lead arriving and a deal closing."

### 3.4 Messaging hierarchy L1/L2/L3 (➕ from §6) — **adopt, India-localised**

Use this ladder as the canonical pitch for cold email (`day-09`, `day-17`), LP hero (`P15`), sales chat, and the about page.

**Level 1 — Elevator (one sentence):**
> RealEstateFlow is the AI that qualifies your leads on WhatsApp, books your site visits, and updates your CRM and Khata book — automatically, around the clock.

**Level 2 — Short pitch (three sentences):**
> Most Mumbai broking teams lose deals not because of bad agents, but because leads go cold before anyone replies. RealEstateFlow gives you an AI Employee that answers every WhatsApp enquiry in under 60 seconds, qualifies the buyer, books the site visit, and follows up through your pipeline. Your agents focus on closing — the AI handles everything else.

**Level 3 — Full pitch (one paragraph):**
> RealEstateFlow is a real-estate-native AI platform that pairs an autonomous AI Employee with a purpose-built CRM for Indian brokers. The AI Employee handles every stage of lead engagement on WhatsApp and Telegram — instant response, qualification, site-visit booking, and follow-up — without manual input. The CRM centralises every lead (portals, WhatsApp, web, calls), scores prospects, routes them to the right agent, keeps the Khata book and settlements current, and gives owners full pipeline visibility. For broking teams tired of Excel, missed follow-ups, and patchwork tools, RealEstateFlow is the single system that works while you sleep — starting at ₹999/month, with an optional AI Employee add-on at ₹7,999/month.

### 3.5 Audience-segment mapping (🇮🇳 from §1)

| Master-prompt segment | RealEstateFlow equivalent | Tier | Persona |
|---|---|---|---|
| Solo agents | Solo brokers | Solo (₹999) | "Dev bhai" |
| Small teams (2–10) | Small broking teams (≤3, then Team+) | Team / Team+ | "Priya madam" |
| Brokerages (10–50) | Growing agencies | Team+ (₹500/seat) | "Rajesh bhai" |
| Property managers | Rental/tenant-heavy brokers | any + Rented Properties module | — |

---

## 4. What to REJECT / localise from the master prompt's brand layer

| Master-prompt item | Action |
|---|---|
| Name "Happy Properties" | ⚠️ Reject (D1) unless founder chooses rebrand |
| Amber `#F4A261` / navy `#0D1B2A` | ⚠️ Reject (D2) — keep RealEstateFlow palette |
| GBP £ pricing | 🇮🇳 Reject — INR per `pricing.json` |
| GDPR framing | 🇮🇳 Replace with **DPDP** (already in `P1`/`P17`) |
| UK portals (Rightmove/Zoopla) in brand copy | 🇮🇳 Replace with 99acres / MagicBricks / Housing.com |

---

## 5. Apply targets

| Change | Target existing file |
|---|---|
| Add brand-voice principles + dual framing note | `00-PLAN-OVERVIEW.md` (§1 wedge) and brand kit `creative/realestateflow-launch/brand-kit.md` |
| Add L1/L2/L3 messaging ladder | new section in `pre-launch-prep/P4-competitive-positioning.md` outputs (wedge.md) |
| Add umbrella tagline + mission | `00-PLAN-OVERVIEW.md`, `/about` page brief in `P15` |
| Log D1/D2/D3 | `00-DECISIONS-LOG.md` |
