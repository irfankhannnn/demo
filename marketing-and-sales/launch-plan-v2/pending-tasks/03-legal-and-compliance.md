# 03 — Legal & Compliance

> **Scope:** Human/legal sign-offs that code cannot do. The 4 legal pages are already **drafted + rendered** into the live LP (`creative/landing-pages/legal/{terms,privacy,refund,cookies}/index.html`, PR #24) with company-specific fields bracketed in amber — what remains is filling those fields and getting a lawyer/CA to approve.
> **Owner files to read:** `team-work/FOUNDER-tasks.md` (`FND-004/008/009`), `team-work/MADHU-tasks.md` (`MAD-003/008`).
>
> **Already done — no action needed (removed from this list):**
> - LEGAL-05 signup consent checkbox — shipped (`RegisterAdmin.tsx` blocks submit until checked; `consentSignedAt` persisted in `auth.js`).
> - The 4 legal-doc drafts themselves — rendered into the LP pages in PR #24 (review still pending below).

---

## LEGAL-01: Provide Founder + Company Details for the Legal Pages
**Why:** The legal pages + LP copy have bracketed placeholders (CIN, GSTIN, registered address, Grievance Officer, effective date). They are not legally valid and Razorpay won't verify the site until these are real.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-008`, `FND-009`

**Steps** — hand these to Madhu / drop into the bracketed fields:
- Company full legal name, GSTIN, CIN, registered office address (Mumbai, Maharashtra).
- Grievance Officer name, email (`info@realestateflow.in`), phone, postal address.
- Confirm the sub-processor list (AWS, Razorpay, Brevo, AiSensy, Cloudflare, PostHog, Sentry, Crisp, BetterStack, Cal.com, ElevenLabs, Instantly).
- For LP copy + signatures: founder name + 2-line bio, Cal.com handle (ACCT-12), WhatsApp number for `wa.me`, demo video URL.

---

## LEGAL-02: Lawyer Review + Sign-off of the 4 Legal Documents
**Why:** Hard gate before Razorpay live mode and before accepting any customer data — DPDP Act 2023 + IT Act exposure if the policies are wrong.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-008`

**Steps**
1. Send the 4 rendered pages (terms / privacy / refund / cookies) to an Indian SaaS lawyer (e.g. Vakilsearch, LawSikho).
2. Brief: DPDP Act 2023, B2B SaaS, Mumbai entity, Indian customers.
3. Incorporate feedback; replace the amber "Draft for legal review" banner; get written email sign-off.

**Source files for the lawyer:** rendered pages under `creative/landing-pages/legal/*/index.html`; original drafts at `launch-implement/pre-launch/01-legal/`.

---

## LEGAL-03: GST Invoice CA Sign-off
**Why:** B2B customers can only claim input tax credit if the invoice format is correct; also a Razorpay live-invoice gate.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-004`, `team-work/MADHU-tasks.md` → `MAD-008`

**Steps**
1. After Razorpay live mode, generate the ₹1 test invoice (Week-1 Day-3, see `06-week1-operations.md`).
2. Send the PDF to a CA; verify HSN `998314`, CGST/SGST split, GSTIN, place-of-supply, reverse-charge declaration.
3. Save written confirmation to `launch-implement/week-1/day-03-live-invoice-signed.pdf`.

---

## LEGAL-04: Sign Off the Security Audit Report
**Why:** No-go gate for Day 1 — if the multi-tenant pentest finds a P0 (cross-tenant data leak), launch must hold.
**Priority:** Critical (P0) · **Read:** `team-work/FOUNDER-tasks.md` → `FND-008`

**Steps**
1. Read `launch-implement/pre-launch/13-security/security-audit-report.md` + `route-tenant-coverage.csv`.
2. Confirm zero P0 findings (else raise a fix ticket and re-scan).
3. Sign at the bottom: "Founder sign-off: [Name] [Date]"; log to `00-DECISIONS-LOG.md`.

---

## LEGAL-06: Inbox-Placement (Glockapps) Test
**Why:** Validates the warmed-up domain actually lands in the inbox (not spam) before cold outreach spends real prospects.
**Priority:** High (P1) · **Read:** `team-work/MADHU-tasks.md` → `MAD-003`

**Steps**
1. After ~14 days of Instantly warm-up (ACCT-11), run a Glockapps seed-list test from `info@realestateflow.in`.
2. Target inbox placement ≥ 90% across Gmail / Outlook / Yahoo; fix SPF/DKIM/DMARC if Spam/Promotions.
3. Record the score in `launch-implement/pre-launch/03-deliverability/warmup-progress.md`.
