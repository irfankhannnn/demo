# Cookie Consent Banner Copy — RealEstateFlow

**Last updated:** 2026-06-11  
**Surfaces:** LP (`realestateflow.in`) — 4 toggles · CRM (`app.realestateflow.in`) — 2 toggles

---

## Landing Page Banner (4-toggle)

### Banner (first visit)

**Title (sr-only):** Cookie consent

**Body:**
We use cookies to power the site and remember your preferences. Analytics and marketing cookies help us improve and measure ads. Choose what you're comfortable with.

**Buttons:**
| Button | Style | Action |
|--------|-------|--------|
| Accept all | Primary (green) | Enable all categories |
| Reject non-essential | Secondary (outline) | Essential only |
| Customize | Tertiary (text link) | Open modal |

**Footer link:** [More about cookies](/legal/cookies)

---

### Customize Modal — LP (4 toggles)

**Modal title:** Cookie preferences

**Modal description:**
Choose which cookies RealEstateFlow can use. Essential cookies are required for the site to work and cannot be turned off.

| Toggle | State | Label | Description |
|--------|-------|-------|-------------|
| Essential | 🔒 Locked ON | **Essential** | Required for the site to work — login, security, and storing your preferences. |
| Functional | Default OFF | **Functional** | Remember your layout preferences and enable session recordings (Hotjar) to fix UX issues. |
| Analytics | Default OFF | **Analytics** | Help us measure site performance (PostHog, Google Analytics). No ads. Aggregated data only. |
| Marketing | Default OFF | **Marketing** | Measure ad performance (Meta Pixel, LinkedIn). Only used if you arrived from an ad. |

**Modal buttons:**
- **Save preferences** (primary)
- **Accept all** (secondary)
- **Cancel** (text) — closes modal without saving

---

## CRM Banner (2-toggle)

### Banner (first visit)

**Body:**
We use cookies for login and security. With your permission, we also measure product usage to improve the CRM — no ads, no retargeting.

**Buttons:** Accept all · Reject non-essential · Customize

---

### Customize Modal — CRM (2 toggles)

| Toggle | State | Label | Description |
|--------|-------|-------|-------------|
| Essential | 🔒 Locked ON | **Essential** | Required for login, security, and storing your preferences. |
| Analytics | Default OFF | **Analytics** | We measure product usage via PostHog to improve features — no ads, no retargeting. |

**Note:** No Marketing or Functional toggles in CRM — GA4, Meta Pixel, LinkedIn, and Hotjar are not loaded in the authenticated app.

---

## Hinglish Draft (M1+1 — not deployed M1)

**LP banner:**
Hum cookies use karte hain site chalane ke liye. Analytics aur marketing cookies humein behtar banane mein madad karte hain. Apni marzi se chuno.

**CRM banner:**
Login aur security ke liye cookies zaroori hain. Permission do toh hum product usage measure karte hain — koi ads nahi.

---

## Cookie Inventory Table

| Cookie / key | Provider | Purpose | Category | Retention | Third-party? | Domain |
|--------------|----------|---------|----------|-----------|--------------|--------|
| `auth_token` | RealEstateFlow | Session authentication | Essential | 7 days | No | app.realestateflow.in |
| `csrf_token` | RealEstateFlow | CSRF protection | Essential | Session | No | .realestateflow.in |
| `cookieConsent` | RealEstateFlow | Stores consent choices | Essential | 1 year | No | .realestateflow.in |
| `ph_phc_*` | PostHog | Analytics distinct ID | Analytics | 1 year | Yes (EU) | .realestateflow.in |
| `ph_*` | PostHog | Session analytics | Analytics | 1 year | No | .realestateflow.in |
| `_ga` | Google Analytics 4 | User distinction | Analytics | 2 years | Yes | .realestateflow.in |
| `_ga_*` | Google Analytics 4 | Session state | Analytics | 2 years | Yes | .realestateflow.in |
| `_gid` | Google Analytics 4 | User distinction | Analytics | 24 hours | Yes | .realestateflow.in |
| `_fbp` | Meta Pixel | Ad attribution | Marketing | 90 days | Yes | .realestateflow.in |
| `_fbc` | Meta Pixel | Facebook click ID | Marketing | 90 days | Yes | .realestateflow.in |
| `li_sugr` | LinkedIn | Ad conversion | Marketing | 90 days | Yes | .linkedin.com |
| `bcookie` | LinkedIn | Browser ID | Marketing | 1 year | Yes | .linkedin.com |
| `lidc` | LinkedIn | Routing | Marketing | 24 hours | Yes | .linkedin.com |
| `_hjSessionUser_*` | Hotjar | Session recording user | Functional | 1 year | Yes | .realestateflow.in |
| `_hjSession_*` | Hotjar | Session recording | Functional | 30 min | Yes | .realestateflow.in |
| `__hssc` | Hotjar | Session cookie | Functional | 30 min | Yes | .realestateflow.in |
| `__hssrc` | Hotjar | Session cookie | Functional | Session | Yes | .realestateflow.in |
| `__hstc` | Hotjar | Visitor tracking | Functional | 13 months | Yes | .realestateflow.in |
| `crisp-client/*` | Crisp | Live chat session | Functional | Session | Yes (EU) | .realestateflow.in |
| `__cf_bm` | Cloudflare | Bot management | Essential | 30 min | Yes | .realestateflow.in |
| `utm_*` (sessionStorage) | RealEstateFlow | Campaign attribution | Analytics | Session | No | app.realestateflow.in |
| `feature_first_use_*` | RealEstateFlow | First-use event flags | Functional | 1 year | No | app.realestateflow.in |

**LP loads:** Essential + (consent-gated) Functional, Analytics, Marketing  
**CRM loads:** Essential + (consent-gated) Analytics only

---

## Consent Storage Schema

```json
{
  "essential": true,
  "functional": false,
  "analytics": false,
  "marketing": false,
  "version": 1,
  "timestamp": "2026-06-11T10:00:00.000Z"
}
```

CRM omits `functional` and `marketing` keys (implicitly false).

---

## Accessibility Copy

- Banner `role="dialog"` with `aria-labelledby` and `aria-describedby`
- Toggle labels linked via `for`/`id`
- Focus trap in modal; Esc closes modal
- Screen reader announcement on consent saved: "Cookie preferences saved"

---

## Footer Link

**Label:** Cookie preferences  
**Action:** `window.openCookiePreferences()` — reopens customize modal
