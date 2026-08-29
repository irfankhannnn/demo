# 04 — Content & Brand

> **Scope:** Marketing content + brand assets (Madhu). Most AI drafts are already generated; what remains is the work that needs an authenticated image MCP, a human posting to LinkedIn, the welcome-drip build in Brevo, and a single founder-review pass on the existing drafts.
> **Owner file to read:** `team-work/MADHU-tasks.md` (every task maps to a `MAD-0xx` item).
>
> **Already done — no action needed (removed from this list):**
> - CONTENT-01 legal drafts (`MAD-001`) — rendered into LP legal pages (PR #24).
> - CONTENT-02 pricing copy + Razorpay product checklist (`MAD-002`) — `launch-implement/pre-launch/02-pricing/`.
> - CONTENT-03 deliverability docs (`MAD-003`) — `…/03-deliverability/` (DNS records, warm-up plan, signature).
> - CONTENT-04 positioning + battle cards + vs-pages (`MAD-004`) — `…/04-positioning/`.
> - CONTENT-07 SEO/AEO meta + JSON-LD + AEO answers (`MAD-007`) — homepage feature grid, 7 FAQ accordions, `FAQPage`/`SoftwareApplication` JSON-LD, and AI-bot `robots.txt` shipped in PR #24.
> - CONTENT-08 GST invoice template + CA checklist (`MAD-008`) — `…/07-gst/` (founder action lives in ACCT-07 / LEGAL-03).
> - CONTENT-09 cookie-consent banner copy + code (`MAD-009`) — shipped on all 14 LP pages + CRM (PR #24).

---

## CONTENT-05: Logo SVG + Favicons + OG Images
**Why:** The LP + CRM reference a logo, favicon set, and per-page OG images; today those are placeholders, so social shares and browser tabs look unbranded. **Blocked** until an image-generation MCP is authenticated.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-005`
**Blocker:** requires Higgsfield MCP OAuth (`.mcp.json`) — AI cannot generate assets without it.

**Steps**
1. Authenticate Higgsfield MCP at mcp.higgsfield.ai.
2. Run the P8 brand prompt with the brand kit (`#2563EB`, Inter) via `nano-banana-pro`.
3. Generate `logo.svg` (light + dark), 9-size favicon set, 6 OG PNGs (1200×630), `manifest.json`, `meta-tag-snippet.html`, + a LinkedIn banner (1584×396).
4. Save to `marketing-and-sales/realestateflow/assets/`; copy into `creative/landing-pages/assets/brand/` + `real-estate-crm-app/public/`.

---

## CONTENT-06: Founder LinkedIn Profile + 5 Pre-launch Posts
**Why:** Warms up the founder's profile so Day-17 cold outreach gets replies (brokers check who's messaging them). Drafts can be AI-generated, but **posting + scheduling is human**.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-006`

**Steps**
1. Generate `linkedin-profile.md` (headline/about/featured) + `posts-1-to-5.md` from `MAD-006`, using the founder details from LEGAL-01.
2. Paste the profile into LinkedIn at T-14.
3. Schedule 5 posts (T-14, T-12, T-9, T-6, T-3) via LinkedIn's native scheduler.
4. Post 4 needs a 90-sec Loom of the CRM demo (Andheri property → buyer → AI-Employee transcript).

**Output:** `launch-implement/pre-launch/06-branding/`.

---

## CONTENT-10: Welcome Drip Emails (4-step Brevo automation)
**Why:** New trial signups get no nurture today; the 4-email drip is what moves trial → activation. Copy can be drafted by AI, but the **automation must be built in Brevo** (needs ACCT-08) and template IDs fed to Lambda env.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-011`

**Steps**
1. Write 4 emails (T+0, T+1, T+3, T+7) in founder voice, Mumbai-specific.
2. In Brevo: workflow trigger "Contact added to Trial Signups list" → 4 email steps.
3. Capture the 4 Brevo template IDs → hand to founder for Lambda env (`BREVO_WELCOME_*`).
4. Smoke test: register a test trial → T+0 email arrives < 60s (check Gmail + Outlook + Yahoo).

**Output:** `launch-implement/week-1/day-06-welcome-drip.md`.

---

## CONTENT-11: Founder Review of the Existing AI Drafts
**Why:** The legal/pricing/positioning/SEO drafts above were AI-generated — none are customer-facing-final until the founder reads them for price accuracy, brand voice, and factual claims. This is the single human gate that unblocks LEGAL-02 and the LP go-live.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-001`, `MAD-002`, `MAD-004`

**Steps**
1. Pricing (`…/02-pricing/`): confirm every price matches `pricing.json`.
2. Positioning (`…/04-positioning/wedge.md`): do the "Bandra broker test" with 1 real broker.
3. Legal (rendered LP pages): confirm bracketed company fields are correct before sending to the lawyer (LEGAL-02).
4. Log approvals in `00-DECISIONS-LOG.md`.
