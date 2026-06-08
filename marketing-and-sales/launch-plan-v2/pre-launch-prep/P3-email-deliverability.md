# P3 — Email Deliverability (DNS + 21-day Warm-up)

> **Type:** 🤖 AUTO + 🧍 MANUAL
> **Phase:** Pre-launch
> **Day / Block:** T-21 (kickoff) → T-1 (final ramp)
> **Skill(s):** `analytics-tracking` (for DNS spec)
> **Estimated time:** 1.5h founder Day-1 setup · 0.5h/day for 21 days monitoring

## Objective
Configure SPF / DKIM / DMARC / MX records for `realestateflow.in` and run a 21-day automated warm-up so the founder mailbox lands in inbox (not spam) by Day 17 when cold sends start.

## Why This Matters for RealEstateFlow
A cold email campaign to Mumbai brokers from a fresh mailbox sent on Day 1 lands 100% in spam — wasting outreach budget + scoring the domain reputation. A 21-day warm-up + correct authentication gets ≥85% inbox-placement before our first real send (Day 17, Week 3).

## User Story
As a founder running cold outreach on Day 17, I want my email domain authenticated and warmed-up, so my Day-17 first batch of 20 cold emails lands in inbox (not spam).

## Acceptance Criteria
- [ ] DNS records published at Cloudflare for `realestateflow.in`:
  - SPF record (TXT): `v=spf1 include:spf.brevo.com include:_spf.google.com include:smtp.instantly.ai ~all`
  - DKIM 2048-bit selector for Brevo (from Brevo dashboard)
  - DKIM 2048-bit selector for Google Workspace (from Workspace admin)
  - DKIM 2048-bit selector for Instantly (from Instantly settings)
  - DMARC (TXT) at `_dmarc.realestateflow.in`: `v=DMARC1; p=quarantine; rua=mailto:dmarc@realestateflow.in; ruf=mailto:dmarc@realestateflow.in; pct=100; aspf=s; adkim=s; sp=quarantine; fo=1`
  - MX records for Google Workspace (5 records)
  - BIMI (TXT) at `default._bimi.realestateflow.in` pointing to logo SVG (optional, after P8 logo)
- [ ] Mailtester.com score ≥9/10 for an email from `founder@realestateflow.in`
- [ ] MXToolbox SPF/DKIM/DMARC validators all green
- [ ] Instantly warm-up campaign running with 5→10→15→25→40→50 emails/day ramp (configurable in Instantly)
- [ ] Founder email `founder@realestateflow.in` has signature with logo, title, calendar link, LinkedIn — set in Google Workspace
- [ ] Inbox-placement test on Day 14 (T-7) shows ≥85% inbox + 0% spam (use `glockapps.com` $79 test)
- [ ] Warm-up dashboard at `marketing-and-sales/launch-implement/pre-launch/03-deliverability/warmup-progress.md` updated weekly
- [ ] Brevo transactional API key generated, IPs whitelisted for `ap-south-1` outbound
- [ ] All DNS records committed to `marketing-and-sales/launch-implement/pre-launch/03-deliverability/dns-records.md` (source of truth)

## Manual Steps (🧍)

1. **Cloudflare login** at `https://dash.cloudflare.com`. Confirm `realestateflow.in` zone is active and nameservers point to Cloudflare.
2. **Run AI Prompt below** — produces `dns-records.md` with the exact records to publish.
3. **Publish DNS records** in Cloudflare → DNS → Records: copy each record from `dns-records.md`, set Proxy = OFF (DNS only) for SPF/DKIM/DMARC/MX (Cloudflare proxy doesn't apply to mail).
4. **Provision Google Workspace** at `https://workspace.google.com/business/signup` (₹125/user/month for Business Starter). Create user `founder@realestateflow.in`. Add `info@realestateflow.in` as a group alias (no extra cost).
5. **Verify Workspace ownership** by adding the TXT verification record in Cloudflare. Wait 5-10 min.
6. **Generate Workspace DKIM** at `admin.google.com → Apps → Google Workspace → Gmail → Authenticate email`. Add the DKIM TXT record to Cloudflare. Wait 24-48h, then click "Start authentication".
7. **Sign up for Brevo** at `https://onboarding.brevo.com/account/register` (free tier OK; upgrade to ₹599/mo Lite when sending volume warrants). Verify domain at `Senders & IP → Domains → Add new domain → realestateflow.in`. Brevo gives DKIM TXT records — add to Cloudflare.
8. **Sign up for Instantly** at `https://app.instantly.ai/auth/signup` (₹3,500/mo Growth plan). Connect `founder@realestateflow.in` via OAuth. Settings → Warmup → Enable, target Inbox = 50 emails/day, daily ramp = 5/day. (Instantly auto-ramps but verify the 21-day curve.)
9. **Configure DMARC report inbox** — create alias `dmarc@realestateflow.in` (Workspace alias to founder). Add to Cloudflare DMARC record's `rua=` and `ruf=`.
10. **Founder signature** — in Workspace → Settings → Signature, paste the HTML signature from the AI Prompt output (`signature.html`). Logo URL must be the deployed-on-Netlify logo from P8 once available; use placeholder PNG until then.
11. **Test send** — from `founder@realestateflow.in` send a test to `https://www.mail-tester.com` (instructions on their site, get a one-shot address). Verify score ≥9/10.
12. **Glockapps inbox-placement test** at T-7 (Day 14): pay $79 → send to their seed list → review inbox vs spam % → must be ≥85% inbox.
13. **Weekly check-in** — every 7 days update `warmup-progress.md` with: emails-sent / inbox-placement / spam-rate / replies / forced-bounces.
14. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## AI Prompt (🤖)

```
Generate 4 deliverability artefacts for RealEstateFlow:

## 1. `marketing-and-sales/launch-implement/pre-launch/03-deliverability/dns-records.md`
Markdown with a section per record. Each section has:
- Type: TXT / MX / CNAME
- Host: @ or selector
- Value: exact string to paste into Cloudflare
- TTL: Auto
- Proxy: OFF
- Source: which vendor
- Verification command: `dig` or `nslookup` one-liner
- Status: ☐ pending / ☑ published / ☑ verified

Records to include:
- SPF (combined for Brevo + Google Workspace + Instantly): `v=spf1 include:spf.brevo.com include:_spf.google.com include:smtp.instantly.ai ~all`
- DKIM Brevo: selector `mail._domainkey` (Brevo gives the value at signup)
- DKIM Workspace: selector `google._domainkey` (Workspace gives the value)
- DKIM Instantly: selector `instantly1._domainkey` (Instantly gives the value)
- DMARC: `_dmarc` TXT `v=DMARC1; p=quarantine; rua=mailto:dmarc@realestateflow.in; ruf=mailto:dmarc@realestateflow.in; pct=100; aspf=s; adkim=s; sp=quarantine; fo=1`
- MX: 5 Google Workspace MX records (priority 1: aspmx.l.google.com, etc.)
- BIMI (placeholder, fill once P8 logo SVG is hosted): `default._bimi` TXT `v=BIMI1; l=https://realestateflow.in/assets/og/logo-bimi.svg; a=https://realestateflow.in/assets/og/bimi-cert.pem`
- TXT for Workspace verification (placeholder until generated)
- TXT for Brevo domain verification (placeholder)

Add a section "Verification Checklist" with `dig` commands the founder can paste to confirm each record propagated globally.

## 2. `marketing-and-sales/launch-implement/pre-launch/03-deliverability/warmup-plan.md`
21-day warm-up schedule:
- Day 1-3: 5 emails/day to safe seed list (Instantly auto-warmup pool)
- Day 4-6: 10/day
- Day 7-10: 15/day
- Day 11-14: 25/day
- Day 15-17: 40/day
- Day 18-21: 50/day (steady state)
For each day: target volume, max-per-hour cap, reply-rate target (>30% in warm-up pool to signal "engaged sender"), action if >2% bounces (pause + investigate).

## 3. `marketing-and-sales/launch-implement/pre-launch/03-deliverability/signature.html`
HTML signature for founder, brand-aligned:
- Logo image (placeholder URL `https://realestateflow.in/assets/logos/final/logo.png`, swap for SVG once P8 ships)
- Founder name + title (placeholder `{{FOUNDER_NAME}}, Founder & CEO`)
- Mobile (placeholder)
- Email: founder@realestateflow.in
- Calendar link: cal.com/{{CAL_HANDLE}}
- LinkedIn: {{LINKEDIN_URL}}
- Tagline: "Hire an AI Employee for your real estate agency."
- Trust line: "Mumbai · GST 18% · DPDP-compliant"
- Inline CSS only (no external stylesheets — most clients strip them)

## 4. `marketing-and-sales/launch-implement/pre-launch/03-deliverability/warmup-progress.md`
Weekly tracker template (5 rows for 5 weeks of warm-up + Week-3 launch):
- Week | Date range | Emails sent | Inbox placement % | Spam % | Replies | Bounces | Glockapps score | Notes

Stop here. Do not publish DNS — that's a manual step.
```

## Inputs
- Cloudflare DNS access (founder)
- Brevo / Instantly / Workspace credentials (founder will create during manual steps)

## Outputs
- `marketing-and-sales/launch-implement/pre-launch/03-deliverability/dns-records.md`
- `.../warmup-plan.md`
- `.../signature.html`
- `.../warmup-progress.md`

## Success Criterion
By T-7: Glockapps inbox placement ≥85%, mailtester ≥9/10, all 3 DKIMs green in MXToolbox.

## Fallback / Plan B
If domain reputation tanks (Glockapps <70% by T-7), pause Instantly, switch warm-up to lemwarm.com (alternative warm-up tool, $29/mo), extend warm-up by 2 weeks, push first cold send from Day 17 → Day 30. Optionally provision a second domain `realestateflow.email` for cold sends.

## Risks
| Risk | Mitigation |
|---|---|
| DNS misconfigured causes mail rejection | Verify with `dig`/MXToolbox before relying; test send to mail-tester.com |
| DMARC `p=quarantine` blocks own transactional mail | Start with `p=none` for week 1, escalate to `p=quarantine` after DKIM verified |
| Warm-up too aggressive → blacklist | Cap at Instantly's auto-curve; if any blacklist hit, pause for 7 days |
| Workspace DKIM 24-48h lag | Start DKIM activation T-21 (immediately) |
| Brevo IP shared with bad senders | Upgrade to dedicated IP if Brevo Lite plan shows reputation issues |

## India / Mumbai-Specific Notes
- Indian inbox providers (TOI, Rediff) are stricter than Gmail; warm-up must include Indian seed addresses (Instantly's pool covers this)
- DPDP Act 2023 requires opt-out link in marketing emails — built into Instantly templates
- Brevo EU data location: disclose in Privacy Policy (P1 covers this)

## Dependencies
- **Blocks:** Day 17 (first cold send), Day 8 (beta invites), Day 6 (transactional Brevo drip live)
- **Depends on:** Cloudflare DNS access, founder budget for Workspace + Brevo + Instantly

## Connected Skills
- `analytics-tracking` — DNS spec
- `cold-email` — uses warm mailbox once ready (Day 17+)
