# Brand constants

> **Status (17 Sep 2026):** The single constants table for the launch playbook. Checked against the code and the brand kit on `main`. Replaces the stale table that used to sit in `README.md` and every hardcoded hex in the old Content OS files.

Nothing in `20-content-engine/`, `30-channels/`, `40-sales-and-conversion/`, `50-measurement/` or `60-automation/` should restate a colour, a font, a price or a handle. Link here instead. If a value below is wrong, fix it here once.

---

## 1. Identity

| Field | Value | Source |
|---|---|---|
| Brand name | **RealEstateFlow** | `marketing-and-sales/creative/realestateflow-launch/brand-kit.md` |
| Old name (never use) | "RealtyFlow" — retired. Also `realtyflow.in`, `demo.realtyflow.in`, `app.realtyflow.in`, `@realtyflow_india`, `#RealtyFlow` | — |
| Domain | `realestateflow.in` | `marketing-and-sales/launch-plan-v2/README.md` |
| Demo page | `realestateflow.in/demo/` | `apps/landing-pages/demo/index.html` |
| Signup | `app.realestateflow.in/signup` | `apps/landing-pages/` nav on every page |
| Instagram handle | `@realestateflow` | `marketing-and-sales/realestateflow/content-strategy-first-month/08-CAROUSELS-AND-STATICS.md` |
| Not the brand account | `@happyproperties99` is the founder's own agency account, connected as the Meta tester for the hosted Instagram service | `docs/pending-items/instagram-service-status.md` |
| Logo PNG (source) | `marketing-and-sales/realestateflow/assets/logos/final/logo.png` — verified present after the 2026-09-17 reorg | filesystem |
| Grievance Officer mailbox | `info@realestateflow.in` | `00-DECISIONS-LOG.md` |
| Founder mailbox | `founder@realestateflow.in` | `00-DECISIONS-LOG.md` |
| Internal name "OpenClaw" | tech-forum / LinkedIn devrel only — never public marketing | `00-DECISIONS-LOG.md` |

> Publication caveat: `realestateflow.in` HTTPS was still down at the last check (`docs/pending-items/instagram-app-review-actions.md`). Do not publish a link to it until that is fixed.

> Open decision D23 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md
> (channel scope and the handle confirmation sit there.)

---

## 2. Visual system — v3 "Bazaar Signal"

Canonical file: `marketing-and-sales/creative/realestateflow-launch/brand-kit.md`. The v1 blue (`#2563EB`, Inter) and v2 green/navy (`#22C55E`, `#0F3A66`, `#07111E`) systems are **both superseded**. Any doc still showing them is stale.

| Token | Hex | Usage |
|---|---|---|
| Ink (primary ground) | `#1C1512` | Page background — warm near-black |
| Ink 2 / Ink 3 | `#251C16` / `#2E241D` | Cards, alternate cards |
| Paper (light ground) | `#FBF2E4` | Khata-ledger cream, not stark white |
| Paper 2 | `#F3E6D2` | Light alt surface |
| Marigold (primary accent) | `#FF7A1A` | CTAs, prices, headline highlights |
| Gulal (secondary pop) | `#FF3D7F` | Quote marks, alerts — once per screen, never on the same card as marigold |
| Tulsi (tertiary, sparing) | `#1FAA59` | Checkmarks and "verified" only |
| Dust / Dust dim | `#C9BBA8` / `#948575` | Secondary text on ink / on paper |
| Error / pain | `#EF4444` | Pain points, loss framing |

- **Display type:** Unbounded, weights 800/900 only, headlines and big numbers. Never a paragraph.
- **Body/UI type:** Manrope 400–800. CTA labels are Manrope 800.
- **Gradient (hero headlines only):** `linear-gradient(100deg, #FF7A1A 15%, #FF3D7F 85%)`.
- **Instagram grounds:** four post grounds — ink hook, marigold stat, gulal product/chat, paper testimonial. No more than 3 of 9 grid tiles on one ground.
- **Carousel:** fixed 5 slides — gulal hook, 3 ink slides, marigold CTA.

### The product-UI exception (do not "fix" this)

The CRM app uses blue `#2563EB` and Inter (`apps/crm/real-estate-crm-app/tailwind.config.js`). That is the **product UI**, and it legitimately differs from the marketing brand. A screen recording of the real CRM will therefore not match the marketing palette, and that is correct. Never edit product-UI colour references to the brand-kit values.

---

## 3. Language

Three splits are written down, at three different scopes. They are not interchangeable and they are not yet reconciled.

| Scope | Split | Source |
|---|---|---|
| Brand copy (captions, hooks, scripts) | 70% English / 30% romanized Hindi | `CLAUDE.md`; brand kit v3 |
| Ads and social | 60% English / 25% Hinglish / 15% Marathi | `00-DECISIONS-LOG.md` |
| Instagram portfolio (June draft) | 55% Hinglish / 30% Marathi / 15% English | `10-audience-and-voice/language-and-tone.md` |
| Website | English | `00-DECISIONS-LOG.md` |
| CRM product UI | English, no i18n. The AI agent speaks Hinglish on calls | `apps/crm/real-estate-crm-app/src/pages/crm/AICalling.tsx` |

> Open decision D24 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

Fixed regardless of D24: money in ₹, lakh, crore — never `$` or "million". Romanized Hindi, not Devanagari, inside Hinglish lines.

---

## 4. Market and operations

| Field | Value | Source |
|---|---|---|
| City scope M1 | **Mumbai only.** Pune deferred until the PMF gate | `00-DECISIONS-LOG.md`; `00-PLAN-OVERVIEW.md` |
| Later cities | Pune → Bangalore → Delhi → Hyderabad | `00-PLAN-OVERVIEW.md` §3 |
| Paid ads in M1 | None. M2+ only, and only if the PMF gate is met | `00-DECISIONS-LOG.md` |
| Voice-overs | ElevenLabs only | `00-DECISIONS-LOG.md` |
| AWS region | `ap-south-1` (Mumbai) | `00-DECISIONS-LOG.md` |
| S3 bucket for launch artefacts | `cloudberry-real-estate-launch` | `00-DECISIONS-LOG.md` |
| Founder on camera | **Never.** Video uses the AI presenter; the founder may appear in text and voice-over | `marketing-and-sales/realestateflow/content-strategy-first-month/04-AI-PRESENTER-BIBLE.md` |
| Editor capacity | About 3 videos a week, working only from `EDITOR-JOBCARDS/` | `.../content-strategy-first-month/00-START-HERE.md` |
| Asset naming | `REF-<TYPE><NN>-<slug>-v<N>` | `.../content-strategy-first-month/00-START-HERE.md` |
| Creative output path | `marketing-and-sales/creative/` (there is no `marketing-and-sales/assets/`) | filesystem |
| Video project | `marketing-and-sales/video-projects/my-video/` | `CLAUDE.md` |
| Render / TTS scripts | `tools/claude-skills/scripts/render-remotion.ps1`, `tools/claude-skills/scripts/elevenlabs-tts.ps1` | filesystem |
| Positioning doc | `marketing-and-sales/realestateflow/BRAND-POSITIONING.md` (there is no `/.brand/` folder) | filesystem |

---

## 5. Prices — pointer only

**`marketing-and-sales/launch-plan-v2/pricing.json` is the only live source of prices, trial length and refund terms.** Do not copy a number out of it into any other file; link to it, or use a `{{price_line}}` / `{{trial_line}}` / `{{ai_employee_disclosure}}` token that is resolved from it at publish time.

Two things a writer must know:

1. **The live values are pre-launch and provisional.** `pricing.json` and the CRM's own `apps/crm/real-estate-crm-app/src/lib/plans.ts` disagree on Team+. Both are being replaced by the proposal at `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` (status: proposed, awaiting founder approval — plans limited by number of properties plus AI credits, with a new "Contacts" billable unit). Describe today's numbers as "current pre-launch pricing, under review", never as final.
2. **The brand kit states a different offer** — 2 months free, 6-month money-back, AI Employee +₹5,000/month (`brand-kit.md`) — and the month-1 pack repeats it. `pricing.json` says 14-day trial, 30-day money-back, AI Employee ₹7,999. **This conflict is unresolved.** Do not pick a side in a marketing doc; if a creative needs an offer line, take it from `pricing.json` and flag the mismatch. The proposal that resolves it — a "Founding 50" offer (2 months free, 6-month money-back, AI Employee at ₹5,000 locked for 12 months) until public launch, then the `pricing.json` terms — is at `docs/realestateflow-vision/38-pricing-plan-contacts-and-credits.md` §3.3, awaiting the founder's approval.

Tier names that exist in **neither** source and must never appear: Free, Starter, Growth, Pro, Enterprise, "free plan", "50 leads free", "lifetime", "no expiry".

---

## 6. What this file is not

- Not the positioning. That is `marketing-and-sales/realestateflow/BRAND-POSITIONING.md`.
- Not the product feature list. That is `10-audience-and-voice/product-truth.md`.
- Not the claims rulebook. That is `10-audience-and-voice/claims-and-proof-policy.md`.
- Not prices. That is `pricing.json`.
