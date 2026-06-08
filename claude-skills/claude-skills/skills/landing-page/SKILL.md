---
name: landing-page
description: >
  Generate complete HTML/CSS landing pages with Hinglish copy for RealtyFlow.
  Outputs responsive, conversion-optimized pages with hero, features, testimonials,
  pricing, and lead capture forms. Includes Meta Pixel integration and SEO tags.
disable-model-invocation: true
allowed-tools: Read, Write, Bash
---

# Landing Page Generation — RealtyFlow

Create a landing page for RealtyFlow. Brief: $ARGUMENTS

## Page Structure

```
1. Hero — Bold Hinglish headline + CTA + trust bar
2. Pain Points — 3-4 relatable problems in Hinglish
3. Solution — RealtyFlow intro + screenshots
4. Features — 6-8 with icons + Hinglish descriptions
5. How It Works — 3-step process
6. Social Proof — Hinglish testimonials from Indian agents
7. Results — Metrics (500+ agencies, ₹200Cr+ tracked)
8. Pricing — ₹ plans comparison
9. FAQ — Hinglish Q&A
10. Final CTA — Form + urgency
11. Footer — Links, contact
```

## Design System

- Colors: Primary #2563EB, Secondary #10B981, Accent #F59E0B
- Font: Inter (Google Fonts)
- Mobile-first responsive (80%+ traffic is mobile in India)
- CSS Grid/Flexbox layout

## Lead Form Fields
Name, Agency Name, Phone (+91), Email, City (Mumbai/Pune/Delhi/Bangalore), Team Size

## Required Integrations
- Meta Pixel: `fbq('track', 'Lead')` on form submit
- UTM parameter capture from URL
- Google Analytics 4 tag

## Hinglish Copy Rules
- 70% English, 30% Hindi (romanized)
- Emotions in Hindi, technical terms in English
- Must sound spoken, not written
- Use ₹, crore, lakh for numbers

## Output

Save to `marketing-and-sales/creative/landing-pages/[page-name]/`:
- `index.html` — Complete page with CSS
- `copy.md` — All text content for review
- `variants.md` — A/B variant descriptions
