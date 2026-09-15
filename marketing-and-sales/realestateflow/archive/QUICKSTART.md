# 🚀 RealtyFlow Design System - Quick Start Guide

**Get started creating brand-perfect marketing assets in minutes**

---

## ⚡ 5-Minute Setup

### 1. Copy Design Tokens (30 seconds)
```json
// colors
Primary: #0F172A (Dark Slate)
Blue: #2563EB (Brand Blue)
Accent: #22C55E (Growth Green)
```

### 2. Import CSS (2 minutes)
```html
<!-- Add to your HTML <head> -->
<link rel="stylesheet" href="assets/realtyflow.css">
```

### 3. Start Building (3 minutes)
```html
<!-- Hero Section -->
<section class="py-xl">
  <div class="container">
    <h1>Apne Deals Ko Track Karo</h1>
    <button class="btn btn-primary btn-lg">Get Started</button>
  </div>
</section>
```

---

## 🎨 Design System Files

| File | Purpose | Use Case |
|------|---------|----------|
| **design.md** | Complete system documentation | Reference for all design decisions |
| **components.md** | Component library with code | Copy-paste component HTML/CSS |
| **design-tokens.json** | Machine-readable tokens | For dev tools, automation |
| **tailwind.config.realtyflow.js** | Tailwind CSS integration | TailwindCSS projects |
| **assets/realtyflow.css** | Standalone CSS file | No-build-tool landing pages |
| **huashu-design.config.json** | Design automation config | For Huashu design generation |

---

## 🎯 Quick Recipes

### Recipe 1: Landing Page in 10 Minutes

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="assets/realtyflow.css">
  <title>RealtyFlow - Real Estate Platform</title>
</head>
<body>
  <!-- Hero -->
  <section class="py-xl" style="background: linear-gradient(135deg, #F8FAFC 0%, #E0E7FF 100%);">
    <div class="container">
      <div class="grid grid-2">
        <div>
          <h1>Apne Deals Ko Track Karo, Faster Close Karo</h1>
          <p class="text-body-large">Real estate agents ke liye built. Simple, powerful, effective.</p>
          <div class="btn-group">
            <button class="btn btn-primary btn-lg">Get Started Free</button>
            <button class="btn btn-outline">Watch Demo</button>
          </div>
        </div>
        <div>
          <img src="hero-image.jpg" alt="Hero" style="width: 100%; border-radius: 14px;">
        </div>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section class="py-xl">
    <div class="container">
      <h2 class="text-center">Key Features</h2>
      <div class="grid grid-3" style="margin-top: 40px;">
        <div class="card">
          <h3>🎯 Track Deals</h3>
          <p class="card-description">Never lose track of your pipeline again</p>
        </div>
        <div class="card">
          <h3>📞 Manage Leads</h3>
          <p class="card-description">Organize and follow up with every lead</p>
        </div>
        <div class="card">
          <h3>⚡ Close Faster</h3>
          <p class="card-description">Reduce cycle time and increase conversion</p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="py-xl" style="background: #0F172A; color: white; text-align: center;">
    <div class="container">
      <h2 style="color: white;">Ready to Transform Your Business?</h2>
      <p style="color: #E2E8F0; margin-bottom: 30px;">Join 500+ agents already closing deals faster</p>
      <button class="btn btn-primary btn-lg">Start Free Trial</button>
    </div>
  </section>
</body>
</html>
```

### Recipe 2: Social Media Post (5 Minutes)

```html
<!-- Instagram Post (1080x1080) -->
<div style="
  width: 1080px;
  height: 1080px;
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  padding: 40px;
  font-family: 'Poppins', sans-serif;
  text-align: center;
">
  <h2 style="font-size: 48px; font-weight: 800; margin-bottom: 20px;">
    Apne Deals Ko Track Karo
  </h2>
  <p style="font-size: 24px; margin-bottom: 40px; opacity: 0.9;">
    RealtyFlow - Real Agents, Real Deals
  </p>
  <div style="
    background: #2563EB;
    color: white;
    padding: 15px 40px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 18px;
  ">
    Get Demo
  </div>
</div>
```

### Recipe 3: Email Signature

```html
<table style="font-family: 'Inter', sans-serif; max-width: 600px;">
  <tr>
    <td style="padding: 20px; border-left: 4px solid #2563EB;">
      <strong style="color: #0F172A; font-size: 16px;">Team RealtyFlow</strong>
      <div style="color: #475569; font-size: 14px; margin-top: 8px;">
        <p style="margin: 4px 0;">📧 support@realtyflow.com</p>
        <p style="margin: 4px 0;">🌐 www.realtyflow.com</p>
      </div>
    </td>
  </tr>
</table>
```

---

## 🎬 Using with Huashu Design

### Trigger 1: Create Landing Page Prototype
```
Message to Huashu:
"Create interactive prototype for RealtyFlow landing page with:
- Hero section with headline 'Apne Deals Ko Track Karo'
- Feature grid (3 cards): Track Deals, Manage Leads, Close Faster
- CTA section with 'Get Started Free' button
- Mobile responsive
- Use design tokens: Primary #0F172A, Blue #2563EB, Accent #22C55E
- Hinglish copy: 'Real estate agents ke liye built'"
```

### Trigger 2: Create Social Media Set
```
Message to Huashu:
"Design social media creative set for RealtyFlow:
- 3 Instagram posts (1080x1080)
- 1 Instagram story template (1080x1920)
- Variant 1: Bold Vibrant (strong colors, energetic)
- Variant 2: Modern Minimal (clean, spacious)
- Include Hinglish headlines
- Export as PNG files"
```

### Trigger 3: Create 15-Second Promo Video
```
Message to Huashu:
"Create 15-second promotional video for RealtyFlow:
- Scene 1: Brand reveal with logo animation (3 sec)
- Scene 2: Property listing montage (6 sec)
- Scene 3: Happy agent testimonial (4 sec)
- Scene 4: CTA 'Get Started Free' (2 sec)
- Colors: Use RealtyFlow palette (#0F172A, #2563EB, #22C55E)
- Music: Upbeat real estate theme
- Export as MP4 (1920x1080, 60fps)"
```

---

## 📐 Component Quick Reference

### Buttons
```html
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-primary btn-lg">Large</button>
<button class="btn btn-primary btn-sm">Small</button>
```

### Cards
```html
<div class="card">
  <h3 class="card-title">Feature Title</h3>
  <p class="card-description">Feature description</p>
</div>
```

### Forms
```html
<div class="form-group">
  <label class="form-label">Email</label>
  <input type="email" class="form-input" placeholder="your@email.com">
</div>
```

### Metrics
```html
<div class="metric">
  <span class="metric-label">Active Deals</span>
  <strong class="metric-value">2,435</strong>
  <span class="metric-change positive">+23% this month</span>
</div>
```

### Grids
```html
<div class="grid grid-3">
  <!-- 3 columns on desktop, 1 on mobile -->
</div>

<div class="grid grid-2">
  <!-- 2 columns on desktop, 1 on mobile -->
</div>
```

---

## 🔑 Key CSS Variables

```css
/* Colors */
--color-primary: #0F172A;
--color-blue: #2563EB;
--color-accent: #22C55E;

/* Fonts */
--font-heading: 'Poppins', sans-serif;
--font-body: 'Inter', sans-serif;

/* Spacing */
--spacing-md: 16px;
--spacing-lg: 24px;

/* Radius */
--radius-sm: 6px;
--radius-md: 10px;

/* Shadows */
--shadow-card: 0 10px 30px rgba(0, 0, 0, 0.05);
```

**Use in your CSS:**
```css
.my-custom-element {
  color: var(--color-primary);
  font-family: var(--font-heading);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-card);
}
```

---

## 🌐 Responsive Design

All components are mobile-first responsive. Breakpoints:
- **Mobile:** 0px
- **Tablet:** 640px
- **Desktop:** 1024px
- **Wide:** 1280px

Use CSS media queries:
```css
@media (max-width: 640px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
```

---

## 🎬 Typography Quick Sizes

```
H1: 48px  (Headings, hero titles)
H2: 32px  (Section headings)
H3: 20px  (Card titles)
Body: 16px (Regular text)
Small: 14px (Labels, captions)
```

---

## ✨ Hinglish Copy Snippets

**Ready-to-use headlines:**
- "Apne Deals Ko Track Karo, Faster Close Karo"
- "Ek Platform Mein Sab Kuch"
- "Real Estate Agents Ke Liye Built"
- "Deals Track Karna Easy Ho Gaya"
- "Next Level Real Estate Platform"

**CTAs:**
- "Get Started Free"
- "Watch Demo"
- "Learn More"
- "Join Now"
- "Start Free Trial"

---

## 🔗 External Fonts (Add to HTML)

```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## 📋 Checklist Before Launch

- [ ] Design tokens applied (colors, fonts, spacing)
- [ ] Components use right styles (buttons, cards, forms)
- [ ] Hinglish copy reviewed (70/30 ratio)
- [ ] Responsive tested on mobile & desktop
- [ ] Contrast checked for accessibility
- [ ] File naming convention followed
- [ ] Exported in correct size/format

---

## 🆘 Troubleshooting

**Colors not matching?**
→ Check you're using exact hex values from design-tokens.json

**Spacing looks off?**
→ Use spacing scale: 4, 8, 16, 24, 40, 80px (no random values)

**Font not loading?**
→ Add Google Fonts link to `<head>`

**Button doesn't look right?**
→ Make sure you have `class="btn btn-primary"` (both classes needed)

**Mobile layout broken?**
→ Use `grid` classes (grid-2, grid-3) which auto-stack on mobile

---

## 🚀 Next Steps

1. **Pick a recipe above** (landing page, social, email)
2. **Copy the code**
3. **Customize text with Hinglish copy**
4. **Add your images**
5. **Test on mobile**
6. **Deploy!**

---

## 📚 Full Documentation

- **Complete system:** See `design.md`
- **All components:** See `components.md`
- **Design tokens:** See `design-tokens.json`

---

**RealtyFlow Design System v1.0** | Production Ready ✅
