# P6 — Founder Personal Brand (LinkedIn Rewrite + 5 Pre-launch Posts)

> **Type:** 🤖 AUTO + 🧍 MANUAL
> **Phase:** Pre-launch
> **Day / Block:** T-14 (LinkedIn rewrite + post 1) → T-3 (post 5 launch teaser)
> **Skill(s):** `copywriting` + `social-content`
> **Estimated time:** 1h founder/post · 4h AI total

## Objective
Rebuild the founder's LinkedIn profile + publish 5 pre-launch posts (T-14, T-12, T-9, T-6, T-3) to seed authority, position the wedge, and warm an audience of Mumbai brokers + Indian SaaS folks before Day-17 cold outreach.

## Why This Matters for RealEstateFlow
Cold outreach replies double when prospects can land on a credible LinkedIn profile + see 3-5 recent posts about the problem they have. Posts also serve as proof of thought-leadership for AI-search citations (`ai-seo`) and warm up the founder mailbox via reply-engagement.

## User Story
As a founder running cold outreach Day 17+, I want a fully rewritten LinkedIn profile + 5 pre-launch posts published, so prospects who Google me find proof-of-thought + a clear pitch within 30 seconds.

## Acceptance Criteria
- [ ] LinkedIn profile rewritten: headline · about · featured (4 items: demo video, /pricing link, /vs/sell-do post, founder essay) · experience · skills
- [ ] All 5 posts drafted in `marketing-and-sales/launch-implement/pre-launch/06-branding/posts-1-to-5.md`
- [ ] Post 1 (T-14) published, ≥10 reactions in 24h
- [ ] Post 2 (T-12) published
- [ ] Post 3 (T-9) published, includes 1 founder photo
- [ ] Post 4 (T-6) published, includes 90-sec Loom of demo
- [ ] Post 5 (T-3) launch teaser published, ≥50 reactions in 24h, ≥5 booking-link clicks
- [ ] All posts cross-shared to: 3 Mumbai broker WhatsApp groups (manual), 1 Indian SaaS Slack/Discord, founder's Twitter (organic)
- [ ] LinkedIn profile + 5 posts archived as PDF/screenshot at `launch-implement/pre-launch/06-branding/snapshots/`

## Manual Steps (🧍)

1. **Run AI Prompt below** → produces LinkedIn copy + all 5 post drafts.
2. **Profile rewrite (T-14):**
   a. LinkedIn → Edit Profile → paste new headline (220 chars), about section, featured 4 items.
   b. Update profile photo (high-res, neutral background, smile).
   c. Update banner (1584×396 px) — generate via `nano-banana-pro` with brand kit; alternative: use Canva spec from `creative/realestateflow-launch/canva-layout-specs.md`.
   d. Add `realestateflow.in` to "Website" field, "Mumbai" to location.
3. **Post 1 (T-14, Tuesday or Wednesday 10am IST):** Copy from `posts-1-to-5.md` → LinkedIn → Start a post → paste → upload founder photo if specified → preview → post. Engage with first 10 comments within 2h.
4. **Post 2 (T-12):** Same workflow.
5. **Post 3 (T-9):** Same workflow + cross-post to Twitter as a thread.
6. **Post 4 (T-6):** Record 90-sec Loom of CRM demo (Andheri property → buyer search → AI Employee transcript). Upload to LinkedIn natively (not YouTube link). Caption from `posts-1-to-5.md`.
7. **Post 5 (T-3):** Launch teaser. Cross-post to: 3 Mumbai broker WhatsApp groups (paste link, brief intro), Indian SaaS Slack (e.g., #saasin Slack), founder's Twitter.
8. **Archive snapshots** of each post + final profile to `launch-implement/pre-launch/06-branding/snapshots/{slug}.png` for compliance/historical reference.
9. **Track engagement metrics** in `launch-implement/pre-launch/06-branding/engagement.csv`: post-id, date, impressions, reactions, comments, shares, profile-visits, demo-link-clicks, calendar-bookings.
10. **Tick ACs** + log to `00-DECISIONS-LOG.md`.

## AI Prompt (🤖)

```
You are a senior B2B SaaS founder personal-brand writer. Read these inputs:
- `marketing-and-sales/launch-plan-v2/00-PLAN-OVERVIEW.md`
- `marketing-and-sales/launch-plan-v2/pricing.json`
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md` (from P4 output)
- `marketing-and-sales/research/buyer-personas-summary.md`
- `marketing-and-sales/research/MUMBAI-LAUNCH-EXECUTIVE-SUMMARY.md`

Founder facts (placeholders to replace):
- Name: `{{FOUNDER_NAME}}`
- Background: `{{FOUNDER_BACKGROUND_2_LINES}}`
- Why building this: `{{FOUNDER_WHY}}`
- LinkedIn URL: `https://linkedin.com/in/{{FOUNDER_HANDLE}}`

Produce 2 outputs:

## 1. `marketing-and-sales/launch-implement/pre-launch/06-branding/linkedin-profile.md`

### Headline (220 chars max)
"Founder, RealEstateFlow · Building the AI Employee for Indian real-estate brokers · WhatsApp + Telegram-native CRM · Mumbai-built, Mumbai-first"

### About (≤2,000 chars)
3-paragraph story:
- Para 1: Who I am + how I got here (founder background)
- Para 2: What I'm building (1-line wedge + Mumbai-first context + why now)
- Para 3: Who I want to talk to (Mumbai brokers + small teams) + clear CTA (book 15-min demo or DM)

### Featured (4 items, in order)
1. Demo video (90-sec Loom) — title: "See it qualify a buyer in 90 seconds"
2. /pricing — title: "Honest pricing for honest brokers — ₹999 to start"
3. /vs/sell-do — title: "Sell.do alternative for Mumbai brokers"
4. Founder essay (you can write a Medium/Substack post or just link to a LinkedIn article) — title: "Why every Indian real-estate CRM has failed brokers (and what we're building instead)"

### Experience (current role)
- Title: Founder & CEO
- Company: RealEstateFlow
- Date: {{LAUNCH_MONTH}} 2026 — Present
- Location: Mumbai
- Description: 3-4 lines — wedge + Mumbai launch + AI Employee mention + welcome DMs from brokers + builders + investors

### Skills (top 5)
B2B SaaS, Real Estate Tech, AI Agents, Customer Discovery, Product-Led Growth

### Open To
"Connect with: Mumbai real-estate brokers, agency owners, AI/SaaS founders. DMs open."

## 2. `marketing-and-sales/launch-implement/pre-launch/06-branding/posts-1-to-5.md`

### Post 1 — T-14 — "Why every CRM has failed Indian brokers"
Hook: "I spent 90 days watching Mumbai brokers work. Here's why every CRM has failed them."
- 200-220 words
- Format: hook → 3-4 specific observations from Mumbai brokers (use ICP report context) → bridge to "I'm building something different" → 1-line wedge → invitation to comment with their CRM frustrations
- 1 founder photo (high-res, optional caption)
- Hashtags: #realestate #mumbaibrokers #saasindia (max 3)
- 1 engagement question at the end

### Post 2 — T-12 — "5:47 AM. Bandra broker."
Hook: "5:47 AM. Bandra broker. WhatsApp has 312 unread messages. This is the real CRM."
- 240-260 words, vignette-style
- Tell a specific story (one Bandra broker's morning ritual). Use real Mumbai detail (Andheri-Bandra commute, society security, RERA compliance pressure, late-night buyer calls).
- Bridge: "What if WhatsApp WAS the CRM?" — implicit AI Employee setup
- 1 phone screenshot (Whatsapp interface mock-up — request from `nano-banana-pro` with `whatsapp-automation-graphics-spec.md`)
- Hashtags: #realestate #brokerlife #ai

### Post 3 — T-9 — "Sell.do, Zoho, LeadSquared — built for a workflow we don't have"
Hook: "Sell.do. Zoho. LeadSquared. All built for a workflow Indian agents don't have."
- 180-200 words, comparison-style
- 3-line side-by-side: how western CRM thinks vs how Indian broker actually works
- Wedge sentence: "I'm building one that fits the WhatsApp-first, Khata-book-second, Excel-fallback workflow Mumbai brokers actually use."
- No image (text-only post)
- Hashtags: #saas #productmarket-fit #realestate

### Post 4 — T-6 — "What does an AI Employee actually look like?"
Hook: "What does an 'AI Employee' actually look like? Here's 90 seconds."
- 250-260 words
- Open with the question, bridge to "I built it for a Bandra broker friend; here's the demo"
- Native LinkedIn video (90-sec Loom): walk through demo tenant — Andheri property → buyer search → AI Employee qualifies a buyer on WhatsApp → updates Khata book
- Closing CTA: "Want to try it on your agency? DM me. 14 days free, no card. Mumbai-first."
- Hashtags: #aiagents #realestate #buildinpublic

### Post 5 — T-3 — "RealEstateFlow opens to Mumbai brokers tomorrow"
Hook: "RealEstateFlow opens to Mumbai brokers tomorrow. 14 days free. No card."
- 150-170 words, launch-teaser format
- 1 sentence wedge + 3 bullet differentiators (Mumbai-built · WhatsApp-native AI Employee · 1-month money-back) + Cal.com link
- Image: hero graphic from `creative/realestateflow-launch/page-wise-graphics-checklist.md`
- Hashtags: #launch #saasindia #mumbai

After both files: write 1 cross-cut `posting-cadence.md` with optimal time-of-day per post (LinkedIn analytics-driven: Tue/Wed 9-11am IST best for B2B India), expected reach + reaction targets, repurposing plan (Post 4 → Twitter thread, Post 1 → newsletter intro paragraph).

Do NOT publish. The founder publishes manually per the Manual Steps.
```

## Inputs
- Founder name + background + why-building (founder fills via prompt placeholders)
- Brand kit + ICP + wedge (already shipped)
- Demo Loom (recorded T-7 — covered in `cross-cutting/asset-production-calendar.md`)

## Outputs
- `marketing-and-sales/launch-implement/pre-launch/06-branding/linkedin-profile.md`
- `.../posts-1-to-5.md`
- `.../posting-cadence.md`
- `.../engagement.csv` (template)

## Success Criterion
LinkedIn profile rewritten + all 5 posts published on schedule + post 5 generates ≥5 booking-link clicks (proxy for warm pipeline).

## Fallback / Plan B
If founder uncomfortable on camera for post 4 Loom, use AI-narrated screencast: ElevenLabs voice + Loom screen-only mode. If reach is poor on Day 1, comment-engage on 5 high-traffic Mumbai-broker LinkedIn posts (`community-marketing` skill).

## Risks
| Risk | Mitigation |
|---|---|
| Posts feel generic | Each post grounded in a specific Mumbai-broker observation; persona docs as input |
| Founder doesn't post on time | Schedule via Buffer or LinkedIn native scheduler; 24h buffer per post |
| Engagement low | Comment back to first 10 comments within 2h; cross-share to broker WhatsApp groups |
| Brand voice drift | All posts reviewed against `wedge.md` before publishing |
| LinkedIn TOS strike from external automation | Use only LinkedIn native scheduler; no third-party tools |

## India / Mumbai-Specific Notes
- Tuesday/Wednesday 9-11am IST = best B2B India reach
- Use Hindi/Hinglish words sparingly in English posts (1-2 max — "bhai", "agency owner", "Mumbai", "Bandra")
- Cross-post to broker WhatsApp groups manually (no automation)
- Indian SaaS Slack groups: SaaSBOOMi, IndianStartup, SaaSin

## Dependencies
- **Blocks:** Day 17 cold outreach (warmer reply rate post-LinkedIn presence)
- **Depends on:** P4 wedge (input), P8 logo (banner image)

## Connected Skills
- `copywriting` — profile + posts
- `social-content` — post optimization + cadence
- `nano-banana-pro` — banner + post 2 mockup
- `video` — post 4 Loom recording
