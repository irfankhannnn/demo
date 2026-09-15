# 🎨 RealtyFlow x Nano Banana Pro - Creative Generation Guide

**How to Pass Brand Details to Nano Banana Pro Skill for Consistent Creatives**

**Version:** 1.0  
**Date:** May 4, 2026  
**Audience:** Designers, Marketing Team, Content Creators

---

## 📋 Quick Reference

### Essential Brand Colors
```
Navy:      #0F3A66 (Primary - Headlines, CTAs, trust)
Blue:      #1E40AF (Secondary - Links, secondary actions)
Green:     #22C55E (Accent - Success, positive actions)
```

### Essential Fonts
```
Headings:  Poppins (Weights: 700, 800)
Body Text: Inter (Weights: 400, 500)
```

### Design Philosophy
```
Minimalist Professional
60% Whitespace Minimum
Direct, Transparent, Expert Tone
Trust-First Design
```

---

## 🚀 How to Use Nano Banana Brief

### Method 1: Copy-Paste Essential Parameters

**Best for quick creative generation:**

```json
{
  "colors": {
    "primary": "#0F3A66",
    "secondary": "#1E40AF", 
    "accent": "#22C55E"
  },
  "typography": {
    "headings": "Poppins",
    "body": "Inter"
  },
  "style": "Minimalist professional",
  "whitespace": "60%",
  "tone": "Direct, transparent, expert",
  "audience": "Solo real estate brokers in Mumbai/Pune"
}
```

### Method 2: Reference Full Brief

**File:** `NANO-BANANA-BRIEF.json`

Copy this file path or its entire contents into your Nano Banana prompt:
```
Reference: marketing-and-sales/realestateflow/NANO-BANANA-BRIEF.json
```

### Method 3: Use Prompt Templates

**From `NANO-BANANA-BRIEF.json` → `aiGenerationPromptTemplate`**

#### Instagram Post Template:
```
Create an Instagram post (1080x1080px) for RealtyFlow. 
Navy background with white text. 
Minimalist design with 60% whitespace. 
Message: 'Direct Broker. Transparent Process.' 
Use Poppins font. 
Include green accent. 
Hinglish-friendly tone.
Target: Solo real estate brokers in Mumbai/Pune
```

#### Logo Template:
```
Design a logo for RealtyFlow real estate brand. 
Colors: Navy (#0F3A66), Blue (#1E40AF), Green (#22C55E). 
Style: Minimalist, geometric. 
Concept: Represents 'direct broker' and 'flow'. 
Scale: Works favicon to billboard. 
Prefer: Outline style, no fills.
```

#### Hero Image Template:
```
Create 1920x1080px hero image for RealtyFlow website.
Navy background with Navy/Blue text in white.
Minimalist composition with 60% whitespace.
Central message: 'Your Trust, My Priority'
Include green accent element.
Feel: Professional, trustworthy, established.
```

---

## 🎯 Step-by-Step: Generating a Creative with Nano Banana

### Step 1: Choose Creative Type
- Instagram Post
- Hero Image
- Email Template
- Social Banner
- Logo / Icon
- Ad Creative
- Website Component

### Step 2: Select Relevant Brief Section
Open `NANO-BANANA-BRIEF.json` and copy:

**For Instagram Post:**
- `colors` section
- `creativity.instagram.square` dimensions (1080x1080)
- `messaging.hinglishExamples` (for copy)
- `designPrinciples` (60% whitespace, minimalist)

**For Logo:**
- `colors` section
- `coreMessages.positioning` (Direct. Trustworthy. Established.)
- `creativity.webAssets.favicon` dimensions
- `designPrinciples` (minimalist)

**For Email Template:**
- `typography` section
- `colors` section
- `messaging.headlines`
- `creativity.webAssets` dimensions

### Step 3: Build Your Nano Banana Prompt

**Template Formula:**
```
[CREATIVE TYPE REQUEST]

Colors to use: [HEX CODES FROM BRIEF]
Typography: [FONTS FROM BRIEF]
Dimensions: [FROM creativeDimensions]
Style: [FROM designPrinciples]
Message: [FROM messaging or coreMessages]
Tone: [FROM coreMessages.tone]
Audience: [FROM targetAudience]

Brand Brief Reference: NANO-BANANA-BRIEF.json
```

**Real Example - Instagram Post:**
```
Create an Instagram post (1080x1080px) for RealtyFlow real estate broker brand.

Colors: Navy (#0F3A66), Blue (#1E40AF), Green (#22C55E)
Typography: Poppins for headlines, Inter for body
Style: Minimalist, professional, 60% whitespace
Message: "Direct Broker. Transparent Process."
Tone: Direct, transparent, expert, approachable
Audience: Solo brokers in Mumbai, Pune, Thane

Design Principles:
- Minimalist approach (remove unnecessary elements)
- 60% whitespace minimum (breathing room)
- Trust-first design
- Direct communication (no jargon)

Include: Green accent element
Language: English (can use Hinglish)

Reference: NANO-BANANA-BRIEF.json - messaging.hinglishExamples
```

### Step 4: Execute with Nano Banana Skill

```
/nano-banana create-image --brief marketing-and-sales/realestateflow/NANO-BANANA-BRIEF.json --prompt "[YOUR DETAILED PROMPT ABOVE]"
```

### Step 5: Validate Against Checklist

From `NANO-BANANA-BRIEF.json` → `conformanceChecklist`:
- ✅ Only Navy, Blue, Green, and neutrals used?
- ✅ Poppins for headings, Inter for body?
- ✅ 60% minimum whitespace?
- ✅ Direct, clear messaging?
- ✅ Looks established and trustworthy?

---

## 📝 Complete Prompt Examples

### Example 1: Instagram Post with Call-to-Action

```
Create an Instagram feed post (1080×1080px) for RealtyFlow.

Brand: Real estate broker brand for solo agents
Target: Brokers in Mumbai, Pune, Thane
Market: India

Colors: Use Navy (#0F3A66) as background, white text
Accent: Green (#22C55E) for CTA button or accent line
Fonts: Poppins for headline (bold), Inter for body text

Content:
Headline: "Your Trust, My Priority"
Subheadline: "Direct Broker | 20+ Years | RERA Certified"
CTA: "Schedule Call" button in green

Style:
- Minimalist design (remove clutter)
- 60% whitespace (significant breathing room)
- Professional, trustworthy aesthetic
- Direct communication style

Tone: Direct, transparent, expert, approachable
Language: English (culturally relevant for Indian market)

Dimensions: 1080×1080px
Format: Ready for Instagram

Reference: marketing-and-sales/realestateflow/NANO-BANANA-BRIEF.json
```

### Example 2: Email Header Banner

```
Create an email header banner (1200×300px) for RealtyFlow real estate broker.

Colors: 
- Background: Navy (#0F3A66)
- Text: White
- Accent: Green (#22C55E)

Typography: 
- Headline: Poppins Bold 32px
- Subheadline: Inter Regular 16px

Content:
"Direct Broker. Transparent Process."
Subtext: "RERA Certified | 20+ Years Experience"

Design:
- Professional, minimalist layout
- Logo on left (space for logo)
- Text centered or right-aligned
- Green accent line or button
- 40px padding minimum

Dimensions: 1200×300px
Format: HTML-ready (or image)

Brand Guide: NANO-BANANA-BRIEF.json
```

### Example 3: Logo Concept

```
Design a logo for RealtyFlow, an India-focused real estate broker brand.

Brand Positioning: "Authority on Budget" - Professional minimalism for solo brokers

Colors (use all three):
- Navy: #0F3A66 (primary - trust, authority)
- Blue: #1E40AF (secondary - approachability)
- Green: #22C55E (accent - success, growth)

Style:
- Geometric, minimalist
- Outline-based (no solid fills preferred)
- Works at any scale (favicon to billboard)
- Modern, professional feel

Concept: Combine "RF" (initials) with "flow" metaphor
- Could represent: Direct path, flowing movement, access, growth

Target Audience: Solo real estate brokers
Market: India (Mumbai, Pune, Thane)

Avoid: 
- Complex details
- Trends (keep timeless)
- Too many colors
- Corporate clichés

Deliver as: 
- SVG format (scalable)
- Logo with text (logotype)
- Logo without text (logomark)

Reference: NANO-BANANA-BRIEF.json
```

---

## 🔄 Workflow: From Brief to Creative

```
1. BRIEF INPUT
   ↓
   Reference: NANO-BANANA-BRIEF.json
   ↓
2. EXTRACT PARAMETERS
   Colors: #0F3A66, #1E40AF, #22C55E
   Fonts: Poppins, Inter
   Style: Minimalist, 60% whitespace
   Tone: Direct, transparent
   ↓
3. BUILD PROMPT
   Creative type + dimensions + parameters + messaging
   ↓
4. EXECUTE NANO BANANA
   /nano-banana with detailed prompt
   ↓
5. VALIDATE
   Check conformanceChecklist
   - Colors correct?
   - Fonts correct?
   - Whitespace adequate?
   - Message aligned?
   - Professional & trustworthy?
   ↓
6. OUTPUT
   Image file ready for use
   Naming: realtyflow-{type}-{number}.{ext}
```

---

## 📚 File Organization

```
marketing-and-sales/realestateflow/
├── NANO-BANANA-BRIEF.json              ← Main brand data
├── NANO-BANANA-USAGE-GUIDE.md          ← This file
├── BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md ← Full guidelines
├── design-tokens-authority.json        ← Design tokens
└── [creatives folder - to be created]
    ├── instagram-posts/
    ├── logos/
    ├── email-templates/
    ├── social-banners/
    └── hero-images/
```

---

## 🎨 For Different Team Roles

### Designers
1. Open `NANO-BANANA-BRIEF.json`
2. Copy `colors`, `typography`, `designPrinciples`
3. Use in your creative briefs
4. Reference `creativeDimensions` for exact sizes
5. Validate against `conformanceChecklist`

### Content Creators
1. Use `messaging.keyMessages` and `hinglishExamples`
2. Reference `coreMessages.tone` for voice
3. Include in Nano Banana prompts
4. Specify dimensions from `creativeDimensions`

### Developers
1. Use `colors` section for CSS variables
2. Reference `typography` for font implementation
3. Copy `layoutGuidelines` for responsive design
4. Check `creativeAssets.templates` for template specs

### Marketing Team
1. Review `targetAudience` for messaging alignment
2. Use `messaging` and `hinglishExamples` for copy
3. Reference `coreMessages` for positioning
4. Share `NANO-BANANA-BRIEF.json` with external agencies

---

## ✅ Validation Checklist

Before submitting creative to client/publishing:

- [ ] **Colors:** Only uses Navy, Blue, Green, and neutrals?
- [ ] **Fonts:** Poppins for headings, Inter for body?
- [ ] **Whitespace:** 60% minimum breathing room?
- [ ] **Message:** Clear, direct, no jargon?
- [ ] **Trust:** Looks established and professional?
- [ ] **Tone:** Matches brand voice (direct, transparent)?
- [ ] **Audience:** Relevant for solo real estate brokers?
- [ ] **Cultural:** Appropriate for Indian market?
- [ ] **Dimensions:** Correct size for intended use?
- [ ] **Quality:** High resolution, clean design?

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| **NANO-BANANA-BRIEF.json** | Complete brand data in JSON format |
| **BRAND-IDENTITY-AUTHORITY-ON-BUDGET.md** | Full brand guidelines (19 sections) |
| **design-tokens-authority.json** | Design tokens for developers |
| **brand-styles-authority.css** | Production CSS (copy-paste ready) |
| **IMPLEMENTATION-GUIDE.md** | 4-week rollout guide |

---

## 📞 Quick Reference: Key Parameters

### For Every Creative
```
colors: ["#0F3A66", "#1E40AF", "#22C55E"]
fonts: ["Poppins", "Inter"]
style: "Minimalist professional"
whitespace: "60% minimum"
tone: "Direct, transparent, expert"
audience: "Solo brokers in India"
market: "Mumbai, Pune, Thane"
```

### Message Template
```
"Direct Broker. Trustworthy. Established."
(or variations from messaging.keyMessages)
```

### Design Principles
```
1. 60% Whitespace Minimum
2. Minimalist Approach
3. Trust-First Design
4. Direct Communication
```

---

## 🎯 Common Use Cases

### Use Case 1: Generate 5 Instagram Post Concepts
```
Prompt: "Generate 5 different Instagram post designs for RealtyFlow 
using NANO-BANANA-BRIEF.json. Each 1080×1080px. 
Different messages from messaging.keyMessages. 
All using Navy/Blue/Green only."
```

### Use Case 2: Create Email Campaign Templates
```
Prompt: "Create 3 email header templates for RealtyFlow 
newsletter campaign. 1200×300px. 
Messages: [list from messaging.keyMessages]. 
Colors: Navy background, white text, green accents. 
Fonts: Poppins + Inter. Reference NANO-BANANA-BRIEF.json"
```

### Use Case 3: Design Hero Section Images
```
Prompt: "Design 3 hero images for RealtyFlow website 
(1920×1080px each). Different key messages. 
Minimalist layout with 60% whitespace. 
Navy/Blue text on Navy background. 
Green accent elements. Use NANO-BANANA-BRIEF.json"
```

---

## 💡 Pro Tips

1. **Always include the hex codes** — Don't say "blue", use "#1E40AF"
2. **Always mention whitespace** — "60% minimum whitespace" is non-negotiable
3. **Always specify font names** — "Poppins" and "Inter", not generic sans-serif
4. **Always reference dimensions** — From `creativeDimensions` in the brief
5. **Always include tone** — From `coreMessages.tone`
6. **Always validate** — Use `conformanceChecklist` before finalizing
7. **Always link to brief** — "Reference: NANO-BANANA-BRIEF.json"

---

## 📌 Remember

**The NANO-BANANA-BRIEF.json file is your single source of truth for brand consistency.**

Every creative should reference it. Every prompt should include parameters from it. Every output should validate against its checklist.

---

**RealtyFlow × Nano Banana Pro**  
**Consistent Brand Creative Generation Guide**  
**Version 1.0 | May 4, 2026**

*Follow this guide for professional, brand-aligned creatives every time.*
