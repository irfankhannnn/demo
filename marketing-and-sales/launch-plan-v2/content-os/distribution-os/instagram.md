# Distribution OS — Instagram (Primary Platform)

> **The #1 channel for RealEstateFlow.** Mumbai & Pune brokers consume ~60% of their content here (`02-market-research §9.1`), sound-off, one-handed, between site visits. Instagram is where reach, relatability, and warm-lead capture happen. This file is the **strategy layer**; the **deep execution system** (grid plan, Reels engine, Stories engine, highlight architecture, hashtag banks, DM-automation flows, growth playbook) lives in **`distribution-os/instagram/`** — cross-reference it for day-to-day production.
>
> **Handles:** IG `@realtyflow_india` · site `realtyflow.in` · demo `demo.realtyflow.in` · trial `app.realtyflow.in/signup`
> **Plugs into:** `production-sop/10-content-factory.md` (Step 10 publish) · Blotato MCP scheduling · `09-content-type-system.md` (CT-*) · `08-cta-library.md` (CTA-*).

---

## 1. Audience

| Segment | Who | Language posture | What stops their scroll |
|---|---|---|---|
| **Agency Owner / Boss** (the buyer, "Priya") | 35–45, 3–8+ agents, Android, control-anxious, ROI-driven | `hi-dominant` + `en-leaning` proof, **aap** | ₹-quantified pain, peer proof, "team accountability" |
| **Sales Manager / Team Lead** | 28–40, runs the floor | `hi-dominant`, **aap/tum** | lead-assignment fairness, visibility-without-micromanagement |
| **Young Broker / Consultant** ("Arjun") | 26–35, field hustler, FOMO | `mr-dominant` (Pune) / `mixed`, **tu/dada** | drama, humour, hustle, "AI handles admin" |
| **New Joiner** | new MEMBER | simple `hi/mr`, **tum** | "ghabrao mat", onboarding ease |

- **Geo split:** Mumbai (Bambaiyya Hinglish base) + Pune (Marathi handshake). Run geo-targeted variants; see `03-language-strategy §3`.
- **Behaviour:** passive scroll, shares to WhatsApp broker groups (the key viral signal), saves educational/templates. They rarely create — they forward.

## 2. Posting Frequency

| Format | Cadence | Peak windows (IST, from `02-market-research §12`) |
|---|---|---|
| **Reels** | 1/day (7/week) — the reach engine | 6–8 AM, 12–1 PM, 6–8 PM |
| **Carousels** | 3/week (saves + lead-magnet) | 12–1 PM, 7–9 PM |
| **Stories** | 2–3/day (banter, polls, BTS, link stickers) | morning + evening |
| **Single image / meme** | opportunistic, 2–3/week | lunch + late evening |

> Friday evenings over-index; Monday mornings under-index. Batch a week at a time (`10-content-factory` Batch Mode), group by character/Soul for Higgsfield efficiency.

## 3. Content Mix (by CT-*)

Weekly target ≈ 7 Reels + 3 Carousels + ~15 Stories. Map each slot to a content type:

| CT-* | Share of feed | Format | Why on IG |
|---|---|---|---|
| **CT-DRAMA** | ~30% (flagship reach) | Reel 20–45s | WhatsApp-loss skits get shared to broker groups — the viral lane |
| **CT-EDU** | ~25% (highest-volume saves) | Reel / Carousel | "3 mistakes in follow-up" → saves + authority |
| **CT-UGC** | ~12% | Reel handheld | authentic broker-to-camera trust; doubles as paid creative |
| **CT-DEMO** | ~10% | Reel 15–30s | feature spotlight, de-risks before trial |
| **CT-PROOF / CT-CASE** | ~10% | Reel / Carousel | peer testimonials = highest trust signal in this market |
| **CT-MEME** | ~7% | image / Reel | cheap reach, validation humour (Hindi/Marathi) |
| **CT-NEWS** | reactive | Reel 20–40s | Maharashtra RERA / ready-reckoner newsjacking |
| **CT-FOUNDER / CT-AUTHORITY** | ~6% | Reel + cross-post LinkedIn | brand trust; see `founder-brand.md` |

## 4. CTA Strategy (by CTA category)

One primary CTA per piece (`08-cta-library §How`), placed as last spoken line **and** caption-ender. Soft secondary (Save/Follow) rides in caption.

| Funnel | Format pairing | Categories | Example IDs |
|---|---|---|---|
| **TOFU** (reach/engagement) | Reels, memes, Stories | **FOLLOW · SAVE · SHARE · COMMENT** | CTA-SAVE-014, CTA-SHARE-007, CTA-COMMENT-006 |
| **MOFU** (capture/conversation) | Carousels, EDU Reels, Stories | **COMMENT (keyword) · DM · WHATSAPP · LEAD-MAGNET · DEMO** | CTA-DM-001, CTA-COMMENT-002 ("CRM"), CTA-LEAD-MAGNET-005 |
| **BOFU** (convert) | Stories (link sticker), DEMO/CASE Reels | **DEMO · TRIAL · WHATSAPP** | CTA-DEMO-007, CTA-TRIAL-001, CTA-WHATSAPP-016 |
| **Pune geo** | any | mr-dominant CTAs | CTA-COMMENT-026 ("PUNE"), CTA-WHATSAPP-023 |

Keyword-comment CTAs ("comment 'CRM'") are the workhorse — they trigger the DM auto-flow (see `distribution-os/instagram/` DM automation).

## 5. Lead Capture Strategy

1. **Comment-to-DM keyword** (primary): "comment 'DEMO'/'CRM'/'GUIDE'" → auto-DM with link → keyword captures into CRM as a lead source `ig-comment`.
2. **DM keyword triggers** (CTA-DM-*): "DM 'TRIAL'" → signup link → tag `ig-dm`.
3. **Story link sticker** → demo/trial/WhatsApp → tag `ig-story`.
4. **Lead magnets** (CTA-LEAD-MAGNET-*): free checklist / "30% leads kyun leak hote hain" PDF / Pune market PDF → trades value for DM.
5. **Bio link** → `realtyflow.in` landing (demo video pinned, WhatsApp button, signup).
6. **WhatsApp handoff:** warm IG leads pushed to WhatsApp for objection-handling + pricing (see `distribution-os/whatsapp.md`).

> Every captured lead is tagged by source so `lead-scraper`/pipeline can attribute which CT-*/CTA-* drove it (`10-content-factory` Recipe Log).

## 6. Repurposing Strategy

**Instagram is the content source-of-truth.** Most assets originate as 9:16 Reels and flow outward:

| From → To | What | How |
|---|---|---|
| **IG Reel → Facebook Reel** | same 9:16, same caption | Blotato cross-post (Reels→IG+FB, `10-content-factory` Step 10) |
| **IG Reel → YouTube Shorts** | same vertical cut, add SEO title/desc | see `youtube.md` (repurpose reels) |
| **IG Reel → WhatsApp Status / broadcast** | top-performing drama/proof clips | see `whatsapp.md` |
| **IG Carousel → LinkedIn document/carousel** | EDU/Authority slides, English-leaned | see `linkedin.md` |
| **IG Authority/Founder Reel → LinkedIn native video** | recut, English caption | see `founder-brand.md` |
| **FB group post → IG meme/Reel** | best-performing pain points harvested back | reverse flow |

**Inbound:** Pune Marathi drama variants and UGC originate per-geo, then a Hinglish master version is cut for pan-city reuse.

## 7. Publishing Workflow (Content Factory + Blotato)

```
Pick OPP/CT-* → FW-* → CH-* → HK-* → script (lang tag) → scene/VP-* →
Higgsfield (HF-*) gen → stitch + burned-in subtitles (sound-off!) → caption + hashtags →
assign CTA-* → SCHEDULE in Blotato (peak slot) → cross-post (IG+FB Reels) → Recipe Log
```

- **Step 8 caption:** hook restated → 2–4 value lines in the language tag → 1 CTA line → 5–10 hashtags (broad `#realestate #realtor` + niche `#mumbairealestate #punerealestate #realestatecrm` + Hinglish `#propertydealsindia`).
- **Blotato MCP:** schedule IG (Reels/posts/Stories) at peak windows; same job fans the Reel to FB. Pune `mr-dominant` variants scheduled to Pune-geo audiences.
- **Quality gate** (`10-content-factory`): claim ∈ business memory, hook visual ≤1s, subtitles present, language tag matches geo/persona, recurring CH-* consistency prompt used, brand color/9:16, single CTA, ₹/lakh/crore, RERA-safe, Recipe logged.
- **Deep system handoff:** grid/Reels/Stories/highlight architecture, hashtag rotation, DM-automation copy, and the IG-specific growth playbook all live in **`distribution-os/instagram/`** — this file governs *what & why*, that folder governs *how at scale*.
