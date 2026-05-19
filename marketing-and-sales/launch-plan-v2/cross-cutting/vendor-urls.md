# Vendor URLs

One-stop reference for every external vendor used in the RealEstateFlow launch — signup URLs, dashboard URLs, support contacts, monthly cost, and which task file references it.

---

## Cloud / Infrastructure

| Vendor | Signup | Dashboard | Cost (M1) | Used by |
|---|---|---|---|---|
| AWS | https://aws.amazon.com/console | https://ap-south-1.console.aws.amazon.com | ₹3-8k | All backend (P5, P9, P11, P12, P14, P18) |
| Cloudflare | https://dash.cloudflare.com/sign-up | https://dash.cloudflare.com | Free + ₹0 paid plan | DNS (P3, P18) |
| Netlify | https://app.netlify.com/signup | https://app.netlify.com | Free | LP hosting (P15) |
| Sentry | https://sentry.io/signup | https://sentry.io | Free tier | Error tracking (P10, P13) |
| BetterStack | https://uptime.betterstack.com/users/sign-up | https://uptime.betterstack.com | Free 10 monitors | Status + uptime (Day 5) |

## Payments / Compliance

| Vendor | Signup | Dashboard | Cost | Used by |
|---|---|---|---|---|
| Razorpay | https://razorpay.com/register | https://dashboard.razorpay.com | ₹0 + 2% per txn | Payments + GST (P7, P11, P14) |
| Vakilsearch | https://vakilsearch.com | — | ₹15-40k one-time | Legal review (P1) |
| Termly | https://termly.io | https://app.termly.io | $10-15/mo | Legal fallback (P1) |
| hCaptcha | https://www.hcaptcha.com | https://dashboard.hcaptcha.com | Free 100k/mo | Spam protection (P9, P15) |

## Email & Comms

| Vendor | Signup | Dashboard | Cost | Used by |
|---|---|---|---|---|
| Google Workspace | https://workspace.google.com/business/signup | https://admin.google.com | ₹125/user/mo | Founder email (P3) |
| Brevo | https://onboarding.brevo.com/account/register | https://app.brevo.com | Free tier or ₹599/mo Lite | Transactional + drip (P3, P9, P11, P14) |
| Instantly | https://app.instantly.ai/auth/signup | https://app.instantly.ai | ₹3,500/mo Growth | Cold email + warm-up (P3, Day 17) |
| AiSensy | https://www.aisensy.com | https://app.aisensy.com | ₹2,500-5,000/mo + WhatsApp BSP fees | WhatsApp warm sequences (Day 9-13) |
| Crisp | https://crisp.chat/en/pricing | https://app.crisp.chat | Free 2 seats | Helpdesk (Day 5) |
| Cal.com | https://app.cal.com/auth/signup | https://app.cal.com | Free tier | Demo booking (Day 6, P6) |

## Analytics

| Vendor | Signup | Dashboard | Cost | Used by |
|---|---|---|---|---|
| PostHog | https://app.posthog.com/signup | https://app.posthog.com | Free 1M events/mo | Product analytics (P10) |
| GA4 | https://analytics.google.com | https://analytics.google.com | Free | Web + ad attribution (P10) |
| Meta Pixel | https://business.facebook.com | https://business.facebook.com | Free | Meta ad attribution (P10, M2) |
| LinkedIn Insight Tag | https://www.linkedin.com/campaignmanager | same | Free | LinkedIn ad attribution (P10, M2) |
| Hotjar | https://insights.hotjar.com/register | https://insights.hotjar.com | Free 35 sessions/day | Session replay (Day 22 CRO) |
| Glockapps | https://glockapps.com | same | $79/test | Inbox placement test (P3) |
| MXToolbox | https://mxtoolbox.com | same | Free | DNS verification (P3) |

## Media / Creative

| Vendor | Signup | Dashboard | Cost | Used by |
|---|---|---|---|---|
| Higgsfield (Nano-Banana-Pro) | https://higgsfield.ai | same | $19+/mo | Image gen (P8, P15, M2) |
| ElevenLabs | https://elevenlabs.io/sign-up | https://elevenlabs.io/app | $5+/mo | Voice-overs (Day 11+, M2 webinar) |
| Loom | https://loom.com/signup | https://loom.com | Free 25 videos | Demo videos (P5, P6, Day 6) |
| Canva | https://www.canva.com/sign-up | https://canva.com | Free + Pro ₹500/mo | Backup design (P6 banner, M2) |

## SEO & Outreach Tools

| Vendor | Signup | Dashboard | Cost | Used by |
|---|---|---|---|---|
| Google Search Console | https://search.google.com/search-console | same | Free | SEO submission (P16) |
| Bing Webmaster | https://www.bing.com/webmasters | same | Free | SEO submission (P16) |
| Brave Search Webmaster | https://search.brave.com/help/webmaster-tools | same | Free | SEO submission (P16) |
| ahrefs Webmaster Tools | https://ahrefs.com/awt | same | Free | Backlink monitoring (P16) |
| Firecrawl | https://www.firecrawl.dev | https://www.firecrawl.dev/dashboard | $19+/mo | Lead scraping (Day 8, Day 17) |

## Internal / Custom

| Vendor | Notes |
|---|---|
| OpenClaw | Internal — runs on EC2 (`openclaw-automation/super-core/`); never named publicly |
| 1Password / Bitwarden | Founder secrets manager (recommended) |
| GitHub | Source control + Actions for CI/CD |

---

## Total estimated M1 vendor cost

| Category | M1 cost (₹) |
|---|---|
| AWS | 3-8k |
| Razorpay | 0 + per-txn |
| Workspace + Brevo + Instantly | ~5k |
| AiSensy + Crisp + Cal.com | ~3-5k |
| PostHog + Sentry + others | 0 (free tiers) |
| Higgsfield + ElevenLabs | ~2k |
| Vakilsearch (one-time) | 15-40k |
| Glockapps test (one-time) | 7k |
| **Total M1 OPEX** | **~₹15-25k/mo + ₹25-50k one-time** |

---

## Onboarding owner table (for shared founder + future hire context)

| Vendor | Onboarded by | Date | Account email |
|---|---|---|---|
| AWS | Founder | YYYY-MM-DD | founder@... |
| Razorpay | Founder | YYYY-MM-DD | founder@... |
| Cloudflare | Founder | YYYY-MM-DD | founder@... |
| ... | | | |

(Append rows as accounts come online — useful for handover.)
