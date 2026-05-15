# Broker Segment Design Specifications
## Ready-to-Use Color Palettes & Design Styles (Mumbai & Pune)

**Date:** May 2026  
**Target:** Design/Marketing teams implementing broker-specific branding  
**Usage:** Copy color codes directly into design tools; use as reference for templates  

---

## Quick Reference: Color Palettes

### Palette 1: "Authority on Budget" (Solo Brokers)
**Best for:** 1-person brokers, luxury properties, high-touch service

```css
/* Color Variables */
--primary: #0F3A66;        /* Deep Navy - Headlines, CTAs */
--primary-dark: #082642;   /* Darker navy - Hover states */
--primary-light: #1e3a52;  /* Lighter navy - Backgrounds */

--secondary: #1E40AF;      /* Professional Blue - Interactive elements */
--secondary-light: #3b5bdb; /* Lighter blue - Hover, accents */

--accent: #22C55E;         /* Success Green - Deal closed, achievements */
--accent-dark: #16a34a;    /* Darker green - Hover states */

--background: #F8FAFC;     /* Light gray - Page backgrounds */
--surface: #FFFFFF;        /* Pure white - Cards, content areas */
--border: #E2E8F0;         /* Light border - Card borders, dividers */

--text-primary: #111827;   /* Near-black - Main text */
--text-secondary: #6B7280; /* Medium gray - Secondary text, labels */
--text-tertiary: #9CA3AF;  /* Light gray - Disabled, placeholder text */

--success: #22C55E;
--warning: #F59E0B;        /* Amber - Alerts, cautions */
--error: #EF4444;          /* Red - Errors, urgent action */
--info: #3B82F6;           /* Blue - Informational messages */
```

**Hex Color Reference:**
| Element | Color | Hex |
|---------|-------|-----|
| Buttons, Headlines | Navy | #0F3A66 |
| Links, Secondary CTA | Blue | #1E40AF |
| Success/Deal Closed | Green | #22C55E |
| Page Background | Light Gray | #F8FAFC |
| Cards/Content | White | #FFFFFF |
| Body Text | Dark | #111827 |
| Secondary Text | Gray | #6B7280 |

**Typography:**
```css
--font-heading: 'Poppins', sans-serif;
--font-body: 'Inter', sans-serif;

--size-h1: 40px; --weight-h1: 700;
--size-h2: 28px; --weight-h2: 700;
--size-h3: 20px; --weight-h3: 600;
--size-body: 16px; --weight-body: 400;
--size-small: 14px; --weight-small: 400;
```

**Application Examples:**

Hero Section:
```html
<section style="background: white; padding: 60px 20px;">
  <h1 style="color: #0F3A66; font-size: 40px; font-weight: 700; 
             font-family: 'Poppins', sans-serif; margin-bottom: 16px;">
    Mumbai's Most Trusted Real Estate Broker
  </h1>
  <p style="color: #6B7280; font-size: 18px; margin-bottom: 32px;">
    20+ years of experience. 500+ properties sold.
  </p>
  <button style="background: #0F3A66; color: white; padding: 12px 32px;
                 border-radius: 6px; border: none; font-size: 16px;
                 font-weight: 600; cursor: pointer;">
    View My Properties
  </button>
</section>
```

Feature Cards:
```html
<div style="background: white; border: 1px solid #E2E8F0; 
            border-radius: 10px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
  <h3 style="color: #0F3A66; font-size: 20px; margin-bottom: 12px;">
    Direct Access
  </h3>
  <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">
    I personally manage every transaction. No middlemen, no delays.
  </p>
</div>
```

---

### Palette 2: "Growth & Personality" (Small Teams, 2-5 People)
**Best for:** Growing teams, tech-forward brokers, personality-driven brands

```css
/* Color Variables */
--primary: #2563EB;        /* Vibrant Blue - Primary CTA, headlines */
--primary-dark: #1e40af;   /* Darker blue - Hover states */
--primary-light: #3b82f6;  /* Lighter blue - Backgrounds */

--secondary: #7C3AED;      /* Purple - Unique identity, accents */
--secondary-light: #a855f7; /* Lighter purple - Hover, backgrounds */

--accent: #10B981;         /* Emerald Green - Success, growth signal */
--accent-dark: #059669;    /* Darker green - Hover states */

--background: #FFFFFF;     /* Pure white - Primary page background */
--surface: #F3F4F6;        /* Very light gray - Card backgrounds */
--border: #E5E7EB;         /* Light gray - Card borders */

--text-primary: #1F2937;   /* Dark gray - Main text */
--text-secondary: #6B7280; /* Medium gray - Secondary text */
--text-tertiary: #9CA3AF;  /* Light gray - Disabled, helper text */

--success: #10B981;
--warning: #F59E0B;        /* Amber - Alerts */
--error: #EF4444;          /* Red - Errors */
--info: #3B82F6;           /* Blue - Information */
```

**Hex Color Reference:**
| Element | Color | Hex |
|---------|-------|-----|
| Primary CTA, Headlines | Blue | #2563EB |
| Personality Accents | Purple | #7C3AED |
| Growth/Success | Green | #10B981 |
| Page Background | White | #FFFFFF |
| Cards/Content | Light Gray | #F3F4F6 |
| Body Text | Dark Gray | #1F2937 |
| Secondary Text | Gray | #6B7280 |

**Typography:**
```css
--font-heading: 'Poppins', sans-serif;
--font-accent: 'Space Grotesk', sans-serif; /* For personality */
--font-body: 'Inter', sans-serif;

--size-h1: 36px; --weight-h1: 700;
--size-h2: 28px; --weight-h2: 600;
--size-h3: 20px; --weight-h3: 600;
--size-body: 16px; --weight-body: 400;
--size-small: 14px; --weight-small: 400;
```

**Application Examples:**

Hero Section:
```html
<section style="background: linear-gradient(135deg, #FFFFFF 0%, #F3F4F6 100%); 
                padding: 80px 40px;">
  <h1 style="color: #2563EB; font-size: 36px; font-weight: 700;
             font-family: 'Poppins', sans-serif; margin-bottom: 16px;">
    Real Estate Team That Closes More Deals
  </h1>
  <p style="color: #6B7280; font-size: 18px; margin-bottom: 32px;">
    Our agents average 15% higher close rates than market.
  </p>
  <div style="display: flex; gap: 16px;">
    <button style="background: #2563EB; color: white; padding: 14px 32px;
                   border-radius: 8px; border: none; font-size: 16px;
                   font-weight: 600; cursor: pointer;">
      Schedule Consultation
    </button>
    <button style="background: transparent; color: #2563EB; 
                   border: 2px solid #2563EB; padding: 12px 32px;
                   border-radius: 8px; font-size: 16px; font-weight: 600;
                   cursor: pointer;">
      Browse Properties
    </button>
  </div>
</section>
```

Team Cards:
```html
<div style="background: white; border: 1px solid #E5E7EB;
            border-radius: 12px; padding: 24px; text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
  <img src="agent-photo.jpg" style="width: 120px; height: 120px;
       border-radius: 50%; margin-bottom: 16px; object-fit: cover;">
  <h3 style="color: #2563EB; font-size: 20px; margin-bottom: 4px;
             font-family: 'Space Grotesk', sans-serif; font-weight: 600;">
    Priya Patel
  </h3>
  <p style="color: #7C3AED; font-size: 14px; margin-bottom: 12px;
            font-weight: 500;">Senior Agent</p>
  <p style="color: #6B7280; font-size: 16px; line-height: 1.6;
            margin-bottom: 16px;">
    15+ years experience. Specialty: Luxury residential. 30+ deals this year.
  </p>
  <a href="#" style="color: #10B981; font-weight: 600; text-decoration: none;">
    View Profile →
  </a>
</div>
```

Testimonial Section:
```html
<div style="background: #F3F4F6; border-left: 4px solid #7C3AED;
            padding: 24px; border-radius: 8px;">
  <p style="color: #1F2937; font-size: 16px; line-height: 1.8;
            margin-bottom: 16px; font-style: italic;">
    "Their team helped us find the perfect investment property. 
    Professional, responsive, and genuinely caring about our needs."
  </p>
  <p style="color: #2563EB; font-weight: 600; margin: 0;">
    — Rahul Sharma, Mumbai
  </p>
</div>
```

---

### Palette 3: "Corporate Excellence" (Medium Teams, 5-15+ People)
**Best for:** Established brokerages, premium market positioning, corporate authority

```css
/* Color Variables */
--primary: #003366;        /* Corporate Navy - Authority, headings */
--primary-dark: #001a33;   /* Very dark navy - Hover, active states */
--primary-light: #1a5c99;  /* Lighter navy - Accents, backgrounds */

--secondary: #D4A574;      /* Warm Gold - Luxury, prestige */
--secondary-light: #e6c9a8; /* Lighter gold - Backgrounds, accents */

--accent: #00A86B;         /* Premium Green - Established expertise */
--accent-dark: #008856;    /* Darker green - Hover states */

--background: #FAFAFA;     /* Off-white - Subtle, sophisticated */
--surface: #FFFFFF;        /* Pure white - Content areas */
--border: #D4D4D4;         /* Medium gray - Sophisticated borders */

--text-primary: #202020;   /* Near-black - Professional text */
--text-secondary: #555555; /* Sophisticated gray - Secondary text */
--text-tertiary: #888888;  /* Light gray - Disabled, helper text */

--success: #00A86B;
--warning: #D97706;        /* Amber - Alerts */
--error: #DC2626;          /* Red - Errors */
--info: #0284C7;           /* Blue - Information */
```

**Hex Color Reference:**
| Element | Color | Hex |
|---------|-------|-----|
| Headlines, Authority | Navy | #003366 |
| Luxury/Prestige Accents | Gold | #D4A574 |
| Expertise/Established | Green | #00A86B |
| Page Background | Off-white | #FAFAFA |
| Cards/Content | White | #FFFFFF |
| Body Text | Near-black | #202020 |
| Secondary Text | Gray | #555555 |

**Typography:**
```css
--font-heading: 'Playfair Display', serif; /* Sophisticated serif */
--font-accent: 'Garamond', serif; /* Elegant serif */
--font-body: 'Lato', sans-serif; /* Professional sans-serif */

--size-h1: 48px; --weight-h1: 700;
--size-h2: 36px; --weight-h2: 700;
--size-h3: 24px; --weight-h3: 600;
--size-body: 16px; --weight-body: 400;
--size-small: 14px; --weight-small: 400;
```

**Application Examples:**

Header/Navigation:
```html
<header style="background: #003366; padding: 24px 40px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <h1 style="color: white; font-size: 24px; font-weight: 700;
              font-family: 'Playfair Display', serif; margin: 0;">
      Sharma Real Estate
    </h1>
    <nav style="display: flex; gap: 40px;">
      <a href="#" style="color: white; text-decoration: none; 
                        font-size: 16px; font-family: 'Lato', sans-serif;">
        Portfolio
      </a>
      <a href="#" style="color: white; text-decoration: none; 
                        font-size: 16px; font-family: 'Lato', sans-serif;">
        Team
      </a>
      <a href="#" style="color: #D4A574; text-decoration: none; 
                        font-size: 16px; font-family: 'Lato', sans-serif;
                        font-weight: 600;">
        Contact
      </a>
    </nav>
  </div>
</header>
```

Hero Section:
```html
<section style="background: #FAFAFA; padding: 100px 40px; text-align: center;">
  <h1 style="color: #003366; font-size: 48px; font-weight: 700;
             font-family: 'Playfair Display', serif;
             margin: 0 0 16px 0;">
    Market Leaders in Mumbai Real Estate
  </h1>
  <p style="color: #555555; font-size: 20px; margin-bottom: 8px;
            font-family: 'Lato', sans-serif;">
    Trusted by 5000+ clients | ₹5000Cr+ annual transaction volume
  </p>
  <p style="color: #D4A574; font-size: 16px; font-weight: 600;
            font-family: 'Lato', sans-serif; margin-bottom: 40px;">
    Est. 1995
  </p>
  <button style="background: #003366; color: white; padding: 16px 48px;
                border-radius: 4px; border: none; font-size: 18px;
                font-weight: 600; cursor: pointer; font-family: 'Lato', sans-serif;">
    Schedule Consultation
  </button>
</section>
```

Featured Project Card:
```html
<div style="background: white; border: 1px solid #D4D4D4;
            overflow: hidden; border-radius: 4px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);">
  <img src="project.jpg" style="width: 100%; height: 300px;
       object-fit: cover;">
  <div style="padding: 32px;">
    <div style="display: flex; justify-content: space-between;
               align-items: flex-start; margin-bottom: 16px;">
      <div>
        <p style="color: #D4A574; font-size: 14px; margin: 0 0 8px 0;
                 font-weight: 600; text-transform: uppercase;">
          Luxury Residential
        </p>
        <h3 style="color: #003366; font-size: 24px; margin: 0;
                  font-family: 'Playfair Display', serif; font-weight: 700;">
          Bandra Residency
        </h3>
      </div>
      <p style="color: #00A86B; font-size: 20px; margin: 0;
               font-weight: 700; font-family: 'Lato', sans-serif;">
        Sold
      </p>
    </div>
    <p style="color: #555555; font-size: 16px; line-height: 1.8;
             margin-bottom: 16px; font-family: 'Lato', sans-serif;">
      Premium 4-BHK in coveted Bandra location. ₹15.5 Crore. 
      Closed in 8 weeks.
    </p>
    <a href="#" style="color: #003366; font-weight: 600;
                     text-decoration: none; font-family: 'Lato', sans-serif;">
      View Case Study →
    </a>
  </div>
</div>
```

---

### Palette 4: "Pune Growth Energy" (Tech-Forward, Growth-Stage)
**Best for:** Pune brokers, younger demographic, startup positioning

```css
/* Color Variables */
--primary: #0047AB;        /* Bright Blue - Energy, action */
--primary-dark: #003080;   /* Dark blue - Hover states */
--primary-light: #1e5ba8;  /* Lighter blue - Backgrounds */

--secondary: #00A86B;      /* Bold Green - Growth, prosperity */
--secondary-light: #2dd4bf; /* Lighter green - Accents */

--accent: #FF6B35;         /* Energetic Orange - Sparingly used */
--accent-light: #ffb088;   /* Lighter orange - Accents only */

--background: #FFFFFF;     /* Pure white - Clean, minimal */
--surface: #F5F5F5;        /* Very light gray - Card backgrounds */
--border: #EBEBEB;         /* Light gray - Minimal borders */

--text-primary: #1A1A1A;   /* Very dark - Readable */
--text-secondary: #666666; /* Medium gray - Secondary text */
--text-tertiary: #999999;  /* Light gray - Disabled, placeholder */

--success: #00A86B;
--warning: #FF9800;        /* Orange - Cautions, alerts */
--error: #EF4444;          /* Red - Errors */
--info: #0047AB;           /* Blue - Information */
```

**Hex Color Reference:**
| Element | Color | Hex |
|---------|-------|-----|
| Primary CTA, Headlines | Bright Blue | #0047AB |
| Growth Signal | Bold Green | #00A86B |
| Energy/Urgency (Accent) | Orange | #FF6B35 |
| Page Background | White | #FFFFFF |
| Cards/Content | Light Gray | #F5F5F5 |
| Body Text | Dark | #1A1A1A |
| Secondary Text | Gray | #666666 |

**Typography:**
```css
--font-heading: 'Poppins', sans-serif;
--font-accent: 'Outfit', sans-serif; /* Bold geometric */
--font-body: 'Inter', sans-serif;

--size-h1: 44px; --weight-h1: 700;
--size-h2: 32px; --weight-h2: 700;
--size-h3: 24px; --weight-h3: 600;
--size-body: 16px; --weight-body: 500;
--size-small: 14px; --weight-small: 400;
```

**Application Examples:**

CTA Section:
```html
<section style="background: linear-gradient(135deg, #0047AB 0%, #00A86B 100%);
               padding: 60px 40px; text-align: center; border-radius: 12px;">
  <h2 style="color: white; font-size: 32px; font-weight: 700;
             font-family: 'Outfit', sans-serif; margin: 0 0 16px 0;">
    Ready to Scale Your Real Estate Business?
  </h2>
  <p style="color: rgba(255,255,255,0.95); font-size: 18px;
            margin-bottom: 32px; font-family: 'Inter', sans-serif;">
    Join 50+ Pune brokers who are closing more deals faster.
  </p>
  <button style="background: #FF6B35; color: white; padding: 14px 40px;
                border-radius: 8px; border: none; font-size: 16px;
                font-weight: 700; cursor: pointer;
                font-family: 'Outfit', sans-serif;">
    Schedule Free Consultation
  </button>
</section>
```

Stats Section:
```html
<div style="display: grid; grid-template-columns: 1fr 1fr 1fr;
           gap: 24px; padding: 40px;">
  <div style="background: #F5F5F5; padding: 24px; border-radius: 8px;
             text-align: center;">
    <p style="color: #0047AB; font-size: 36px; font-weight: 700;
             font-family: 'Outfit', sans-serif; margin: 0 0 8px 0;">
      50+
    </p>
    <p style="color: #666666; font-size: 14px;
             font-family: 'Inter', sans-serif; margin: 0;">
      Active Brokers
    </p>
  </div>
  <div style="background: #F5F5F5; padding: 24px; border-radius: 8px;
             text-align: center;">
    <p style="color: #00A86B; font-size: 36px; font-weight: 700;
             font-family: 'Outfit', sans-serif; margin: 0 0 8px 0;">
      ₹500Cr
    </p>
    <p style="color: #666666; font-size: 14px;
             font-family: 'Inter', sans-serif; margin: 0;">
      Transaction Volume
    </p>
  </div>
  <div style="background: #F5F5F5; padding: 24px; border-radius: 8px;
             text-align: center;">
    <p style="color: #FF6B35; font-size: 36px; font-weight: 700;
             font-family: 'Outfit', sans-serif; margin: 0 0 8px 0;">
      18
    </p>
    <p style="color: #666666; font-size: 14px;
             font-family: 'Inter', sans-serif; margin: 0;">
      Avg Deals/Year per Agent
    </p>
  </div>
</div>
```

---

## Design System Specifications by Segment

### Solo Broker Design Rules

**Layout:**
- Single-page or 2-page maximum
- Hero image covers 60-70% of screen
- Heavy whitespace (40% of page is empty space)
- No patterns, textures, or decorative elements

**Components:**
- Simple buttons (solid navy, hover = darker navy)
- No dropdown menus (confuses mobile users)
- Large text (16px minimum for body, 28px for headings)
- High contrast (dark on light, light on dark only)

**Images:**
- Minimum 1920x1080px resolution
- Professional photography only (no stock photos that look generic)
- Same color temperature throughout (warm or cool, not mixed)

**Mobile:**
- Single column layout
- Large tap targets (44px minimum)
- Hamburger menu if necessary, but keep nav simple

---

### Small Team Design Rules

**Layout:**
- 3-5 pages (Home, Properties, Team, About, Contact)
- Varied layouts (not all grids)
- Cards for team members (image + name + specialty)
- Hero image + supporting text layout

**Components:**
- Primary CTA (blue) + Secondary CTA (outline)
- Icons for key features (4-6 icons maximum)
- Testimonial carousel (5-10 testimonials)
- Property grid (9-12 properties per page)

**Images:**
- Team photos: High-quality headshots (professional photographer)
- Properties: Multiple angles, 2000x1500px minimum
- Lifestyle images: Show team in action, client handshake, office

**Mobile:**
- Responsive grid (2 columns on mobile, 3 on tablet)
- Large tap targets
- Simplified navigation
- Fast-loading images (compress without quality loss)

---

### Medium Team Design Rules

**Layout:**
- 6+ pages (Home, Portfolio, Market Insights, Team, About, Blog, Contact)
- Complex information architecture
- Multiple content types (text, images, videos, data)
- Clear hierarchy (main sections, subsections)

**Components:**
- Navigation bar (sticky on desktop, hamburger on mobile)
- Hero with video or animated background
- Feature cards with icons (6-9 cards)
- Testimonial section with rotation
- Project portfolio (grid of 12+ projects)
- Team bios with individual pages
- Blog/News section
- Footer with multiple sections

**Images:**
- Professional photography (hire photographer)
- High-resolution project photos
- Team member headshots + action photos
- Data visualizations for market insights

**Data Visualization:**
- Charts for market trends
- Statistics with icons/colors
- Before/after case studies
- Timeline for company history

---

## Component Templates

### Call-to-Action Button Styles

**Solo Broker (Navy):**
```html
<button style="background: #0F3A66; color: white; padding: 12px 32px;
               border-radius: 6px; border: none; font-size: 16px;
               font-weight: 600; cursor: pointer; font-family: 'Poppins';">
  View Properties
</button>
```

**Small Team (Primary Blue):**
```html
<button style="background: #2563EB; color: white; padding: 14px 32px;
               border-radius: 8px; border: none; font-size: 16px;
               font-weight: 600; cursor: pointer; font-family: 'Poppins';">
  Schedule Consultation
</button>

<!-- Secondary variant -->
<button style="background: transparent; color: #2563EB;
               border: 2px solid #2563EB; padding: 12px 32px;
               border-radius: 8px; font-size: 16px; font-weight: 600;
               cursor: pointer; font-family: 'Poppins';">
  Learn More
</button>
```

**Medium Team (Corporate Navy):**
```html
<button style="background: #003366; color: white; padding: 16px 40px;
               border-radius: 4px; border: none; font-size: 16px;
               font-weight: 600; cursor: pointer; font-family: 'Lato';">
  Schedule Consultation
</button>
```

---

### Form Input Styles

**All Segments:**
```html
<input type="text" placeholder="Your name" 
       style="width: 100%; padding: 12px 16px; border: 1px solid #E2E8F0;
              border-radius: 6px; font-size: 16px; font-family: 'Inter';
              transition: border-color 0.2s;">

<!-- Focused state -->
<input type="text" placeholder="Your name" 
       style="width: 100%; padding: 12px 16px; border: 2px solid #2563EB;
              border-radius: 6px; font-size: 16px; font-family: 'Inter';
              box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);">

<!-- Error state -->
<input type="text" placeholder="Your name" 
       style="width: 100%; padding: 12px 16px; border: 2px solid #EF4444;
              border-radius: 6px; font-size: 16px; font-family: 'Inter';">
<p style="color: #EF4444; font-size: 14px; margin-top: 4px;">
  This field is required
</p>
```

---

### Card Component

**Solo Broker Card:**
```html
<div style="background: white; border: 1px solid #E2E8F0;
            border-radius: 10px; padding: 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: transform 0.2s, box-shadow 0.2s;">
  <h3 style="color: #0F3A66; font-size: 20px; margin: 0 0 12px 0;">
    Feature Heading
  </h3>
  <p style="color: #6B7280; font-size: 16px; line-height: 1.6; margin: 0;">
    Feature description text.
  </p>
</div>

<!-- On hover: -->
<div style="background: white; border: 1px solid #E2E8F0;
            border-radius: 10px; padding: 24px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
            transform: translateY(-4px);">
  <!-- Same content -->
</div>
```

---

## Responsive Grid Specifications

### Solo Broker (Simple)
```css
/* Full width, single column */
@media (max-width: 768px) {
  .container { width: 100%; padding: 20px; }
  .hero-image { height: 300px; }
}
@media (min-width: 769px) {
  .container { max-width: 900px; margin: 0 auto; }
  .hero-image { height: 500px; }
}
```

### Small Team (2-3 Column)
```css
@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; gap: 16px; }
}
@media (min-width: 641px) and (max-width: 1024px) {
  .grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }
}
@media (min-width: 1025px) {
  .grid { grid-template-columns: repeat(3, 1fr); gap: 32px; }
}
```

### Medium Team (Flexible)
```css
@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; gap: 16px; }
  h1 { font-size: 32px; }
}
@media (min-width: 641px) and (max-width: 1024px) {
  .grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }
  h1 { font-size: 40px; }
}
@media (min-width: 1025px) {
  .grid { grid-template-columns: repeat(4, 1fr); gap: 32px; }
  h1 { font-size: 48px; }
}
```

---

## WhatsApp Branding Templates

### Solo Broker WhatsApp Profile

**Profile Picture:** Simple text logo on white background (navy color)

**Bio:**
```
🏠 Real Estate Professional
📍 South Mumbai | Luxury Properties
📞 Direct: 9876543210
20+ years | 500+ deals | RERA License #12345
```

**Status Messages (Daily):**

Format 1 (Property Listing):
```
🏡 NEW LISTING
📍 3 BHK, Bandra Residency
💰 ₹5.2 Crore
📅 Ready to occupy

View details →
```

Format 2 (Testimonial):
```
⭐⭐⭐⭐⭐
"Professional, knowledgeable, and trustworthy!"
— Rajesh Kumar, Client

Looking for that expertise? Call me.
```

### Small Team WhatsApp Group Bio

```
🏢 [Team Name] Real Estate
📍 South Mumbai | Bangalore | Pune
Team of 5 agents | Avg 18 deals/year per agent
RERA: [License Number]

For property inquiries, DM or call
Available 9 AM - 9 PM | 7 days a week
```

---

## Mobile App Branding (If Applicable)

**Color Usage:**
- Primary color button = CTA focus
- Secondary color = information
- Accent color = deals closed, achievements
- Background = white (light mode) or #1A1A1A (dark mode)

**Typography:**
- Headlines: 24-28px (bold)
- Body: 14-16px (regular)
- Small text: 12px (secondary)

**Spacing:**
- Padding around elements: 16px
- Gap between sections: 24px
- Touch targets: 44px minimum

---

## Print Collateral Specifications

### Business Card
```
Size: 90mm x 50mm
Color Mode: CMYK
Format: PDF or AI file
Front: Logo + Name + Title
Back: Phone + Email + Website + Address

Example:
┌─────────────────────────────┐
│ [Logo] Priya Patel          │
│        Real Estate Broker   │
│                             │
│ 📱 9876543210               │
│ 📧 priya@domain.com         │
│ 🌐 www.priyapatel.in        │
│ 📍 South Mumbai             │
└─────────────────────────────┘
```

### Brochure (A4 Folded to A5)
```
Front: Logo + Hero image + Headline
Inside Left: About + Team photos
Inside Right: Services + Testimonials
Back: Contact + QR code
```

### Property Flyer (A4)
```
Top 50%: High-res property image
Bottom 50%: 
- Address + Price (large)
- Beds/Baths/Sqft
- Key features (3-4 bullet points)
- Agent contact (prominent)
- QR code to virtual tour
```

---

## Color Accessibility Checklist

**For all palettes, verify:**
- [ ] Text contrast ratio ≥ 4.5:1 for body text (WCAG AA)
- [ ] Text contrast ratio ≥ 7:1 for headings (WCAG AAA)
- [ ] Color not the only indicator (use text + color)
- [ ] Colorblind-friendly (no red-only alerts)
- [ ] Works in grayscale (legible even in B&W)

**Test with:**
- WebAIM Contrast Checker (https://webaim.org/resources/contrastchecker/)
- Colorblind Simulator (https://www.color-blindness.com/coblis-color-blindness-simulator/)

---

## Usage Guidelines

### When to Use "Authority on Budget" (Solo)
✅ 1-person brokers
✅ Luxury/premium properties (₹1Cr+)
✅ High-touch service positioning
✅ Professional, trustworthy tone needed
❌ NOT for startup/tech-forward positioning
❌ NOT for multi-team operations

### When to Use "Growth & Personality" (Small)
✅ 2-15 person teams
✅ Growth-stage brokerages
✅ Want to stand out from corporate competitors
✅ Personal brand matters
❌ NOT for solo brokers (looks too big)
❌ NOT for ultra-premium luxury

### When to Use "Corporate Excellence" (Medium)
✅ 5-15+ person teams
✅ Established brokerages (3+ years)
✅ Premium/luxury market
✅ Need to signal authority and scale
❌ NOT for startups (looks too formal)
❌ NOT for solo brokers

### When to Use "Pune Growth Energy" (Growth)
✅ Pune-based brokers
✅ Tech-forward positioning
✅ Growth-stage companies (1-3 years)
✅ Younger demographic target
❌ NOT for Mumbai luxury market
❌ NOT for ultra-conservative brokers

---

## Quick Implementation Checklist

### Week 1: Choose Palette
- [ ] Identify which segment you're targeting
- [ ] Copy hex codes from above
- [ ] Create CSS variables in your design tool
- [ ] Save as reusable color swatches

### Week 2: Set Up Typography
- [ ] Download fonts (Poppins, Inter, Space Grotesk, Playfair Display, etc.)
- [ ] Define font sizes and weights
- [ ] Create heading/body/small text styles
- [ ] Test readability on mobile

### Week 3: Build Components
- [ ] Create button styles (primary + secondary)
- [ ] Design form inputs and states
- [ ] Create card templates
- [ ] Design hero section template

### Week 4: Implement Across Channels
- [ ] Website homepage
- [ ] WhatsApp profile
- [ ] Social media (Instagram/Facebook templates)
- [ ] Email signature

### Week 5: Test & Refine
- [ ] Check contrast ratios
- [ ] Test on mobile devices
- [ ] Gather feedback
- [ ] Refine and launch

---

## File Structure for Designers

```
design-system/
├── colors/
│   ├── palette-solo-broker.json
│   ├── palette-small-team.json
│   ├── palette-medium-team.json
│   └── palette-pune-growth.json
├── typography/
│   ├── font-stack-solo.css
│   ├── font-stack-small.css
│   ├── font-stack-medium.css
│   └── font-stack-pune.css
├── components/
│   ├── buttons.html
│   ├── cards.html
│   ├── forms.html
│   └── navigation.html
├── templates/
│   ├── homepage-solo.html
│   ├── homepage-small.html
│   ├── homepage-medium.html
│   └── whatsapp-profile.txt
└── guidelines/
    ├── accessibility.md
    ├── responsive-grid.md
    └── usage-guide.md
```

---

**Prepared by:** Deep Researcher  
**Date:** May 4, 2026  
**Status:** Ready for Designer/Marketer Implementation
