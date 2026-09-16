# P8 — Logo SVG + Dark Mode + Favicons + OG Template

> **Type:** 🤖 AUTO
> **Phase:** Pre-launch
> **Day / Block:** T-13
> **Skill(s):** `nano-banana-pro` + `huashu-design`
> **Estimated time:** 0.25h founder · 3h AI

## Objective
Re-trace the existing PNG logo at `marketing-and-sales/realestateflow/assets/logos/final/logo.png` to crisp SVG (light + dark variants), generate complete favicon set + Apple touch icon + Open Graph 1200×630 templates per page, and replace the ad-hoc inline SVG in all 5 landing pages with a single canonical asset.

## Why This Matters for RealEstateFlow
Brand renders on retina, OG previews (LinkedIn / Twitter / WhatsApp share cards), Google AI Overview citations, and dark dashboards. A pixelated PNG logo on the OG card kills CTR on social shares; favicon set affects bookmark recognition; Apple touch icon affects Add-to-Home-Screen UX on iOS.

## User Story
As a founder sharing `realestateflow.in/pricing` on LinkedIn, I want a sharp 1200×630 OG card with logo + tagline to render perfectly, so the click-through rate on the share approaches 5-8% (vs <1% on a generic preview).

## Acceptance Criteria
- [ ] `marketing-and-sales/realestateflow/assets/logos/final/logo.svg` exists, traced from PNG, preserves house+wave glyph, palette `#22C55E #0F3A66 #07111E`
- [ ] `marketing-and-sales/realestateflow/assets/logos/final/logo-dark.svg` (inverted strokes for dark backgrounds)
- [ ] Favicon set at `marketing-and-sales/realestateflow/assets/favicons/`:
  - `favicon-16x16.png`, `32x32.png`, `48x48.png`, `64x64.png`, `180x180.png` (Apple touch), `192x192.png`, `256x256.png`, `512x512.png`
  - `favicon.ico` (multi-resolution: 16+32+48)
  - `safari-pinned-tab.svg` (monochrome)
  - `manifest.json` (PWA manifest stub)
- [ ] Open Graph templates 1200×630 px PNG at `marketing-and-sales/realestateflow/assets/og/`:
  - `og-default.png` (homepage) — logo left, tagline "Hire an AI Employee for Your Real Estate Agency."
  - `og-pricing.png` — "₹999 to start. ₹7,999 to hire an AI."
  - `og-agency-owners.png` — "Your AI Employee. Their workload."
  - `og-agents.png` — "An AI teammate that never sleeps. ₹999/month."
  - `og-ai-employee.png` — "₹7,999/month. Cheaper than a junior agent."
  - `og-demo.png` — "See it qualify a buyer in 90 seconds."
- [ ] All assets committed under `marketing-and-sales/realestateflow/assets/`
- [ ] All 5 LP HTMLs reference the SVG logo (replaces inline ad-hoc SVG) — actually executed in P15
- [ ] CRM SPA header (`apps/crm/real-estate-crm-app/src/components/Header.tsx` or equivalent) imports the SVG
- [ ] OG template card preview tested at https://www.opengraph.xyz/url/realestateflow.in for each page after deploy

## AI Prompt (🤖)

```
You are a brand designer using `nano-banana-pro` (Higgsfield) for image generation and a vector tracer for SVG conversion. Inputs:
- Source PNG: `marketing-and-sales/realestateflow/assets/logos/final/logo.png`
- Brand kit: `marketing-and-sales/creative/realestateflow-launch/brand-kit.md`
- Brand colors: primary green `#22C55E`, navy `#0F3A66`, dark `#07111E`
- Tagline: "Hire an AI Employee for Your Real Estate Agency."

Produce these assets:

## 1. SVG re-trace
- Open the PNG; identify the glyph (a stylized house with a wave underneath — this is RealEstateFlow's logo per the existing landing pages)
- Re-trace as SVG preserving exact proportions
- Output `marketing-and-sales/realestateflow/assets/logos/final/logo.svg`
  - viewBox: `0 0 256 256`
  - Two variants in single SVG via `<symbol>` or two files: light (default — for white/light backgrounds, navy + green strokes) and dark (`logo-dark.svg`, light strokes for dark bg)
- Validate via https://validator.w3.org/ — no errors

## 2. Favicon set
Generate from the SVG (use Real Favicon Generator's logic or equivalent):
- 16x16, 32x32, 48x48, 64x64, 180x180 (Apple touch), 192x192, 256x256, 512x512 PNG
- favicon.ico (multi-res)
- safari-pinned-tab.svg (monochrome black version of glyph)
- Output: `marketing-and-sales/realestateflow/assets/favicons/`
- Add `manifest.json` at the same path for PWA icon registration

## 3. Open Graph templates (1200x630 PNG)
For each of the 6 OG cards listed in the AC list, use `nano-banana-pro` with this prompt template:

> "1200×630 banner. Background: linear gradient from navy (#0F3A66) at top-left to dark (#07111E) at bottom-right. Logo (the house+wave glyph in green #22C55E + light cream #F5F1E8) anchored top-left at 80px margin, 96×96 size. Tagline below logo in 56px Satoshi or Inter font, weight 700, white text, letter-spacing -1%. Sub-tagline in 24px regular below in #C8D4DF (cool gray). Right side: subtle accent — a faint Mumbai skyline silhouette in #1A2A3D (barely visible darker tone) — Marine Drive curve + 2-3 high-rise outlines. Bottom-left footer: 'realestateflow.in' in 18px regular #79899A. No other text or icons. Crisp, premium B2B SaaS feel — think Linear, Stripe."

Per-card override the tagline + sub-tagline:
- `og-default.png`: "Hire an AI Employee" / "for Your Real Estate Agency."
- `og-pricing.png`: "₹999 to start" / "₹7,999 to hire an AI."
- `og-agency-owners.png`: "Your AI Employee." / "Their workload."
- `og-agents.png`: "An AI teammate that never sleeps." / "₹999/month."
- `og-ai-employee.png`: "₹7,999/month." / "Cheaper than a junior agent."
- `og-demo.png`: "See it qualify a buyer." / "In under 90 seconds."

Output: `marketing-and-sales/realestateflow/assets/og/{slug}.png` at 1200×630 exact, file size <300KB each (compress if needed).

## 4. Manifest + meta-tag spec
Output `marketing-and-sales/realestateflow/assets/manifest.json`:
```json
{
  "name": "RealEstateFlow",
  "short_name": "REFlow",
  "description": "AI Employee for real estate agencies",
  "icons": [
    {"src": "/assets/favicons/192x192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/assets/favicons/512x512.png", "sizes": "512x512", "type": "image/png"}
  ],
  "theme_color": "#22C55E",
  "background_color": "#07111E",
  "display": "standalone",
  "start_url": "/"
}
```

And `marketing-and-sales/realestateflow/assets/meta-tag-snippet.html` to be pasted into `<head>` of every LP and the CRM SPA `index.html`:
```html
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicons/32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicons/16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicons/180x180.png">
<link rel="mask-icon" href="/assets/favicons/safari-pinned-tab.svg" color="#22C55E">
<link rel="manifest" href="/assets/manifest.json">
<meta name="theme-color" content="#22C55E">
<meta name="msapplication-TileColor" content="#22C55E">
<!-- OG defaults; override per page in P15 -->
<meta property="og:image" content="https://realestateflow.in/assets/og/og-default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://realestateflow.in/assets/og/og-default.png">
```

## 5. README at the assets root
`marketing-and-sales/realestateflow/assets/README.md` — explains directory structure, when to regenerate (color rebrand), and naming conventions.

Stop here. Do not edit any LP or SPA file (that's P15 + P16 dependency).
```

## Inputs
- Source PNG logo
- Brand kit
- `nano-banana-pro` access (Higgsfield subscription)

## Outputs
- `marketing-and-sales/realestateflow/assets/logos/final/logo.svg`
- `.../logo-dark.svg`
- `.../favicons/{16,32,48,64,180,192,256,512}.png` + `favicon.ico` + `safari-pinned-tab.svg`
- `.../og/{og-default, og-pricing, og-agency-owners, og-agents, og-ai-employee, og-demo}.png`
- `.../manifest.json`
- `.../meta-tag-snippet.html`
- `.../README.md`

## Success Criterion
SVG validates at W3C, all favicon sizes generated, all 6 OG cards <300KB each, https://www.opengraph.xyz preview shows correct image when LPs deploy.

## Fallback / Plan B
If `nano-banana-pro` produces low-quality OG cards, fall back to manual Canva production using `creative/realestateflow-launch/canva-layout-specs.md`. Or hire 1 freelance designer on Upwork for ₹5-8k for the full set.

## Risks
| Risk | Mitigation |
|---|---|
| SVG re-trace loses fidelity | Side-by-side PNG vs SVG visual diff; iterate up to 3 attempts before manual trace |
| OG cards look generic | Each card has tagline differentiation + Mumbai skyline accent |
| File sizes too large | Compress via `tinify` or `imagemin` after generation; cap 300KB |
| Apple touch icon doesn't render in iOS Safari | Test on real iPhone after P15 deploy |

## India / Mumbai-Specific Notes
- Mumbai skyline in OG cards (subtle Marine Drive + high-rise silhouettes) gives "Mumbai-built" credibility
- Brand colors stay neutral; no saffron/green/white tricolour or tricolour-adjacent imagery (avoids political signalling)

## Dependencies
- **Blocks:** P3 (signature.html uses logo URL), P15 (LP rewrite uses inline SVG), P16 (OG meta-tags), founder LinkedIn banner
- **Depends on:** PNG logo file already exists ✅

## Connected Skills
- `nano-banana-pro` — SVG re-trace + OG card generation
- `huashu-design` — design QA + sanity-check
- `image` — compression + format optimization
