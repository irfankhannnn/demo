# Asset Production Calendar

When each marketing/product asset gets produced, by whom, and where it lands.

---

## Pre-launch (T-21 → T-1)

| Day | Asset | Type | Owner | Skill / Tool | Output path |
|---|---|---|---|---|---|
| T-21 | DNS records | infra | 🧍 founder | Cloudflare | `pre-launch/03-deliverability/dns-records.md` |
| T-21 | Brevo + Instantly + Workspace | infra | 🧍 founder | manual signups | accounts active |
| T-19 | Legal MDs (ToS/Privacy/Refund/Cookies) | legal | 🤖 + 🧍 | `copywriting` + Vakilsearch | `pre-launch/01-legal/*.md` |
| T-17 | Pricing page copy | copy | 🤖 | `pricing-strategy` + `copywriting` | `pre-launch/02-pricing/page-copy.md` |
| T-15 | Wedge + 4 battle cards | strategy | 🤖 | `competitor-profiling` + `brand-strategy` | `pre-launch/04-positioning/*` |
| T-15 | 3 vs-pages drafts | copy | 🤖 | `competitor-alternatives` | `pre-launch/04-positioning/vs-pages/*.md` |
| T-14 | LinkedIn profile rewrite | brand | 🤖+🧍 | `copywriting` | `pre-launch/06-branding/linkedin-profile.md` |
| T-14 | Founder Post 1 | content | 🧍 publish | `social-content` | LinkedIn + archive snapshot |
| T-13 | Logo SVG + favicons + OG cards | media | 🤖 | `nano-banana-pro` | `realestateflow/assets/{logos,favicons,og}/` |
| T-12 | Founder Post 2 | content | 🧍 | `social-content` | LinkedIn |
| T-11 | LP rewrite drafts | copy + code | 🤖 | `landing-page` + `copywriting` | `creative/landing-pages/*/index.html` (12 LPs) |
| T-9 | Founder Post 3 | content | 🧍 | `social-content` | LinkedIn |
| T-9 | SEO + AEO master | tech-SEO | 🤖 | `schema-markup` + `ai-seo` | schema files + sitemap + llms.txt + 5 AEO drafts |
| T-8 | Cookie consent banner | code | 🤖 | `analytics-tracking` + `copywriting` | `_partials/cookie-banner.html` + `CookieConsentBanner.tsx` |
| T-8 | Analytics events spec + PRs | code | 🤖 | `analytics-tracking` + `codebase-analysis` | `analytics.ts` + `posthog-dashboard.md` + tests |
| T-7 | Demo seed script + cron + banner | code | 🤖+🧍 | `codebase-analysis` | `seed-demo-tenant.js` + `cron/reset-demo.yaml` |
| T-7 | Glockapps inbox-placement test | infra | 🧍 | Glockapps | warmup-progress.md row added |
| T-6 | 90-sec Loom demo | video | 🧍 record | Loom + ElevenLabs (optional) | LinkedIn Post 4 + LP embed |
| T-5 | Grievance flow PRs | code | 🤖 | `codebase-analysis` + `copywriting` | `routes/grievance.js` + `Grievance.tsx` + admin UI + SOP |
| T-5 | Founder LinkedIn Post 4 | content | 🧍 | `social-content` | LinkedIn (Loom embed) |
| T-4 | Seat-cap enforcement | code | 🤖 | `codebase-analysis` + `revops` | `subscriptionService.js` + paywall components |
| T-3 | GST invoicing | infra+code | 🤖+🧍 | `revops` | `pre-launch/07-gst/*` + Razorpay configured |
| T-3 | OpenClaw concierge | code | 🤖 | `revops` + `codebase-analysis` | `routes/billing.js` + concierge SOP + status page |
| T-3 | Subscription paywall + trial countdown | code | 🤖 | `paywall-upgrade-cro` + `email-sequence` | `PaywallModal.tsx` + Brevo trial emails + cron |
| T-3 | Founder LinkedIn Post 5 (launch teaser) | content | 🧍 | `social-content` | LinkedIn + WhatsApp broker groups |
| T-2 | LP deploy to Netlify | infra | 🧍 | Netlify CLI | `realestateflow.in` live |
| T-1 | Multi-tenancy + security audit | code | 🤖 | `security-audit` + `codebase-analysis` | `pre-launch/13-security/*` + Playwright pen-test |
| T-1 | All vendor smoke tests | infra | 🧍 | manual | `pre-execution-checklist.md` ticked |

---

## Week 1 (Day 1-7)

| Day | Asset | Type | Owner | Skill / Tool |
|---|---|---|---|---|
| Day 1 | Friction-walkthrough log + backlog | discovery | 🧍 founder | manual + `pr-review` for any code findings |
| Day 2 | Friction fixes shipped | code | 🧍 + 🤖 | `pr-review` |
| Day 3 | Razorpay live + ₹1 test invoice | infra | 🧍 | manual |
| Day 4 | Analytics final wire-up + Playwright assertion | code | 🤖 | `analytics-tracking` |
| Day 5 | Crisp + status page + uptime monitors | infra | 🧍 | manual |
| Day 6 | LP final deploy + welcome drip | infra+code | 🤖+🧍 | `email-sequence` |
| Day 7 | Final pre-launch audit + Day 7 re-scan | audit | 🤖 | `security-audit` |

---

## Week 2 (Day 8-14)

| Day | Asset | Type | Owner | Skill / Tool |
|---|---|---|---|---|
| Day 8 | 30-40 Mumbai prospects (enriched) | data | 🤖 | `firecrawl-agent` + `lead-enrichment` |
| Day 9 | Beta invite emails sent | outreach | 🤝 | `cold-email` |
| Day 10-11 | Onboarding calls (8-12) | sales | 🧍 | manual |
| Day 11 | AI-Employee transcript samples (real beta) | content | 🤖 + 🧍 | review |
| Day 12 | Critical fixes shipped | code | 🧍+🤖 | `pr-review` |
| Day 13 | Check-in WhatsApp drip | outreach | 🤝 | `whatsapp-outreach` |
| Day 14 | 5+ testimonials collected | content | 🤝 | manual |

---

## Week 3 (Day 15-21)

| Day | Asset | Type | Owner | Skill / Tool |
|---|---|---|---|---|
| Day 15 | LPs swap testimonials placeholders → real | code | 🤖 | `copywriting` |
| Day 16 | Directory submissions ×30 | outreach | 🤖+🤝 | `directory-submissions` |
| Day 17 | Fresh 50 Mumbai prospects + 3-channel sequences | data + outreach | 🤖+🤝 | `cold-email` + `whatsapp-outreach` + `outbound-outreach` |
| Day 18-19 | Daily outreach send | outreach | 🧍 | manual (caps: 20 email / 15 WhatsApp / 10 LinkedIn) |
| Day 20 | Community engagement (LinkedIn comments + WhatsApp groups) | social | 🤝 | `community-marketing` + `social-content` |
| Day 21 | Week 3 metrics review | analytics | 🤖 | `funnel-analysis` |

---

## Week 4 (Day 22-30)

| Day | Asset | Type | Owner | Skill / Tool |
|---|---|---|---|---|
| Day 22 | Drop-off CRO recommendations | analytics | 🤖 | `funnel-analysis` + `page-cro` |
| Day 23 | Follow-up wave to non-replies | outreach | 🤝 | `email-sequence` |
| Day 24 | Reactivation emails to stalled trials | outreach | 🤖 | `email-sequence` |
| Day 25 | Customer case study + SEO blog | content | 🤝+🤖 | `copywriting` + `seo-blog` |
| Day 26 | Trial-to-paid follow-up | outreach | 🤖 | `email-sequence` + `paywall-upgrade-cro` |
| Day 27 | Pitch refinement | copy | 🤖 | `copywriting` + `messaging-optimizer` |
| Day 28 | NPS in-app + email | code + content | 🤖 | analytics + `email-sequence` |
| Day 29 | Revenue + retention audit | analytics | 🤖 | `funnel-analysis` + `retention-analysis` |
| Day 30 | M2 strategy + referral program | strategy | 🤖+🤝 | `referral-program` + `growth-intel` |

---

## Reuse log

When an existing asset is reused without modification, log here so we don't re-produce by accident:

| Date | Asset | Used in | Reused without changes? |
|---|---|---|---|
| YYYY-MM-DD | `outreach/mumbai-outreach-templates.md` | Day 9 invites | ✅ |

(Append rows as you go.)
