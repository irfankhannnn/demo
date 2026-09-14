# 🎨 RealtyFlow Design System

**Complete design system and brand guidelines for RealtyFlow real estate platform**

> Apne Real Estate Business Ko Next Level Le Jaao  
> *Transform real estate businesses with intelligent tools*

---

## 📂 What's Inside

```
realestateflow/
├── design.md                      # Complete design system documentation
├── design-tokens.json             # Machine-readable design tokens (for dev tools)
├── components.md                  # Component library with code snippets
├── huashu-design.config.json      # Huashu design configuration
├── assets/                        # Generated design assets
│   ├── logos/                     # Brand logos (color, white, etc.)
│   ├── posters/                   # Marketing posters
│   ├── social-media/              # Social media templates & assets
│   ├── landing-pages/             # Landing page designs
│   ├── videos/                    # Video assets & promotional content
│   └── ui-components/             # UI element library
└── README.md                      # This file
```

---

## 🚀 Quick Start

### For Design Agents (nano-designer, motion-engineer)

1. **Reference the Design System:**
   - Start with `design.md` for complete token reference
   - Check `components.md` for code snippets and usage examples
   - Use `design-tokens.json` for programmatic access to tokens

2. **When Creating Assets:**
   - Always use the design tokens (colors, typography, spacing)
   - Follow the Hinglish tone guide (70% English + 30% Hindi)
   - Use component patterns from `components.md`

3. **Design Directions:**
   - Modern Minimal: Clean, spacious, typography-focused
   - Bold Vibrant: Strong colors, energetic, dynamic
   - Data-Driven: Infographic-heavy, metric-focused

### For Huashu Design Integration

1. **Configuration:**
   ```bash
   # Huashu automatically reads huashu-design.config.json
   # No setup needed - configuration is embedded
   ```

2. **Activation Triggers:**
   - **"Create interactive prototype"** → Interactive HTML landing page
   - **"Design variants"** → 3 parallel design directions
   - **"Export MP4"** → Motion graphics promotional video
   - **"Create poster"** → Social media optimized PNG
   - **"Design review"** → 5D critique with recommendations

3. **Output Formats:**
   - Web: 1920x1080 PNG/WebP/SVG
   - Social: Instagram (1080x1080, 1080x1920), LinkedIn (1200x627)
   - Print: 300 DPI PDF
   - Video: MP4 (1920x1080, 60fps)

---

## 🎨 Design Tokens Reference

### Colors
- **Primary:** #0F172A (Dark Slate) - Headlines, CTAs
- **Blue:** #2563EB (Brand Blue) - Interactive elements
- **Accent:** #22C55E (Growth Green) - Success states
- **Background:** #F8FAFC (Light Gray) - Page backgrounds

### Typography
- **Headings:** Poppins (600-800 weight)
- **Body:** Inter (400-600 weight)
- **Sizes:** H1 48px, H2 32px, H3 20px, Body 16px

### Spacing Scale
- xs: 4px | sm: 8px | md: 16px | lg: 24px | xl: 40px | xxl: 80px

### Components
- **Buttons:** Primary, Secondary, Outline (6px radius, 12px padding)
- **Cards:** 24px padding, 10px radius, shadow elevation
- **Metrics:** Stat boxes with label, value, change indicator
- **Forms:** Input fields, textarea, select, checkbox

---

## 📝 Hinglish Brand Voice

**Tone:** Casual, friendly, action-oriented  
**Ratio:** 70% English + 30% Hindi (romanized)

### Key Phrases
- **Apna** - builds ownership ("Apna business ko manage karo")
- **Easy ho gaya** - simplification ("Deals track karna easy ho gaya")
- **Next level** - progress ("Real estate ko next level le jaao")
- **Ek jagah** - consolidation ("Sab kuch ek platform mein")

### Examples
✅ "Apne deals ko track karo, clients ko manage karo, closing time karo!"  
✅ "Ek platform mein sab kuch - properties, leads, follow-ups"  
✅ "Real estate agents ke liye built, agents ke saath grow kiya"

---

## 🎬 Asset Generation Workflow

### Step 1: Brief Huashu Design
```
Use this trigger:
"Create [design_type] for RealtyFlow with the following:
- Brand colors: Dark slate (#0F172A) + Blue (#2563EB) + Green (#22C55E)
- Typography: Poppins headings, Inter body
- Tone: Modern, professional, India-focused
- Include Hinglish text: [specify text/copy]
- Format: [PNG/HTML/MP4]"
```

### Step 2: Generate Assets
Huashu outputs assets to the `assets/` folder with naming convention:
```
{type}_{variant}_{date}_{size}.{format}
Example: poster_bold_2026-05-03_1080x1920.png
```

### Step 3: Review & Use
- Check asset in design preview
- Update if needed (Huashu can iterate)
- Use in campaigns or deploy to landing pages

---

## 📊 Component Gallery

### Button Variants
```html
<button class="btn btn-primary">Primary Action</button>
<button class="btn btn-secondary">Secondary Action</button>
<button class="btn btn-outline">Alternative Action</button>
<button class="btn btn-primary btn-lg">Large Button</button>
```

### Card Layouts
```html
<!-- Feature Card -->
<div class="card">
  <h3 class="card-title">Track Everything</h3>
  <p>Manage deals, clients, properties in one place</p>
</div>

<!-- Metric Card -->
<div class="card card-metric">
  <span class="metric-label">Active Deals</span>
  <strong class="metric-value">2,435</strong>
  <span class="metric-change positive">+23% this month</span>
</div>
```

### Form Elements
```html
<div class="form-group">
  <label class="form-label">Email</label>
  <input type="email" class="form-input" placeholder="your@email.com" />
</div>
```

See `components.md` for complete component library with CSS.

---

## 🔗 Integration Guide

### For Claude Design Agents

**nano-designer** (Image Generation)
- Use design tokens in DALL-E 3 prompts
- Reference design directions for style guidance
- Export as PNG for web/social

**motion-engineer** (Video Production)
- Import color tokens to Remotion configs
- Use typography and spacing scales
- Export MP4 with 60fps for social

**landing-page-builder** (Web Design)
- Build with component library from `components.md`
- Use TailwindCSS classes matching design tokens
- Implement responsive grid (12-column)

### For Huashu Design

1. **Configuration Path:** `huashu-design.config.json`
2. **Output Path:** `assets/` subdirectories
3. **Triggers:** Use activation phrases from config
4. **Formats:** HTML, PNG, MP4, PPTX supported

---

## 📈 Design Directions

### 1. Modern Minimal
- Clean lines, abundant whitespace
- Typography-focused hierarchy
- Subtle shadows and borders
- **Best for:** Landing pages, professional content

### 2. Bold Vibrant
- Strong color contrasts
- Dynamic layouts
- Energetic mood
- **Best for:** Social media, promotional ads

### 3. Data-Driven
- Infographic-heavy
- Metric-focused
- Information architecture
- **Best for:** Reports, case studies, dashboards

---

## 🎯 Use Cases & Templates

### Landing Page
- Hero section with image
- Feature grid (3-column)
- Metrics/stats section
- CTA section
- Footer with links

### Social Media Posts
- Square (1080x1080px) - Instagram Feed
- Story (1080x1920px) - Instagram Stories
- Wide (1200x627px) - LinkedIn
- Include 2-3 variant designs

### Promotional Poster
- Size: 1080x1920px (Instagram Story)
- Include headline, visuals, CTA
- 2 design direction variants
- Export high-res PNG

### Promo Video
- Duration: 15-30 seconds
- Format: MP4, 1920x1080, 60fps
- Include brand reveal, product showcase
- Add text animations and transitions

---

## 🛠️ Maintenance & Updates

### When to Update Design System
- New brand guidelines from leadership
- Design direction changes
- Component refactoring
- Token value updates

### Version Control
- Document changes in comments
- Update version number in JSON
- Keep CHANGELOG (if needed)
- Communicate updates to team

### Checking Design System Usage
```bash
# Verify all design tokens are referenced
grep -r "design-tokens.json" marketing-and-sales/

# Check Huashu config in use
grep -r "huashu-design.config.json" marketing-and-sales/
```

---

## 📞 Support & Resources

### Design Files
- **Figma:** [Add shared Figma link here]
- **Design Tokens:** `design-tokens.json`
- **Components:** `components.md`

### Team Contacts
- **Brand Strategy:** brand-strategist agent
- **Design Creation:** nano-designer agent
- **Video Production:** motion-engineer agent
- **Landing Pages:** landing-page-builder agent

### Documentation
- Full system guide: `design.md`
- Component library: `components.md`
- Huashu config: `huashu-design.config.json`
- Asset path: `assets/`

---

## 📋 Asset Checklist

Before deploying creatives, verify:

- [ ] Brand colors used correctly (#0F172A, #2563EB, #22C55E)
- [ ] Typography matches design tokens (Poppins/Inter)
- [ ] Spacing follows scale (4, 8, 16, 24, 40, 80px)
- [ ] Component patterns from `components.md` applied
- [ ] Hinglish copy follows tone guide (70/30 ratio)
- [ ] Responsive design tested (mobile, tablet, desktop)
- [ ] Accessibility checked (contrast, readability)
- [ ] File naming convention followed
- [ ] Exported in correct format/resolution

---

## 🚀 Next Steps

1. **Familiarize yourself** with design tokens in `design.md`
2. **Review component library** in `components.md`
3. **Check Huashu config** for asset generation triggers
4. **Start creating** - use briefs that reference this system
5. **Store assets** in `assets/` with proper naming

---

**RealtyFlow Design System v1.0**  
Last Updated: May 3, 2026  
Status: Production Ready ✅  
Maintained by: Design Team (nano-designer, motion-engineer, brand-strategist)
