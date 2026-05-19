# Pre-execution Checklist

Tick this BEFORE Block 0 (T-21) starts. If any item is unticked you cannot reliably execute the plan. Owner = founder unless noted.

---

## A. Identity & Legal

- [ ] Pvt Ltd entity registered with MCA; CIN captured
- [ ] PAN, GSTIN active; both visible in physical files
- [ ] Registered office address in Mumbai (Maharashtra)
- [ ] Founder Aadhaar + PAN copy ready (for Razorpay KYC)
- [ ] Bank current account opened in entity name + IFSC + account number ready (for Razorpay settlement)
- [ ] Founder photo (high-res, neutral background, smile) — for LinkedIn + signature

## B. Domain & Cloud

- [ ] Domain `realestateflow.in` purchased + registered (no expiry within 12 months)
- [ ] Domain registrar nameservers updated to Cloudflare
- [ ] AWS account active in `ap-south-1`; root MFA enabled
- [ ] AWS billing alert set ($X/month threshold)
- [ ] AWS CLI configured locally (`aws sts get-caller-identity` returns founder ARN)
- [ ] GitHub account ready; repo cloned locally
- [ ] 1Password / Bitwarden vault ready for secrets

## C. Critical vendor accounts (signups OK; live activation comes later)

- [ ] Cloudflare account
- [ ] Razorpay account (KYC docs prepared even if not yet submitted)
- [ ] Google Workspace (₹125/user/mo) for `founder@realestateflow.in`
- [ ] Brevo account (free tier OK to start)
- [ ] Instantly account (Growth ₹3,500/mo)
- [ ] AiSensy account (BSP onboarding initiated)
- [ ] PostHog free tier
- [ ] Google Analytics property
- [ ] Meta Business Manager Pixel
- [ ] LinkedIn Insight Tag
- [ ] Sentry (2 projects)
- [ ] Crisp helpdesk
- [ ] BetterStack uptime
- [ ] Cal.com handle
- [ ] hCaptcha account
- [ ] Higgsfield (Nano-Banana-Pro) subscription
- [ ] ElevenLabs account
- [ ] Loom account
- [ ] Glockapps credits ($79 one-time)

## D. Founder personal

- [ ] LinkedIn profile editable (URL captured)
- [ ] Founder personal WhatsApp number reserved for outbound (separate from product number if possible)
- [ ] Founder bio paragraph ready (background, why building)
- [ ] Founder Twitter/X handle ready (for cross-posting)
- [ ] Founder calendar slot blocked: Tue-Fri 11:00-17:00 IST for demos

## E. Files & repo state

- [ ] Repo synced to latest main; no uncommitted changes
- [ ] Local environment can run server + SPA: `npm run dev` works
- [ ] Existing CRM logs in to `phone OTP` flow without errors
- [ ] `pricing.json` reviewed and accepted
- [ ] All 18 pre-launch task files in `launch-plan-v2/pre-launch-prep/` reviewed
- [ ] All weekly day files reviewed at high level
- [ ] `00-DECISIONS-LOG.md` skim-read; understanding of locked decisions
- [ ] Cascade IDE configured with skill access (verify by running `find-skills` once)

## F. Lawyer / CA

- [ ] Vakilsearch (or alternative) engagement initiated; ETA 5-7 days for review
- [ ] Founder's CA on standby for invoice review (P7)
- [ ] Termly account ready as fallback (P1 plan B)

## G. Secret management

- [ ] `.env.example` reviewed; all keys understood
- [ ] No secrets committed to git (verified via `git secrets` or manual scan)
- [ ] 1Password vault has entries for every vendor
- [ ] Backup recovery codes saved offline (founder USB / printed)

## H. Communication

- [ ] Founder Slack/Discord/WhatsApp set up for "launch updates" channel (if collaborators exist)
- [ ] Crisp embedded on test environment
- [ ] BetterStack public status page URL ready (`status.realestateflow.in`)
- [ ] DMARC report mailbox `dmarc@realestateflow.in` alias active

## I. Daily ops

- [ ] Daily-log folder `marketing-and-sales/launch-implement/daily-log/` created
- [ ] Calendar reminders set: 18:00 IST daily standup; Sunday off
- [ ] Mobile data + good 4G/Wi-Fi for outreach demos

## J. Plan reading

- [ ] Read `00-PLAN-OVERVIEW.md` end-to-end
- [ ] Read `cross-cutting/risks-mitigations.md`
- [ ] Read `cross-cutting/skill-command-sheet.md`
- [ ] Read `cross-cutting/vendor-urls.md`
- [ ] Skim every pre-launch P-file (18) — note anything unclear
- [ ] Confirm execution order: Pre-launch P1-P18 first, then Day 1+

---

## Go / no-go

If any **A**, **B**, **C**, **E**, **G** item is unticked → cannot start Block 0.
If any **D**, **F**, **H**, **I**, **J** item is unticked → can start but flag the gap to fix in T-19.

Once all ticked: log `00-DECISIONS-LOG.md` entry "Pre-execution checklist complete; Block 0 starts {date}". Begin P1 + P3 + P18 in parallel.

---

## Sign-off

- [ ] Founder name: __________________________
- [ ] Date: __________________________
- [ ] Notes / exceptions: __________________________
