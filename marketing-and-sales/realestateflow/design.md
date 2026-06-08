# RealtyFlow Design System v1.0

**Brand:** RealtyFlow | **Market:** India & Dubai | **Tone:** Hinglish (70% English + 30% Hindi) | **Audience:** Real Estate Agents

---

## 🎨 Part 1: Design Tokens (Source of Truth)

### Color Palette

```json
{
  "colors": {
    "primary": "#0F172A",
    "primaryAlt": "#1E293B",
    "blue": "#2563EB",
    "blueLight": "#3B82F6",
    "accent": "#22C55E",
    "accentLight": "#4ADE80",
    "warning": "#EAB308",
    "danger": "#EF4444",
    "background": "#F8FAFC",
    "surface": "#FFFFFF",
    "surfaceSecondary": "#F1F5F9",
    "border": "#E2E8F0",
    "borderDark": "#CBD5E1",
    "text": "#111827",
    "textSecondary": "#475569",
    "textTertiary": "#64748B",
    "overlay": "rgba(0,0,0,0.5)"
  }
}
```

**Usage:**
- **Primary (#0F172A):** Headings, CTAs, primary navigation
- **Blue (#2563EB):** Links, interactive elements, highlights
- **Accent (#22C55E):** Success states, achievements, growth metrics
- **Background (#F8FAFC):** Page backgrounds, neutral sections
- **Text (#111827):** Body content, paragraphs

### Typography System

```json
{
  "fonts": {
    "heading": "Poppins, sans-serif",
    "body": "Inter, sans-serif",
    "mono": "JetBrains Mono, monospace"
  },
  "sizes": {
    "h1": "48px",
    "h2": "32px",
    "h3": "20px",
    "h4": "18px",
    "body": "16px",
    "small": "14px",
    "tiny": "12px"
  },
  "lineHeights": {
    "tight": 1.2,
    "normal": 1.5,
    "relaxed": 1.75
  },
  "fontWeights": {
    "light": 300,
    "regular": 400,
    "medium": 500,
    "semibold": 600,
    "bold": 700,
    "extrabold": 800
  }
}
```

**Usage:**
- **Poppins (Heading):** Headlines, titles, branding text
- **Inter (Body):** Body text, descriptions, UI labels
- **Line height relaxed (1.75):** For body copy (better readability)
- **Line height tight (1.2):** For headings

### Spacing Scale

```json
{
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "40px",
    "xxl": "80px"
  }
}
```

**Usage:**
- **xs (4px):** Micro-interactions, gaps within components
- **sm (8px):** Component padding, small gaps
- **md (16px):** Standard padding, section spacing
- **lg (24px):** Large padding, medium section spacing
- **xl (40px):** Major section spacing
- **xxl (80px):** Page-level spacing

### Border Radius & Shadows

```json
{
  "radius": {
    "sm": "6px",
    "md": "10px",
    "lg": "14px",
    "full": "9999px"
  },
  "shadows": {
    "sm": "0 2px 8px rgba(0, 0, 0, 0.04)",
    "md": "0 4px 16px rgba(0, 0, 0, 0.08)",
    "lg": "0 10px 30px rgba(0, 0, 0, 0.1)",
    "xl": "0 20px 50px rgba(0, 0, 0, 0.15)",
    "card": "0 10px 30px rgba(0, 0, 0, 0.05)"
  }
}
```

**Usage:**
- **radius sm:** Buttons, input fields
- **radius md:** Cards, modals
- **radius lg:** Large containers
- **shadow sm:** Subtle elevation (hover states)
- **shadow lg:** Cards, prominent containers

---

## 🧩 Part 2: Core UI Components

### Button Component

```html
<!-- Primary Button -->
<button class="btn btn-primary">
  Get Demo
</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">
  Learn More
</button>

<!-- Outline Button -->
<button class="btn btn-outline">
  Contact Us
</button>

<!-- Disabled Button -->
<button class="btn btn-primary" disabled>
  Coming Soon
</button>
```

**CSS:**
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  border: none;
  border-radius: 6px;
  font-family: Poppins, sans-serif;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #2563EB;
  color: white;
}

.btn-primary:hover {
  background: #1D4ED8;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
}

.btn-secondary {
  background: #F1F5F9;
  color: #0F172A;
}

.btn-secondary:hover {
  background: #E2E8F0;
}

.btn-outline {
  background: transparent;
  color: #2563EB;
  border: 2px solid #2563EB;
}

.btn-outline:hover {
  background: #2563EB;
  color: white;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Card Component

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Track Everything</h3>
  </div>
  <div class="card-body">
    <p>Manage deals, clients, and properties seamlessly in one platform.</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary btn-sm">Learn More</button>
  </div>
</div>
```

**CSS:**
```css
.card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.card:hover {
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
}

.card-header {
  margin-bottom: 16px;
}

.card-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #0F172A;
}

.card-body {
  margin-bottom: 16px;
  color: #475569;
  line-height: 1.6;
}

.card-body p {
  margin: 0;
}

.card-footer {
  padding-top: 16px;
  border-top: 1px solid #E2E8F0;
}
```

### Metric Box Component

```html
<div class="metric">
  <span class="metric-label">Active Deals</span>
  <strong class="metric-value">24</strong>
  <span class="metric-change positive">+12% this month</span>
</div>
```

**CSS:**
```css
.metric {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #F8FAFC;
  border-radius: 10px;
  text-align: center;
}

.metric-label {
  font-size: 14px;
  color: #475569;
  font-weight: 500;
}

.metric-value {
  font-size: 32px;
  color: #0F172A;
  font-weight: 700;
}

.metric-change {
  font-size: 12px;
  font-weight: 500;
}

.metric-change.positive {
  color: #22C55E;
}

.metric-change.negative {
  color: #EF4444;
}
```

### Table Component

```html
<table class="table">
  <thead>
    <tr>
      <th>Client Name</th>
      <th>Status</th>
      <th>Amount</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Arjun Kumar</td>
      <td><span class="badge badge-success">Active</span></td>
      <td>₹45,00,000</td>
      <td><button class="btn btn-sm btn-outline">View</button></td>
    </tr>
  </tbody>
</table>
```

**CSS:**
```css
.table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.table thead {
  background: #F1F5F9;
}

.table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  color: #0F172A;
  border-bottom: 2px solid #E2E8F0;
}

.table td {
  padding: 16px;
  border-bottom: 1px solid #E2E8F0;
  color: #475569;
}

.table tbody tr:hover {
  background: #F8FAFC;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  background: #D1FAE5;
  color: #065F46;
}

.badge-warning {
  background: #FEF3C7;
  color: #92400E;
}

.badge-danger {
  background: #FEE2E2;
  color: #991B1B;
}
```

### Input & Form Components

```html
<div class="form-group">
  <label class="form-label">Email Address</label>
  <input type="email" class="form-input" placeholder="your@email.com" />
</div>

<div class="form-group">
  <label class="form-label">Message</label>
  <textarea class="form-input form-textarea" placeholder="Your message here..."></textarea>
</div>
```

**CSS:**
```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #0F172A;
}

.form-input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  font-family: Inter, sans-serif;
  font-size: 16px;
  color: #0F172A;
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 120px;
}
```

---

## 🎬 Part 3: Brand & Marketing Guidelines

### Hinglish Copy Style Guide

**RealtyFlow speaks in Casual Hinglish** - conversational, friendly, action-oriented

**Examples:**
- ✅ "Apne deals ko track karo, clients ko manage karo, closing time karo!"
- ✅ "Ek platform mein sab kuch - properties, leads, follow-ups"
- ✅ "Real estate agents ke liye built, agents ke saath grow kiya"
- ❌ "Please track your deals in our customer relationship management system"
- ❌ "Advanced Property Management Solutions"

**Key Phrases:**
- "Apna" (your/ours) - builds ownership
- "Easy ho gaya" - simplification
- "Next level" - progress/growth
- "Real agents, real deals" - authenticity
- "Ek jagah" (one place) - consolidation

### Visual Tone

- **Bold & Confident:** Use primary color (#0F172A) prominently
- **Clean & Modern:** Generous whitespace, minimal clutter
- **Inclusive:** Show diverse agents, properties, locations
- **Growth-oriented:** Metrics, upward arrows, success stories

### Logo Usage

- **Clear Space:** Minimum 20px on all sides
- **Size:** Never smaller than 40px width
- **Color Variants:**
  - Full color on light backgrounds
  - White on dark/blue backgrounds
  - Single color on limited color contexts

---

## 📱 Part 4: Responsive Breakpoints

```json
{
  "breakpoints": {
    "mobile": "0px",
    "tablet": "640px",
    "desktop": "1024px",
    "wide": "1280px"
  }
}
```

---

## 🎨 Part 5: Component Gallery & Templates

### Hero Section Template

```html
<section class="hero">
  <div class="hero-content">
    <h1 class="hero-title">Apne Real Estate Business Ko Next Level Le Jaao</h1>
    <p class="hero-subtitle">Track deals, manage leads, close faster - ek platform mein sab kuch</p>
    <button class="btn btn-primary btn-lg">Get Started Free</button>
  </div>
  <div class="hero-image">
    <img src="path/to/hero-image.jpg" alt="RealtyFlow Platform" />
  </div>
</section>
```

```css
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: center;
  padding: 80px 40px;
  background: linear-gradient(135deg, #F8FAFC 0%, #E0E7FF 100%);
}

.hero-content {
  max-width: 600px;
}

.hero-title {
  font-size: 48px;
  font-weight: 800;
  color: #0F172A;
  margin-bottom: 16px;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 18px;
  color: #475569;
  margin-bottom: 32px;
  line-height: 1.6;
}

@media (max-width: 1024px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 60px 20px;
  }

  .hero-title {
    font-size: 32px;
  }
}
```

---

## 🚀 Part 6: Design Handoff for Claude Agents

### For Nano-Designer Agent:

Use these tokens in DALL-E 3 / Gemini Imagen prompts:
```
Create a [design type] featuring:
- Primary color: Dark slate (#0F172A)
- Accent: Green (#22C55E)
- Typography: Modern (Poppins headings, Inter body)
- Style: Clean, minimal, professional
- Tone: Modern India-focused real estate platform
- Include Hinglish text if applicable
```

### For Motion-Engineer Agent:

Use these tokens in Remotion video configs:
```javascript
export const DESIGN_TOKENS = {
  colors: {
    primary: '#0F172A',
    blue: '#2563EB',
    accent: '#22C55E'
  },
  fonts: {
    heading: 'Poppins',
    body: 'Inter'
  },
  spacing: [4, 8, 16, 24, 40, 80]
};
```

### For Landing-Page-Builder Agent:

Build all pages with:
- **Color scheme:** Primary + Blue + Accent
- **Grid:** 12-column responsive grid
- **Typography:** Poppins/Inter stack
- **Spacing:** Use spacing scale (no hardcoded values)
- **Components:** Use card, button, metric from this system

---

## 📐 Part 7: Huashu Design Integration

### Activation Phrases for Design Prototyping

When briefing design work, use these triggers:
- **"Create interactive prototype"** → Huashu generates clickable HTML
- **"Design variants"** → 3+ parallel design directions
- **"Export MP4"** → Motion graphics with BGM
- **"Create poster"** → Social media optimized PNGs
- **"Design review"** → 5D radar chart + critique

### Huashu Output Formats

| Use Case | Output | Time |
|----------|--------|------|
| Landing page mockup | Interactive HTML + mobile frame | 10-15 min |
| Social media assets | PNG + Instagram Story sizes | 5-10 min |
| Video promo | MP4 (60fps) + subtitle file | 8-12 min |
| Design variants | 3 directions with annotations | 10 min |
| App prototype | Clickable iPhone frame demo | 15-20 min |

---

## 🔗 Quick Reference Links

- **Figma:** [Link to shared Figma design file - to be added]
- **Brand Assets:** `/realestateflow/assets/`
- **Component Code:** See `components.md`
- **Design Tokens (JSON):** See `design-tokens.json`

---

**Last Updated:** May 3, 2026 | **Status:** v1.0 - Production Ready
