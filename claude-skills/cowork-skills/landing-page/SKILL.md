---
name: Landing Page Generation
description: Create complete HTML landing pages with Hinglish copy, Meta Pixel integration, lead forms, and mobile-first responsive design for RealtyFlow.
---

# Landing Page Generation Skill

## Overview
This skill generates production-ready, single-file HTML landing pages for RealtyFlow. Each page includes:
- Mobile-first responsive design
- Hinglish marketing copy (70% English / 30% Hindi romanized)
- Meta Pixel tracking
- Optimized lead capture forms
- UTM parameter tracking
- A/B variant generation
- Zero external dependencies (CSS + JS embedded)

## Design System

### Color Palette — "Bazaar Signal" (v3)
```css
--ink: #1C1512;          /* Primary ground — warm near-black */
--paper: #FBF2E4;        /* Light ground — khata-ledger cream */
--marigold: #FF7A1A;     /* Primary accent — CTAs, prices, opportunity */
--gulal: #FF3D7F;        /* Secondary pop — once per screen only */
--tulsi: #1FAA59;        /* Sparing — checkmarks/verified only */
--danger: #EF4444;       /* Alerts, urgency */
```

### Typography
- **Display font:** Unbounded (headlines, hooks — 800/900 weight only)
- **Body font:** Manrope (system fallback: -apple-system, BlinkMacSystemFont, Segoe UI)
- **Headlines:** Unbounded 800 weight, 2.25rem-3.75rem
- **Body:** 400 weight, 1rem
- **Small text:** 0.875rem, 500 weight

### Spacing
- **Base unit:** 1rem (16px)
- **Sections:** 4rem (64px) vertical padding
- **Elements:** 1.5rem (24px) margins

## Page Structure (8 Sections)

### Section 1: Hero
```
[Navigation bar - logo + demo/login buttons]
[Large headline + subheadline]
[Hero image or video thumbnail]
[Primary CTA button]
[Social proof: "500+ agents trust RealtyFlow"]
```

### Section 2: Problem
```
[Problem headline in Hinglish]
[3 pain points with icons]
[Copy emphasizing Indian agent struggles]
[Social proof: testimonial or stat]
```

### Section 3: Solution
```
[Solution headline]
[4 key features with icons]
[Feature descriptions in Hinglish]
[Screenshot or demo GIF]
```

### Section 4: How It Works
```
[3-step process]
[Step 1 → 2 → 3 flow visualization]
[Each step has description + icon]
```

### Section 5: Social Proof
```
[Customer testimonials - 3 cards]
[Agency name, location, results]
[Rating stars (5-star)]
[Stat block: "25% more closes", "3x faster followup"]
```

### Section 6: Pricing
```
[Pricing table - 2-3 tiers]
[Feature comparison checkmarks]
[Monthly/annual toggle]
```

### Section 7: FAQ
```
[8-10 common questions]
[Collapsible accordion format]
[Hinglish copy with English technical terms]
```

### Section 8: CTA + Footer
```
[Final strong CTA]
[Lead form (lightweight)]
[Footer with links, contact, legal]
```

## Lead Form Structure

### Optimal Form Fields
```
1. Name (first + last)
2. Agency Name
3. Phone (+91 pre-filled for India)
4. Email
5. City (dropdown with major metros)
6. Team Size (1, 2-5, 6-10, 10+)
7. How did you hear (dropdown)
8. [Optional: I want demo checkbox]
```

### Form Validation
```javascript
- Name: Min 2 chars, letters + spaces only
- Phone: Exactly 10 digits (after +91)
- Email: Valid email format
- City: Required selection
- Show success message + thank you email
- Store in Google Sheets or JSON file (no backend required)
```

## Meta Pixel Integration

### Setup Code
```html
<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.queue=[];n.version='2.0';
n.queue.push(['track','PageView']);
t=b.createElement(e);t.async=!0;
t.src=v+'?id=YOUR_PIXEL_ID';
s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('track', 'PageView');
</script>
<!-- Replace YOUR_PIXEL_ID with actual ID -->
```

### Event Tracking Points
```javascript
// Trigger on form start
fbq('track', 'Lead', {value: 1, currency: 'INR'});

// Trigger on form submit
fbq('track', 'Contact', {value: 1, currency: 'INR'});

// Trigger on CTA click
fbq('track', 'ViewContent', {content_name: 'RealtyFlow'});
```

## UTM Parameter Capture

### Automatic URL Capture
```javascript
function getUTMParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || 'direct',
    utm_medium: params.get('utm_medium') || 'none',
    utm_campaign: params.get('utm_campaign') || 'none',
    utm_content: params.get('utm_content') || 'none'
  };
}

// Inject into form hidden fields and localStorage
localStorage.setItem('utm_params', JSON.stringify(getUTMParams()));
```

### Example Campaign URLs
```
https://app.realtyflow.io/landing?utm_source=meta&utm_medium=cpc&utm_campaign=leadgen_mumbai
https://app.realtyflow.io/landing?utm_source=google&utm_medium=cpc&utm_campaign=search_bangalore
https://app.realtyflow.io/landing?utm_source=linkedin&utm_medium=organic&utm_campaign=organic_reach
```

## A/B Testing Framework

### Variant 1: Pain-Focused
```
Hero: "Apne leads kho rahe ho?"
Subheader: "60% leads are lost to bad follow-ups"
Focus: Problem + solution
CTA: "See How It Works"
```

### Variant 2: Solution-Focused
```
Hero: "Close 25% More Deals"
Subheader: "RealtyFlow does the admin. You do the closing."
Focus: Results + benefits
CTA: "Try Free Demo"
```

### Variant 3: Social Proof-Focused
```
Hero: "500+ Indian Agents Close Bigger Deals"
Subheader: "They use RealtyFlow. Now it's your turn."
Focus: Credibility + FOMO
CTA: "Join Them Today"
```

### Testing Mechanics
```javascript
// A/B test variant assignment
function getVariant() {
  const stored = localStorage.getItem('variant');
  if (stored) return stored;

  const variant = Math.random() < 0.33 ? 'A' :
                  Math.random() < 0.67 ? 'B' : 'C';
  localStorage.setItem('variant', variant);

  // Track in Meta Pixel
  fbq('track', 'PageView', { variant: variant });
  return variant;
}
```

## Responsive Design Rules

### Mobile-First Breakpoints
```css
/* Mobile: 320px - 640px (base) */
body { font-size: 16px; padding: 1rem; }
h1 { font-size: 1.875rem; }
button { padding: 1rem; font-size: 1rem; width: 100%; }

/* Tablet: 641px - 1024px */
@media (min-width: 641px) {
  body { padding: 2rem; }
  h1 { font-size: 2.25rem; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
}

/* Desktop: 1025px+ */
@media (min-width: 1025px) {
  body { padding: 4rem 2rem; max-width: 1280px; margin: 0 auto; }
  h1 { font-size: 3.75rem; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; }
}
```

### Touch-Friendly Design
```css
/* Buttons minimum 48px tall */
button, a.btn {
  min-height: 48px;
  min-width: 48px;
  padding: 12px 24px;
}

/* Form inputs minimum 44px tall */
input, select, textarea {
  min-height: 44px;
  padding: 12px;
  font-size: 16px; /* Prevents zoom on iOS */
}
```

## Hinglish Copy Guidelines for Landing Pages

### Headlines (Emotional Impact)
```
✅ "Apne Dreams Ko Shakti De" (Give power to your dreams)
✅ "Close More Deals. Kamaao Zyada." (Make more money)
✅ "Real Estate, Reimagined for You"
❌ "Optimize Your Sales Pipeline" (Too generic)
```

### Subheadlines (Benefit-Driven)
```
✅ "Join 500+ agents closing 25% more deals"
✅ "Automate the boring stuff. Focus on closing."
✅ "Aapka CRM. Aapke rules. Real results."
❌ "Leverage our advanced platform"
```

### CTAs (Action-Oriented)
```
✅ "Start Free Demo"
✅ "See How It Works"
✅ "Join 500+ Agents"
❌ "Learn More"
❌ "Submit"
```

## Template Structure (Single-File HTML)

All landing pages follow this structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  [Meta tags, charset, viewport]
  [Meta Pixel code]
  [Embedded CSS - all styles]
</head>
<body>
  [Navigation]
  [Section 1: Hero]
  [Section 2: Problem]
  [Section 3: Solution]
  [Section 4: How It Works]
  [Section 5: Social Proof]
  [Section 6: Pricing]
  [Section 7: FAQ]
  [Section 8: CTA + Footer]
  [Embedded JavaScript - interactions]
</body>
</html>
```

## Implementation Checklist

- [ ] Replace `YOUR_PIXEL_ID` with Meta Pixel ID
- [ ] Update company email in footer
- [ ] Verify form validation works
- [ ] Test on mobile (iPhone, Android)
- [ ] Test form submission (check email/sheets integration)
- [ ] Verify UTM parameters capture
- [ ] Check Meta Pixel fires on page load + form submit
- [ ] Test all CTA buttons navigate correctly
- [ ] Verify social proof testimonials load
- [ ] Check heading hierarchy (H1 → H3)
- [ ] Run Lighthouse performance check (target: 90+)
- [ ] Test keyboard navigation (tab through form)
- [ ] Verify colors meet WCAG AA contrast standards

## Output File Format

Generate as: `landing-page-[variant]-[date].html`

Examples:
- `landing-page-pain-focused-feb17.html`
- `landing-page-social-proof-feb17.html`
- `landing-page-solution-focused-feb17.html`

All files are standalone, self-contained, and ready to deploy to any web host (AWS S3, Vercel, Netlify, GitHub Pages).

## Deployment Instructions

```bash
# Option 1: AWS S3
aws s3 cp landing-page-variant.html s3://your-bucket/index.html --content-type "text/html"

# Option 2: Python simple server (local testing)
python3 -m http.server 8000
# Visit http://localhost:8000/landing-page-variant.html

# Option 3: Upload to Netlify via drag-and-drop
# Visit drop.netlify.com, drag file, get shareable link
```

## Common Customizations

### For Specific City Campaign
```html
<h1>Real Estate in Mumbai Just Got Easier</h1>
<!-- Update hero image, testimonials, local landmarks -->
```

### For Specific Use Case
```html
<h2>For Solo Agents</h2>
<!-- vs For Agencies vs For Franchises -->
```

### For Different Personas
```html
<!-- Buyer persona: Focus on lead quality -->
<!-- Team leader persona: Focus on team management -->
<!-- Franchiser persona: Focus on standardization -->
```

## Performance Optimization

- All CSS embedded (zero external stylesheets)
- All JS embedded (zero external scripts except Meta Pixel)
- Hero image optimized to <100KB
- Form uses native HTML5 validation
- Meta Pixel lazy-loaded (non-blocking)
- Page should load <2 seconds on 4G

## Analytics Integration

Track these events in Google Analytics + Meta Pixel:
1. **Page View** - User lands on page
2. **Scroll Depth** - User scrolls to each section
3. **Form Start** - User clicks into form
4. **Form Submit** - User completes form
5. **CTA Click** - User clicks "See Demo" or "Try Free"
6. **Pricing Toggle** - User switches monthly/annual

All events fire automatically via embedded tracking code.
