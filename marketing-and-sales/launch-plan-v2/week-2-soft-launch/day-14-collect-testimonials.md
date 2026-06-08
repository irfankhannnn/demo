# Day 14 — Collect 5+ Testimonials (Video + Text)

> **Type:** 🤝 HYBRID + 🧍
> **Phase:** Week 2
> **Skill(s):** `customer-research` + `copywriting` + `social-content`
> **Estimated time:** 4h founder + 1h AI

## Objective
Collect 5+ testimonials from beta testers via 30-min recorded video calls (or written if they prefer), edit into 60-second clips + 1 long-form, capture quote + name + role + locality + photo for LP/social use, and ship to `creative/landing-pages/main/index.html` testimonial slot for Day 15 placeholder swap.

## Why This Matters for RealEstateFlow
Day 17 cold prospects + Day 21 LP visitors trust Mumbai-broker testimonials infinitely more than founder copy. Day 14 captures real social proof that powers Days 15-30 conversion.

## User Story
As founder, I want 5+ Mumbai-broker testimonials (video + text) by EOD Day 14, so Day 15 onwards every LP + cold sequence carries authentic social proof.

## Acceptance Criteria
- [ ] 5+ testimonials collected (video preferred; text acceptable for camera-shy)
- [ ] Each testimonial captured with: name, role/agency, locality, photo (head-shot or work setting), 60-sec video OR 1-2 paragraph text quote, signed consent for marketing use
- [ ] Consent form at `marketing-and-sales/launch-implement/week-2/day-14-testimonial-consent.md` — explicit, DPDP-compliant, scope (website + social + ads), revocation policy
- [ ] All consents signed (digital signature or WhatsApp-confirmed)
- [ ] Videos edited to 60-sec clips with brand watermark + caption (auto-generated via `voiceover-gen` if needed)
- [ ] 1 long-form testimonial (2-3 min) for /demo page + LinkedIn
- [ ] All assets stored at `marketing-and-sales/launch-implement/week-2/testimonials/{tester-slug}/`: video.mp4, photo.jpg, quote.txt, consent.pdf
- [ ] Testimonials catalogued in `marketing-and-sales/launch-implement/week-2/day-14-testimonials-index.md` (master list)
- [ ] LP placeholder swap queued for Day 15 (`day-15-replace-placeholders.md`)
- [ ] At least 1 video shareable on LinkedIn Day 14-15

## Manual Steps (🧍)

1. **Schedule recording calls** with the 4+ testers who confirmed "yes" Day 13. 30-min slots on Cal.com.
2. **Pre-call**: send the consent form + 5 prep questions ahead so they can think.
3. **Run recordings** (Zoom/Meet/Loom) — structure below.
4. **Capture text quote** in real-time (key sentence to pull out).
5. **Get explicit consent** at end of call (verbal on camera + text confirmation post-call).
6. **Edit videos** post-call: pull 60-sec best clip + 2-3 min long-form + add brand watermark + auto-caption (via Loom or `voiceover-gen` skill for caption alignment if Loom too rough).
7. **Store all assets** + update master index.
8. **Send thank-you** + share their testimonial back to them (proud-of-themselves moment).
9. **Daily standup** + tick ACs.

## Recording call structure (30 min)

| Time | Topic |
|---|---|
| 0-2 min | Rapport + recording consent confirmed on camera |
| 2-7 min | Background: who they are, where they work, current workflow |
| 7-15 min | Their 14-day RealEstateFlow experience: what changed, specific stories |
| 15-22 min | The 1 thing they'd recommend to other Mumbai brokers |
| 22-25 min | What they'd want next (feature wishlist) |
| 25-30 min | Wrap + thank + permissions reconfirmed |

## 5 Prep questions to send ahead
1. What was your old workflow before RealEstateFlow? (Excel? Other CRM? WhatsApp + paper?)
2. What's one specific moment in the last 14 days where RealEstateFlow saved you time?
3. If you had to describe RealEstateFlow to a broker friend in one sentence, what would you say?
4. Would you pay for it? Why or why not?
5. What's one thing missing for you to fully commit?

## AI Prompt (🤖)

```
Read inputs:
- `marketing-and-sales/launch-implement/week-2/day-13-checkin-log.csv` (testimonial-yes confirmations)
- `marketing-and-sales/launch-implement/week-2/day-10-call-notes/*.md` (Day 10 willingness signals)
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`
- `marketing-and-sales/launch-implement/pre-launch/01-legal/privacy.md` (DPDP wording)

Produce:

## 1. `marketing-and-sales/launch-implement/week-2/day-14-testimonial-consent.md`
DPDP-compliant marketing-use consent form. Plain English. Sections:
- Their name, agency, role
- Scope of use: website (LPs, /vs/*), social media (LinkedIn, Twitter, Meta, YouTube), advertising (paid ads M2+)
- Duration: 2 years from signing, then re-confirm
- Revocation: email info@realestateflow.in to revoke; we remove from public surfaces within 7 working days
- No payment, no obligation — testimonial is voluntary
- Specifically allows: their photo + quote + 60-sec video clip + name + role
- Specifically restricts: phone, email, GSTIN not used in marketing
- Signature line + date + WhatsApp/email confirmation acceptable

## 2. `marketing-and-sales/launch-implement/week-2/day-14-recording-prep-message.md`
WhatsApp/email message to send to confirmed testers 24h before recording call. Includes:
- Confirmation of slot
- The 5 prep questions
- Consent form attached
- Founder note: "30 min max, very casual, no script needed — just your honest experience."

## 3. `marketing-and-sales/launch-implement/week-2/day-14-testimonials-index.md`
Master index template:
| Tester | Locality | Role | Video URL | Quote | Photo | Consent? | Use approved on |
|---|---|---|---|---|---|---|---|

## 4. `marketing-and-sales/launch-implement/week-2/day-14-edit-spec.md`
Video edit checklist:
- Pull 60-sec best clip (single most-quotable segment)
- Pull 2-3 min long-form (best 3 segments stitched)
- Add brand watermark (RealEstateFlow logo bottom-right)
- Auto-caption (Loom built-in or ElevenLabs SRT)
- Trim silences
- Add 1-line title card at start: "Tester {{name}}, {{role}}, {{locality}}"
- Export 1080p MP4 for web + LinkedIn-ready 1:1 + 9:16 for Reels (M2)

## 5. `marketing-and-sales/launch-implement/week-2/day-14-quote-extraction.md`
After watching recording, extract:
- 1 hero quote (≤140 chars for LP card)
- 1 long-form quote (≤300 chars for /demo page)
- 1 social share quote (≤280 chars for Twitter/LinkedIn)

For each: tester's name, agency, locality, photo URL.

Stop. Do not auto-publish (founder reviews + Day 15 swap).
```

## Inputs
- Day 13 testimonial-yes list
- Recording tool (Zoom/Meet/Loom)
- Editing tool (Loom/Descript/CapCut)
- DPDP wording

## Outputs
- 5+ testimonials in `marketing-and-sales/launch-implement/week-2/testimonials/{slug}/`
- Master index
- Consent forms signed
- 60-sec clips ready for LP swap

## Success Criterion
5+ consents + clips + photos collected; LP swap queued for Day 15; 1 video shareable Day 14-15 on LinkedIn.

## Fallback / Plan B
If <5 testers say yes by EOD Day 14, accept text-only quotes + extend ask to next 5-10 testers Day 15-16 (relax requirement to 3+ video, 5+ total). Don't fake testimonials; transparent about M1 cohort size.

## Risks
| Risk | Mitigation |
|---|---|
| Camera-shy testers | Offer text-quote alternative + photo |
| Consent ambiguity → legal risk | DPDP-compliant explicit consent form |
| Quotes generic / non-specific | Prep questions force specifics; founder asks follow-up |
| Editing eats too much time | Loom auto-caption + minimal cuts (raw is fine) |
| Tester revokes later | Honor within 7 working days; archive original clip |

## India / Mumbai-Specific Notes
- Mumbai brokers may prefer Hindi for testimonials — caption in English subtitles
- Recording in their office (with broker permission) feels more authentic than home
- Consent in Hindi/Marathi available on request

## Dependencies
- **Blocks:** Day 15 (LP swap), Day 17 (cold outreach uses social proof), Day 25 (case study)
- **Depends on:** Day 13 willingness signals

## Connected Skills
- `customer-research` — interview structure
- `copywriting` — quote extraction
- `social-content` — clip cuts
- `voiceover-gen` — caption alignment
