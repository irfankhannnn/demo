# Pre-Launch Prep (Block 0 — T-21 → T-1)

18 task files (P1-P18) covering everything that must be done **before Day 1 launch begins**. Run them in parallel where possible; skip none.

## Files

| ID | File | Title | Type | Days |
|---|---|---|---|---|
| P1 | `P1-legal-foundation.md` | DPDP-compliant legal docs (ToS, Privacy, Refund, Cookies) | 🤖+🧍 | T-19 → T-3 |
| P2 | `P2-pricing-strategy.md` | Pricing page + Razorpay product/plan checklist | 🤖+🧍 | T-17 → T-14 |
| P3 | `P3-email-deliverability.md` | DNS (SPF/DKIM/DMARC/MX) + 21-day mailbox warm-up | 🧍+🤖 | T-21 → T-7 |
| P4 | `P4-competitive-positioning.md` | Wedge, battle cards, /vs/* page drafts | 🤖+🧍 | T-15 → T-12 |
| P5 | `P5-demo-environment.md` | Populated demo tenant + daily reset cron | 🤖+🧍 | T-7 → T-5 |
| P6 | `P6-founder-personal-brand.md` | LinkedIn rewrite + 5 pre-launch posts | 🤖+🧍 | T-14 → T-3 |
| P7 | `P7-gst-invoicing.md` | Razorpay GST + invoice template + CA sign-off | 🧍+🤖 | T-3 |
| P8 | `P8-logo-and-favicons.md` | SVG logos + favicons + OG cards | 🤖 | T-13 |
| P9 | `P9-grievance-flow.md` | DPDP grievance form + backend + admin UI | 🤖+🧍 | T-5 |
| P10 | `P10-analytics-events.md` | PostHog + GA4 + Pixel + LinkedIn + Sentry events | 🤖+🧍 | T-8 |
| P11 | `P11-openclaw-concierge.md` | Razorpay webhook + concierge SOP + status page | 🤖+🧍 | T-3 |
| P12 | `P12-seat-cap-enforcement.md` | Seat limits at invite layer + paywall path | 🤖 | T-4 |
| P13 | `P13-multitenancy-security-audit.md` | Static + dynamic security audit + Playwright | 🤖+🧍 | T-1 |
| P14 | `P14-paywall-trial-countdown.md` | Trial banner + Day-15 paywall + Brevo emails | 🤖 | T-3 |
| P15 | `P15-landing-pages-rewrite.md` | Rewrite 5 LPs to English + add 7 new (12 total) | 🤖+🧍 | T-11 |
| P16 | `P16-seo-aeo-master.md` | JSON-LD + sitemap + robots.txt + llms.txt + AEO Q&A | 🤖+🧍 | T-9 |
| P17 | `P17-cookie-consent-banner.md` | DPDP cookie banner across LP + SPA | 🤖 | T-8 |
| P18 | `P18-cloud-infra-checklist.md` | AWS + Cloudflare + Razorpay + Cognito + IAM verify | 🧍+🤖 | T-21 → T-2 |

## Execution order

**T-21 (Block 0 day 1):**
- Start P3 (DNS + warm-up — needs full 21 days)
- Start P18 (cloud infra)
- Start P6 (founder brand)
- Order vendor accounts per `cross-cutting/vendor-urls.md`

**T-19 → T-14:**
- P1 (legal)
- P2 (pricing)
- P4 (positioning)
- P6 Posts 1-2

**T-13 → T-9:**
- P8 (logos + OG)
- P15 (LP rewrites — biggest task)
- P16 (SEO/AEO)
- P6 Post 3

**T-8 → T-5:**
- P10 (analytics)
- P17 (cookie banner)
- P5 (demo tenant)
- P9 (grievance flow)
- P6 Post 4 + Loom

**T-4 → T-1:**
- P12 (seat cap)
- P14 (paywall)
- P11 (concierge)
- P7 (GST)
- P6 Post 5
- P13 (security audit — last; runs after most code shipped)

## Dependency graph

```
P18 → all (infra is foundation)
P3 → all email-sending tasks (P6 posts get sent through, P10 verifies)
P1 + P9 + P17 → DPDP-compliant launch
P2 → P14 → P11 → P7 (pricing → paywall → webhook → invoicing chain)
P4 → P6 + P15 (wedge feeds branding + LPs)
P8 → P15 + P16 (logos before LP/SEO)
P10 → all analytics (events on each surface)
P5 → P15 + Day 6 demo flow
P13 → final audit before launch
```

## Acceptance for "Block 0 done"

- All 18 P-files marked complete in `00-DECISIONS-LOG.md`
- `pre-execution-checklist.md` fully ticked
- Founder signs off Day 7 audit (becomes trigger for Day 1 launch)

## How AI agent should consume this folder

Each P-file follows the `00-FILE-TEMPLATE.md` schema with: Objective, User Story, ACs, Manual Steps, AI Prompt, Inputs, Outputs, Success Criterion, Fallback, Risks, India-specific notes, Dependencies, Connected Skills.

To execute a P-file:
1. Read the file
2. Identify 🤖 vs 🧍 vs 🤝 markers
3. Run the AI Prompt(s) in order
4. Founder completes manual steps
5. Tick ACs and update `00-DECISIONS-LOG.md`
6. Mark file complete in this README's status table

## Status tracking

Append at end of each P-file completion:
- ✅ Done · YYYY-MM-DD · {brief outcome}
