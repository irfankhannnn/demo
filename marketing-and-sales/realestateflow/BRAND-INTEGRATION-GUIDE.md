# 🔗 RealtyFlow Brand Integration Guide

**How to Pass Brand Details to Skills, Agents, and External Creatives**

**Version:** 1.0  
**Date:** May 4, 2026  
**For:** Developers, Marketing Leads, Team Coordinators

---

## 📊 Overview

The RealtyFlow brand is now fully documented in machine-readable formats that can be integrated with:
- ✅ Nano Banana Pro (image generation)
- ✅ Claude AI agents (prompt engineering)
- ✅ External design agencies
- ✅ Development frameworks (CSS, design tokens)
- ✅ Marketing automation systems

---

## 📁 Core Brand Files

### 1. **NANO-BANANA-BRIEF.json**
**Purpose:** Brand data optimized for AI image generation  
**Contains:**
- Color specifications (hex, RGB, usage)
- Typography details (fonts, weights, sizes)
- Design principles and guidelines
- Messaging and tone
- Creative dimensions for all formats
- Nano Banana-specific instructions
- Conformance checklist

**Usage:** Pass to Nano Banana skill, share with design agencies, reference in prompts

**Size:** ~8 KB (lightweight, easy to share)

### 2. **NANO-BANANA-USAGE-GUIDE.md**
**Purpose:** Step-by-step instructions for generating consistent creatives  
**Contains:**
- Quick reference (colors, fonts, philosophy)
- Methods to use the brief (copy-paste, full reference, templates)
- Step-by-step creative generation workflow
- Complete prompt examples (Instagram, email, logo)
- File organization structure
- Role-specific guidance (designers, developers, marketers)
- Validation checklist

**Usage:** Train team members, reference during creative requests, validate outputs

### 3. **BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md**
**Purpose:** Comprehensive human-readable brand guidelines  
**Contains:**
- Brand overview and promise
- Complete color palette with psychology
- Typography hierarchy
- Design principles explained
- Component specifications
- Website structure guidelines
- Instagram strategy
- Email and WhatsApp templates
- Brand evolution roadmap

**Usage:** Brand training, design decisions, compliance reviews

### 4. **design-tokens-authority.json**
**Purpose:** Design tokens for developers and design tools  
**Contains:**
- CSS variables ready to use
- Color definitions with multiple formats
- Typography tokens
- Component specifications
- Spacing scale
- Implementation timeline

**Usage:** Figma, CSS-in-JS frameworks, design system integrations

### 5. **brand-styles-authority.css**
**Purpose:** Production-ready CSS (copy-paste into projects)  
**Contains:**
- CSS variables for colors, spacing, fonts
- Base component styles (buttons, cards, forms)
- Responsive breakpoints
- Accessibility features
- Utility classes

**Usage:** Website implementation, HTML templates, quick styling

---

## 🚀 Integration Paths

### Path 1: Nano Banana Skill (Image Generation)

**For:** Creating Instagram posts, hero images, email banners, logos, ads

**Step 1: Prepare Brief**
```bash
# File already created at:
marketing-and-sales/realestateflow/NANO-BANANA-BRIEF.json
```

**Step 2: Build Prompt**
```
Reference the NANO-BANANA-USAGE-GUIDE.md
Extract parameters from NANO-BANANA-BRIEF.json
Build detailed prompt with:
- Creative type
- Dimensions
- Colors (hex codes)
- Fonts
- Style guidelines
- Messaging
- Validation requirements
```

**Step 3: Execute**
```bash
/nano-banana create-image \
  --brief marketing-and-sales/realestateflow/NANO-BANANA-BRIEF.json \
  --prompt "Your detailed prompt here"
```

**Step 4: Validate**
Use `NANO-BANANA-BRIEF.json` → `conformanceChecklist`

---

### Path 2: Claude AI Agents (Content Generation)

**For:** Blog posts, social media copy, email content, marketing messages

**Option A: Direct Brief Reference**
```json
{
  "systemPrompt": "You are a marketing content creator for RealtyFlow.",
  "brandBrief": "marketing-and-sales/realestateflow/NANO-BANANA-BRIEF.json",
  "contentType": "Instagram caption",
  "tone": "Direct, transparent, expert",
  "audience": "Solo brokers in Mumbai/Pune"
}
```

**Option B: Embedded Brief Data**
```json
{
  "brand": {
    "name": "RealtyFlow",
    "positioning": "Direct broker. Trustworthy. Established.",
    "colors": {
      "primary": "#0F3A66",
      "secondary": "#1E40AF",
      "accent": "#22C55E"
    },
    "tone": ["Direct", "Transparent", "Expert", "Approachable"],
    "messages": [
      "Direct broker. Trustworthy. Established.",
      "20+ years of expertise. Personal attention. No middlemen."
    ]
  }
}
```

**Step 1: Copy Relevant Brief Sections**
From `NANO-BANANA-BRIEF.json`:
- `coreMessages`
- `targetAudience`
- `messaging`
- `designPrinciples`
- `trustSignals`

**Step 2: Include in Prompt**
```
Create [CONTENT TYPE] for RealtyFlow.

Brand Brief:
{
  "positioning": "Direct broker. Trustworthy. Established.",
  "tone": ["Direct", "Transparent", "Expert"],
  "audience": "Solo brokers in Mumbai, Pune, Thane",
  "key_messages": [
    "Direct broker. Trustworthy. Established.",
    "20+ years expertise. Personal attention. No middlemen."
  ],
  "hinglish_examples": [
    "Direct broker से बात करो। Sab kuch transparent।",
    "Apke dream property। Personal service। Expert guidance।"
  ]
}

[Your specific request for content type]
```

**Step 3: Validate Output**
- Matches brand positioning?
- Uses appropriate tone?
- Relevant for target audience?
- Culturally appropriate (Hinglish)?

---

### Path 3: External Agencies/Contractors

**For:** When outsourcing design, video, or content creation

**What to Share:**
1. **NANO-BANANA-BRIEF.json** (complete brand data)
2. **NANO-BANANA-USAGE-GUIDE.md** (instructions)
3. **BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md** (detailed guidelines)
4. **design-tokens-authority.json** (technical specs)

**Format to Share:**
```
// As JSON file bundle
{
  "name": "RealtyFlow Authority on Budget v1.0",
  "files": {
    "brief": "NANO-BANANA-BRIEF.json",
    "guide": "NANO-BANANA-USAGE-GUIDE.md",
    "fullGuidelines": "BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md",
    "tokens": "design-tokens-authority.json"
  },
  "contact": "cloudberryitsolutions@gmail.com",
  "version": "1.0",
  "lastUpdated": "2026-05-04"
}
```

**Contract Language:**
```
"All deliverables must comply with RealtyFlow brand guidelines 
as specified in NANO-BANANA-BRIEF.json and BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md. 
Color palette: Navy (#0F3A66), Blue (#1E40AF), Green (#22C55E) only. 
Typography: Poppins (headings) + Inter (body). 
Design principle: 60% whitespace minimum. 
Approval required before final delivery."
```

---

### Path 4: Website/App Development

**For:** Frontend implementation, design system setup

**Step 1: Copy CSS**
```html
<link rel="stylesheet" href="brand-styles-authority.css">
```

**Step 2: Use Design Tokens**
```javascript
// From design-tokens-authority.json
const colors = {
  primary: "#0F3A66",    // Navy
  secondary: "#1E40AF",  // Blue
  accent: "#22C55E"      // Green
};

const fonts = {
  headings: "Poppins",
  body: "Inter"
};
```

**Step 3: Apply CSS Variables**
```css
:root {
  --color-primary: #0F3A66;
  --color-secondary: #1E40AF;
  --color-accent: #22C55E;
  --font-headings: "Poppins", sans-serif;
  --font-body: "Inter", sans-serif;
}

h1 { color: var(--color-primary); font-family: var(--font-headings); }
p { color: var(--color-secondary); font-family: var(--font-body); }
```

**Step 4: Validate Against Design System**
- All colors from palette?
- Correct fonts used?
- 60% whitespace on layouts?
- Responsive breakpoints implemented?

---

## 📋 Integration Checklist

### For Nano Banana Creative Generation
- [ ] Reference NANO-BANANA-BRIEF.json in prompt
- [ ] Include all 3 colors (hex codes)
- [ ] Specify fonts: Poppins + Inter
- [ ] Mention 60% whitespace requirement
- [ ] Include target audience (solo brokers)
- [ ] Specify dimensions from creativeDimensions
- [ ] Include tone/messaging from brief
- [ ] Check conformanceChecklist after generation

### For Agent/Content Generation
- [ ] Extract relevant sections from NANO-BANANA-BRIEF.json
- [ ] Include in system prompt or context
- [ ] Specify brand positioning and tone
- [ ] Include key messages and Hinglish examples
- [ ] Validate output matches brand voice
- [ ] Check cultural appropriateness

### For Development/Implementation
- [ ] Copy CSS file to project
- [ ] Import design tokens into framework
- [ ] Configure CSS variables from tokens
- [ ] Apply responsive breakpoints
- [ ] Test color contrast and accessibility
- [ ] Validate against brand guidelines

### For External Agencies
- [ ] Share all 4 core files (JSON + guides)
- [ ] Include compliance requirements in contract
- [ ] Specify approval workflow
- [ ] Provide reference examples (direction1-solo-brokers.html)
- [ ] Set up revision process with validation checklist
- [ ] Document delivery format requirements

---

## 🔄 Complete Integration Flow

```
BRAND SPECIFICATION
↓
NANO-BANANA-BRIEF.json (machine-readable)
NANO-BANANA-USAGE-GUIDE.md (instructions)
BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md (full guidelines)
↓
DISTRIBUTION
├─ Nano Banana Skill → Image generation
├─ Claude Agents → Content generation
├─ External Agencies → Design/video/content
├─ Development Team → CSS/tokens/implementation
└─ Marketing Team → Messaging/copy/strategy
↓
CREATIVE ASSETS
├─ Instagram posts
├─ Email templates
├─ Hero images
├─ Logos
├─ Social banners
├─ Blog posts
├─ Ads
└─ Website components
↓
VALIDATION
├─ Colors: Navy/Blue/Green only? ✓
├─ Fonts: Poppins + Inter? ✓
├─ Whitespace: 60% minimum? ✓
├─ Tone: Direct, transparent? ✓
├─ Message: Clear positioning? ✓
└─ Approval: Ready to publish? ✓
```

---

## 📚 File Reference Quick Guide

| Need | Use This File |
|------|---------------|
| **AI image generation prompts** | NANO-BANANA-BRIEF.json |
| **How to use brief for creatives** | NANO-BANANA-USAGE-GUIDE.md |
| **Complete brand guidelines** | BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md |
| **Developer tokens & CSS** | design-tokens-authority.json + brand-styles-authority.css |
| **4-week implementation timeline** | IMPLEMENTATION-GUIDE.md |
| **Visual brand examples** | direction1-solo-brokers.html |
| **Share with external teams** | All 4 core files above |

---

## 🎯 Quick Integration Examples

### Example 1: Generate Instagram Post
```
File Reference: NANO-BANANA-BRIEF.json
Tool: /nano-banana
Command: /nano-banana create-image --brief NANO-BANANA-BRIEF.json --prompt "[prompt from NANO-BANANA-USAGE-GUIDE.md]"
Validate: conformanceChecklist from brief
```

### Example 2: Generate Email Template
```
File Reference: NANO-BANANA-BRIEF.json (colors, fonts, creativeDimensions)
Tool: /nano-banana or /landing-page-builder
Input: Dimensions 1200×628 + colors + messaging from brief
Validate: Against brand colors and typography
```

### Example 3: Create Blog Post
```
File Reference: NANO-BANANA-BRIEF.json (messaging, tone, audience)
Tool: /seo-content-writer or Claude agents
Input: Tone from coreMessages + keywords from target audience
Validate: Against brand voice and Hinglish guidelines
```

### Example 4: Implement on Website
```
File Reference: design-tokens-authority.json + brand-styles-authority.css
Tool: Integrate into HTML/CSS/JavaScript project
Steps:
  1. Link CSS file
  2. Import design tokens
  3. Use CSS variables
  4. Apply 60% whitespace principle
Validate: Browser test + accessibility check
```

---

## 💡 Pro Tips for Integration

1. **Always start with NANO-BANANA-BRIEF.json**
   - It's the source of truth for all creatives
   - Machine-readable and shareable
   - Includes validation checklist

2. **Keep brand files in version control**
   ```
   marketing-and-sales/realestateflow/
   - NANO-BANANA-BRIEF.json (v1.0)
   - NANO-BANANA-USAGE-GUIDE.md (v1.0)
   - BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md (v1.0)
   ```

3. **Update brief when brand evolves**
   - New colors? Update all 5 files
   - New messaging? Update brief
   - New guidelines? Version everything (v1.1, v2.0)

4. **Create team onboarding doc**
   - Reference these 4 core files
   - Link to NANO-BANANA-USAGE-GUIDE.md
   - Show examples from direction1-solo-brokers.html

5. **Monitor conformance**
   - Use conformanceChecklist for QA
   - Every asset should pass all 9 checks
   - Maintain consistency over time

---

## ✅ Validation Before Publishing

Every creative asset should pass:

```
CONFORMANCE CHECKLIST
├─ Colors: Navy (#0F3A66), Blue (#1E40AF), Green (#22C55E), neutrals only?
├─ Fonts: Poppins (headings), Inter (body)?
├─ Whitespace: 60% minimum?
├─ Messaging: Clear, direct, no jargon?
├─ Trust: Looks established and professional?
├─ Tone: Direct, transparent, expert, approachable?
├─ Audience: Relevant for solo brokers?
├─ Cultural: Appropriate for India market?
└─ Quality: High resolution and clean?

ALL CHECKS PASSED? → READY TO PUBLISH ✓
```

---

## 📞 Quick Reference Links

- **Brand Brief:** marketing-and-sales/realestateflow/NANO-BANANA-BRIEF.json
- **Usage Guide:** marketing-and-sales/realestateflow/NANO-BANANA-USAGE-GUIDE.md
- **Full Guidelines:** marketing-and-sales/realestateflow/BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md
- **Design Tokens:** marketing-and-sales/realestateflow/design-tokens-authority.json
- **CSS Ready:** marketing-and-sales/realestateflow/brand-styles-authority.css
- **Visual Examples:** marketing-and-sales/realestateflow/direction1-solo-brokers.html

---

**RealtyFlow Brand Integration Guide**  
**Version 1.0 | May 4, 2026**

*Use these files to ensure consistent, brand-aligned creatives across all channels and teams.*
