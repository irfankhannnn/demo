# RealEstateFlow — Brand Kit (v3 — Visual System ACTIVE)

> **v3 changelog:** Replaces the v2 navy/`#22C55E`-green enterprise-SaaS look with **"Bazaar Signal"** —
> a bolder, chat-marketing-inspired system (researched from Manychat's 2022 COLLINS rebrand) rebuilt on
> Indian bazaar/festival color instead of corporate navy. Positioning, offer terms, and messaging below
> are **unchanged from v2** — only the Visual Identity section (colors, type, components, photography,
> plus a new Instagram Content System) has been revised. A full positioning pass is scheduled separately.
> See [`brand-lookbook-v3-bazaar-signal.html`](brand-lookbook-v3-bazaar-signal.html) for the palette,
> type specimen, and Instagram post/carousel mockups in visual form.

## Positioning
- **Product category:** Real Estate OS (not "just a CRM")
- **Primary buyer:** Real Estate Agency Owner (India)
- **Core enemy:** WhatsApp — "Your business is bigger than WhatsApp"
- **Core promise:** Track leads, monitor agents, close deals, settle commissions — in one OS.
- **Differentiator:** Optional **24×7 WhatsApp AI Employee** add-on.

## Key Offer (must be consistent everywhere)
- **CRM Trial:** 2 months free (no credit card)
- **CRM Guarantee:** 6-month money-back (no questions)
- **WhatsApp AI Employee add-on:** +₹5,000/month, **NO free trial** (paid from day 1)

## Messaging Framework (PAS — Problem → Agitation → Solution → Outcome)
1. **Problem:** "WhatsApp mein leads kho jaati hain"
2. **Agitation:** "₹20 lakh har saal waste — sirf lead leakage se"
3. **Solution:** "RealEstateFlow — ek system mein sab kuch"
4. **Outcome:** "More deals. More control. Less chaos."

## Primary Hook (lead with this everywhere)
> "Apna business WhatsApp se baahar nikalo."

## Taglines (approved)
- **Primary:** "Your business is bigger than WhatsApp."
- **Hindi:** "Apna business WhatsApp se baahar nikalo."
- **OS angle:** "Apni Agency ka Real Estate OS."
- **AI angle:** "Optional 24/7 WhatsApp AI Employee."

## Messaging Rules
- **Tone:** Street-smart + confident + honest
- **Language mix:** 70% English + 30% Hinglish (romanized)
- **Writing style:** Short sentences. Strong verbs. No jargon. WhatsApp is the villain.
- **Never say:** "AI-powered" without explaining what it does

---

## Visual Identity — "Bazaar Signal" (v3)

**Direction rationale:** The v2 navy/green look reads as generic enterprise SaaS. Chat-marketing
platforms that actually win attention in this space (Manychat's 2022 COLLINS rebrand and its live
site/Instagram) use one loud accent, spoken-language headlines, and real-not-stock photography —
a creator's-tool feel, not a corporate one. Bazaar Signal borrows those moves but grounds the color
in Indian bazaar/festival signal — marigold and gulal — instead of borrowing a creator-app palette
outright.

### Logo
- **Icon:** House outline with 4 wave lines inside (unchanged shape — representing data flows/real estate)
- **Accent wave:** Third wave line is now **marigold** (`#FF7A1A`), others are paper-cream at varying opacity
- **Wordmark:** "RealEstateFlow" — **Unbounded** ExtraBold/Black, on ink or paper backgrounds
- **Dark-bg SVG (inline):** Use SVG with paper-cream strokes + marigold accent wave (see below)
- **Light-bg use:** Use the `.png` logo from `/assets/logos/final/logo.png` (recolor accent wave to marigold)

### Logo SVG (inline, for dark backgrounds)
```svg
<svg width="36" height="36" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M30 4L56 25V56H4V25L30 4Z" stroke="#FBF2E4" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
  <path d="M10 33Q18 30 26 33Q34 36 42 33Q46 31 50 33" stroke="rgba(251,242,228,0.35)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M10 39Q18 36 26 39Q34 42 42 39Q46 37 50 39" stroke="rgba(251,242,228,0.65)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M10 45Q18 42 26 45Q34 48 42 45Q46 43 50 45" stroke="#FF7A1A" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M10 51Q18 48 26 51Q34 54 42 51Q46 49 50 51" stroke="rgba(251,242,228,0.35)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>
```

---

### Colors (v3 — supersedes all v2 navy/`#22C55E` references)

| Token | Hex | Usage |
|-------|-----|-------|
| Ink (Primary ground) | `#1C1512` | Page background — warm near-black, not cold navy |
| Ink 2 (Card ground) | `#251C16` | Cards, containers |
| Ink 3 (Alt card) | `#2E241D` | Testimonials, alternate cards |
| Paper (Light ground) | `#FBF2E4` | Light-mode background — khata-ledger cream, not stark white |
| Paper 2 | `#F3E6D2` | Light-mode alt surface |
| Marigold (Primary accent) | `#FF7A1A` | CTAs, prices, headline highlights, logo accent wave |
| Marigold hover | `#E8620A` | Button hover state |
| Gulal (Secondary pop) | `#FF3D7F` | Quote marks, alerts — **once per screen**, never paired with marigold on the same card |
| Gulal hover | `#E01F63` | Hover/pressed state |
| Tulsi (Tertiary — sparing) | `#1FAA59` | Checkmarks, "verified" only — a deliberate wink at WhatsApp; never used as a primary accent |
| Dust (Muted, on dark) | `#C9BBA8` | Secondary text, borders on ink |
| Dust dim (Muted, on light) | `#948575` | Secondary text on paper |
| Error/Pain | `#EF4444` | Pain points, loss metrics (unchanged from v2) |

**Usage ratio per screen:** ~42% ink, ~18% paper, ~22% marigold, ~14% gulal, ~4% tulsi. Gulal and
marigold should not both anchor the same card — pick one per component so the accent reads as
confident, not chaotic.

### Gradient (hero headlines)
- **Dark-bg gradient text:** `linear-gradient(100deg, #FF7A1A 15%, #FF3D7F 85%)` — Marigold to Gulal
- **CSS class (.gt):**
  ```css
  .gt {
    background: linear-gradient(100deg, #FF7A1A 15%, #FF3D7F 85%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  ```

---

### Typography
- **Display font:** Unbounded (Google Fonts) — Weight 800/900 **only**. Headlines, hooks, big
  numbers/prices. Never set body copy or a full paragraph in it — one line, maybe two.
- **Body/UI font:** Manrope (Google Fonts) — Regular (400) through ExtraBold (800). Everything
  Unbounded doesn't shout: captions, paragraphs, button labels, stat callouts.
- **Import:** `Unbounded:wght@700;800;900` + `Manrope:wght@400;500;600;700;800`
- **CSS rule:**
  ```css
  * { font-family: 'Manrope', sans-serif; }
  h1, h2, h3, .font-display { font-family: 'Unbounded', sans-serif; font-weight: 800; }
  ```
- **CTA button labels:** Manrope 800 (not Unbounded) — punch without shouting
- **Numerals/stats:** Manrope with `font-variant-numeric: tabular-nums`

---

### Components (UI tokens)
- **Primary CTA:** `bg-[#FF7A1A] hover:bg-[#E8620A] text-[#1C1512] font-extrabold rounded-lg`
- **Secondary/alert CTA:** `bg-[#FF3D7F] hover:bg-[#E01F63] text-[#FBF2E4] font-extrabold rounded-lg`
- **Outline CTA:** `border border-[#FF7A1A] text-[#FF7A1A] hover:bg-orange-950/20`
- **Badge:** `bg-black/30 border border-[#3A2E25] text-[#FF7A1A] text-xs font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-full`
- **Card:** `bg-[#251C16] border border-[#3A2E25] rounded-xl`
- **Alt Card:** `bg-[#2E241D] border border-[#3A2E25] rounded-xl`
- **Verified/checkmark:** `text-[#1FAA59]` — the only routine use of tulsi green

---

## Iconography Style
- Minimal line icons (stroke, not fill), 1.5–2px stroke weight
- Marigold (`#FF7A1A`) for primary highlights/CTAs
- Tulsi (`#1FAA59`) reserved for success/verified only — do not use as a general accent
- Red (`#EF4444`) for pain/problem icons

## Photography/Illustration Guidance
**Shoot or generate:**
- Real agents in real under-construction flats — dust, exposed wiring, genuine site-visit energy
- Phone screens showing actual WhatsApp/CRM UI, held naturally mid-conversation
- Golden-hour light, handheld candid framing, slight grain — not a studio setup
- Marigold garlands, chai tumblers, khata ledgers as incidental props
- Agents aged 20s–40s, Mumbai/Pune/Thane settings, ordinary office chaos

**Never:**
- Generic handshake-over-a-table stock photography
- Glass-tower corporate offices with no Indian specificity
- Posed, symmetrical "everyone smiling at camera" group shots
- Perfectly staged property interiors with no signs of life
- Stock chat-bubble UI screenshots that don't match the real product

*(No reference photography has been generated yet for v3 — this section is written direction for
the next shoot or AI-generation pass.)*

---

## Instagram Content System (new in v3)

### Post types (pick one ground + one accent per post — never mix marigold and gulal in one card)
| Type | Ground | Use for |
|------|--------|---------|
| Hook / quote | Ink | Scroll-stopping one-liners, WhatsApp-pain hooks, gulal quote mark |
| Stat / proof | Marigold | Big number + one-line proof point |
| Product / chat | Gulal | AI Employee screenshots, chat-bubble mockups |
| Testimonial | Paper | Customer quotes, star rating in marigold-deep |

### Carousel rhythm (fixed 5-slide structure)
1. **Hook slide** — gulal ground, the scroll-stopping question/claim
2. **Slides 2–4** — quiet ink ground, one point per slide, marigold bullet dot
3. **Final slide** — marigold ground, the CTA

### Feed consistency rule
When laying out 9 grid tiles, no more than 3 of 9 should share a ground color at once — alternate
ink/marigold/paper/gulal in a loose checkerboard so the feed reads as a set even at arm's length.

## Copy Blocks (reusable)
### Trust bar
- "200+ Agencies · Mumbai · Delhi · Pune · Dubai"

### Trial line
- "2-month free CRM trial · no credit card"

### Bot pricing disclosure (must be explicit — amber text)
- "WhatsApp AI Employee is optional: +₹5,000/month (no free trial)"

### WhatsApp enemy hook variants
- "32% of your leads get lost in WhatsApp every month."
- "Aapki agency ₹20 lakh khoti hai har saal. WhatsApp ki wajah se."
- "WhatsApp is not a CRM. Your business deserves better."
- "Jo system aapki agency chala raha hai woh sirf 5 logon ke liye bana tha — WhatsApp."
