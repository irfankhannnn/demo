# Image Generation Guide

Generate ad banners, social graphics, and marketing visuals using Higgsfield MCP and nano-banana-pro skill.

---

## Tools Available

| Tool | Model | Best For | Resolution |
|------|-------|----------|------------|
| Higgsfield MCP | Nano Banana Pro (Gemini 3 Pro Image) | Photorealistic ads, product mockups | Up to 4K |
| Higgsfield MCP | GPT Image 2 | Illustrated graphics, infographics | 1024-4096px |
| Higgsfield MCP | FLUX | Artistic, stylized visuals | Up to 2K |
| nano-banana-pro skill | Gemini 3 Pro Image | Direct Gemini API access | Up to 4K |

**Recommendation:** Use Higgsfield MCP (Nano Banana Pro) for all ad creatives — best quality for Indian real estate context.

---

## Brand Colors to Always Reference

```
Primary Blue:    #2563EB  — main CTA color, dominant in all ads
Emerald Green:   #10B981  — success states, growth metrics
Amber:           #F59E0B  — urgency, limited offer, price
Dark:            #1E293B  — text on light backgrounds
Gradient:        linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)
```

---

## Format Reference

| Platform | Dimensions | Use Case |
|----------|-----------|---------|
| Facebook Feed Ad | 1200×628 | Primary Facebook ad |
| Facebook Story | 1080×1920 | Story ad |
| Instagram Post | 1080×1080 | Feed post |
| Instagram Story/Reel | 1080×1920 | Reel cover, story ad |
| LinkedIn Feed | 1200×627 | LinkedIn ad |
| YouTube Thumbnail | 1280×720 | Video thumbnail |

---

## Example 1: Facebook Ad Banner (Agency Owner Persona)

**Prompt to Claude:**
```
Read .brand/brand-kit.md and .brand/positioning.md.

Use Higgsfield (Nano Banana Pro) to generate a Facebook ad banner (1200x628px) with:
- Background: Dark gradient (#1E293B to #2563EB)
- Main visual: Indian male real estate professional (35-45 years), 
  confident expression, looking at a laptop/phone showing a clean dashboard
- Setting: Modern Mumbai office, subtle city skyline in background
- Overlay text area on the right side (leave clean space for text)
- RealtyFlow logo placement: top-left corner
- Style: Modern SaaS feel, professional, Indian business context
- Lighting: Warm, natural, not stock-photo looking

Save to: marketing/assets/images/fb-ad-banner-agency-owner-01.png
```

**Then generate copy:**
```
Use ad-creative skill to write 3 variants of Facebook ad copy for this banner.
Target: Agency owners ("Rajesh Bhai" persona — Mumbai agency, 5-25 agents)
Pain point: "Can't track which agent is following up which lead"
Campaign theme: "Your Team, Your Rules"
Hinglish tone. Each variant: 1 headline (max 40 chars) + 1 body (max 125 chars) + 1 CTA.

Save to: marketing/posts/facebook/fb-ad-agency-owner-01.md
```

---

## Example 2: Instagram Post (Sales Manager Persona)

**Prompt to Claude:**
```
Read .brand/brand-kit.md.

Use Higgsfield (Nano Banana Pro) to generate an Instagram post image (1080x1080px):
- Style: Infographic/stat card with dark background (#1E293B)
- Primary visual: Split screen — left: messy WhatsApp chats / right: clean CRM dashboard
- Color accent: Emerald green (#10B981) for the "after" side
- Bold stat overlay: "3x more deals closed" in Inter Bold white
- Bottom: "RealtyFlow — Ek System Jahan Sab Dikhta Ho"
- Modern, clean, mobile-first design
- No stock photo faces — use UI mockup style

Save to: marketing/assets/images/ig-post-before-after-01.png
```

**Caption:**
```
Use social-content skill to write an Instagram caption for this before/after post.
Target: Sales Managers (Priya Madam persona — Pune/Bangalore, manages 5-15 agents)
Theme: Manual reporting pain → one-click reports
Tone: Hinglish, relatable, peer-to-peer
Include: 15-20 relevant hashtags

Save to: marketing/posts/instagram/ig-post-before-after-01.md
```

---

## Example 3: Batch — 7 Instagram Posts for 1 Week

**Single prompt for full week:**
```
Read .brand/brand-kit.md and .brand/positioning.md.

Generate 7 Instagram post images (1080x1080px each) using Higgsfield (Nano Banana Pro) 
for a Monday-Sunday content calendar targeting Indian real estate agents.

Day 1 (Mon): Pain point — Excel/WhatsApp chaos. Visual: chaotic desk with 
             multiple screens, warm colors
Day 2 (Tue): Feature highlight — Pipeline dashboard. Visual: clean CRM UI 
             on phone, Indian professional
Day 3 (Wed): Customer story format. Visual: confident agent, Mumbai property 
             background
Day 4 (Thu): Educational tip — "5 follow-up mistakes". Visual: numbered list 
             card, blue theme
Day 5 (Fri): Behind-the-scenes / team culture. Visual: small team in modern office
Day 6 (Sat): Weekend motivation. Visual: agent closing deal, celebratory
Day 7 (Sun): Product demo teaser. Visual: phone showing CRM app, clean UI

Use RealtyFlow brand colors throughout. Consistent style, no stock photo faces.
Save all to: marketing/assets/images/week-01/ with names day-1.png through day-7.png
```

---

## Example 4: Ad Creative Variants (A/B Testing)

```
Read .brand/positioning.md.

Use Higgsfield to generate 3 variants of the same Facebook ad (1200x628px) 
for A/B testing. All target agency owners, same pain point (lead visibility), 
but different visual angles:

Variant A: Person-focused — Indian agent at desk, looking frustrated at phone
Variant B: Product-focused — Clean RealtyFlow dashboard on screen, no person
Variant C: Metaphor — Organized binder/filing system vs. messy WhatsApp screenshots

Keep branding consistent: #2563EB dominant color, RealtyFlow logo top-left.
Save to:
- marketing/assets/images/ab-test-visibility/variant-a.png
- marketing/assets/images/ab-test-visibility/variant-b.png
- marketing/assets/images/ab-test-visibility/variant-c.png
```

---

## Example 5: Using nano-banana-pro Skill Directly

The nano-banana-pro skill uses the Gemini API directly (requires `GEMINI_API_KEY`).

```
/nano-banana-pro

Generate a 1080x1080 image for RealtyFlow Instagram:
- Subject: Indian real estate agent checking phone with smile
- Style: Bright, modern, professional
- Color palette: Blue (#2563EB) accents, clean white background
- Text overlay: "Leads Track Ho Rahe Hain ✓" in Inter Bold
- Aspect ratio: 1:1
```

---

## Prompt Engineering Tips

**For photorealistic ads (people):**
- Always specify "Indian professional" or "South Asian" for accurate representation
- Add city context: "Mumbai", "Pune office", "DLF Cyber City Gurugram"
- Specify age range: "35-45 year old male" or "28-35 year old female"
- Avoid: "businessman", "executive" — too generic

**For UI mockups:**
- Ask for "clean SaaS dashboard UI", "mobile CRM interface"
- Specify "RealtyFlow branded in #2563EB blue"
- Request "screenshot-style" for believable product visuals

**For consistency across a campaign:**
- Reference previous images: "same style as the image I just generated"
- Specify: "same lighting, same color palette as variant A"
- Use same prompt prefix for all images in a series

---

## Saving and Organizing

Always save generated images with descriptive names:
```
marketing/assets/images/
├── fb-ad-[audience]-[variant]-[date].png
├── ig-post-[theme]-[number].png
├── ab-test-[campaign]/
│   ├── variant-a.png
│   ├── variant-b.png
│   └── variant-c.png
└── week-[XX]/
    ├── day-1.png
    └── day-7.png
```
