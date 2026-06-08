# RealEstateFlow — Brand Kit (v2 — APPROVED & ACTIVE)

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

## Visual Identity

### Logo
- **Icon:** House outline with 4 wave lines inside (representing data flows/real estate)
- **Green accent:** Third wave line is green (`#22C55E`), others are white at varying opacity
- **Wordmark:** "RealEstateFlow" — Poppins ExtraBold, white on dark backgrounds
- **Dark-bg SVG (inline):** Use SVG with white strokes + green accent wave (see landing pages)
- **Light-bg use:** Use the `.png` logo from `/assets/logos/final/logo.png`

### Logo SVG (inline, for dark backgrounds)
```svg
<svg width="36" height="36" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M30 4L56 25V56H4V25L30 4Z" stroke="white" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
  <path d="M10 33Q18 30 26 33Q34 36 42 33Q46 31 50 33" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M10 39Q18 36 26 39Q34 42 42 39Q46 37 50 39" stroke="rgba(255,255,255,0.65)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M10 45Q18 42 26 45Q34 48 42 45Q46 43 50 45" stroke="#22C55E" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M10 51Q18 48 26 51Q34 54 42 51Q46 49 50 51" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>
```

---

### Colors (APPROVED — replace all old sky-blue/saffron references)

| Token | Hex | Usage |
|-------|-----|-------|
| Navy (Primary) | `#0F3A66` | CTAs, step circles, hero accents |
| Navy hover | `#0A2E54` | Button hover state |
| Green (Accent) | `#22C55E` | CTAs on dark, checkmarks, highlights, green wave |
| Green hover | `#16A34A` | Green button hover |
| Dark BG | `#07111E` | Page background |
| Card BG | `#0C1E3A` | Cards, containers |
| Alt Card | `#0F2745` | Testimonials, alternate cards |
| Emerald label | `#34D399` | Badge labels, trust signals |
| Error/Pain | `#EF4444` | Pain points, loss metrics |
| Amber/Warning | `#F59E0B` | "No free trial" warnings, enterprise badges |
| Text | `#F8FAFC` | Primary text on dark |
| Muted text | `#94A3B8` | Secondary text |
| Border | `#1E3A5F` | Card borders (or `border-slate-700` in Tailwind) |

### Gradient (hero headlines)
- **Dark-bg gradient text:** `linear-gradient(135deg, #ffffff, #22C55E)` — White to Green
- **CSS class (.gt):**
  ```css
  .gt {
    background: linear-gradient(135deg, #ffffff, #22C55E);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  ```
- **Hero radial (page bg):** `radial-gradient(ellipse at top, rgba(15,58,102,.25) 0%, rgba(34,197,94,.06) 50%, transparent 70%)`

### Page-level gradient context
| Page | Gradient |
|------|----------|
| Homepage | `rgba(15,58,102,.25)` navy tint + `rgba(34,197,94,.06)` green hint |
| Agency Owners | `rgba(15,58,102,.20)` + `rgba(34,197,94,.05)` |
| Agents | Same as Agency Owners |
| AI Employee | `rgba(34,197,94,.10)` green-first + `rgba(15,58,102,.08)` |
| Enterprise | `rgba(15,58,102,.20)` navy-dominant (premium) |
| Demo | `rgba(15,58,102,.15)` subtle navy |

---

### Typography
- **Headline font:** Poppins (Google Fonts) — Black (900) / ExtraBold (800) / Bold (700)
- **Body font:** Inter (Google Fonts) — Regular (400) / Medium (500) / SemiBold (600)
- **Import:** `Poppins:wght@400;500;600;700;800;900` + `Inter:wght@400;500;600;700;800;900`
- **CSS rule:**
  ```css
  * { font-family: 'Inter', sans-serif; }
  h1, h2, h3, .font-poppins { font-family: 'Poppins', sans-serif; }
  ```
- **Badge labels:** Inter SemiBold (600), uppercase, letter-spacing: wide

---

### Components (UI tokens)
- **Primary CTA:** `bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold rounded-lg`
- **Navy CTA (enterprise):** `bg-[#0F3A66] hover:bg-[#0A2E54] text-white font-bold rounded-lg`
- **Outline CTA:** `border border-[#22C55E] text-emerald-400 hover:bg-emerald-950/30`
- **Badge:** `bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full`
- **Card:** `bg-[#0C1E3A] border border-slate-700 rounded-xl`
- **Alt Card:** `bg-[#0F2745] border border-slate-700 rounded-xl`
- **Most Popular badge:** `bg-[#22C55E] text-white` (solid, no gradient)
- **Step circle (1–N):** `bg-[#0F3A66]` for standard, `bg-[#22C55E]` for final/highlight

---

## Iconography Style
- Use simple emoji icons for v1 (fast production)
- Replace with minimal line icons (stroke, not fill) in v2
- Consistent stroke weight: 1.5–2px
- Green (`#22C55E`) for success/positive icons
- Red (`#EF4444`) for pain/problem icons
- Amber (`#F59E0B`) for warnings/pricing disclosures

## Photography/Illustration Guidance
- Prefer: Clean product screenshots, WhatsApp UI mockups, simple flow diagrams
- Avoid: Generic stock photos of people unless real customer photos
- Lighting: Warm Indian city light (golden hour) for lifestyle shots
- Overlay: Navy/dark glass panels with green-accented UI cards

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
