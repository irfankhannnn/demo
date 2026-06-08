# Day 20 — Community Engagement (LinkedIn + WhatsApp Groups + Reddit)

> **Type:** 🤝 HYBRID
> **Phase:** Week 3
> **Skill(s):** `community-marketing` + `social-content` + `customer-research`
> **Estimated time:** 4h founder + 2h AI

## Objective
Spend Day 20 on relationship-driven discovery: LinkedIn comment-engage on 20 broker posts, share Day-14 testimonial as LinkedIn Post 6, drop 1 high-value comment in 5 Indian SaaS / real-estate Slack/Discord/WhatsApp groups, schedule Day 23 Twitter/X thread on "10 things I learned launching to 8 Mumbai brokers in 14 days".

## Why This Matters for RealEstateFlow
Cold outreach is one channel. Community engagement compounds: every authentic comment on a broker's post brings 5-10 silent watchers who may sign up. Founder's LinkedIn post + group comments build top-of-funnel without spamming.

## User Story
As founder on Day 20, I want to engage genuinely in 4 communities + ship 1 high-quality LinkedIn post, so the wedge gets visibility beyond the cold-outreach channel.

## Acceptance Criteria
- [ ] LinkedIn Post 6 published: short-form (≤200 words) story + Day-14 video testimonial embedded — published 11am-1pm IST
- [ ] Post 6 receives ≥30 reactions + ≥5 thoughtful comments by EOD
- [ ] LinkedIn comments: founder leaves 20 substantive comments on broker / SaaS / real-estate posts (no self-promo; pure value)
- [ ] WhatsApp group activity: founder shares Loom + 1 testimonial in 3 broker WhatsApp groups (where founder is member or invited)
- [ ] Reddit/Indian Slack/Discord: 5 high-value comments in r/IndiaInvestments / r/realestate / Indian SaaS slacks
- [ ] Twitter/X thread drafted at `marketing-and-sales/launch-implement/week-3/day-20-twitter-thread.md` for Day-23 publish
- [ ] Engagement tracker `day-20-engagement-log.csv`: platform, content, link, reactions, comments, profile-views-24h, conversion-events
- [ ] All comments authentic, value-first, no link drops unless explicitly invited
- [ ] Daily standup written

## Manual Steps (🧍)

1. **Run AI Prompt #1** to draft LinkedIn Post 6 + alt-version + 5 quick comments to leave on existing posts.

2. **Publish LinkedIn Post 6** at 11am IST. Engage with first 10 commenters within 1h.

3. **LinkedIn comment-engage** (90 min): scroll feed for broker/SaaS/real-estate posts, leave 20 substantive comments. Examples of substantive: 1-line agreement + 1-line counter-perspective + 1 specific Mumbai example.

4. **Run AI Prompt #2** to draft WhatsApp group share + Reddit/Slack comment templates.

5. **WhatsApp group share** (30 min): in 3 broker groups, share 60-sec testimonial video + 1-liner: "Sharing what one of our beta testers said. If anyone wants the link, DM me."

6. **Reddit/Indian Slack/Discord** (45 min): comment in 5 relevant threads with value-first content. Drop product link only if context-appropriate + asked.

7. **Run AI Prompt #3** to draft Day-23 Twitter/X thread.

8. **Track everything** in `day-20-engagement-log.csv`.

9. **Daily standup**.

## AI Prompt #1 (🤖) — LinkedIn Post 6

```
Read inputs:
- `marketing-and-sales/launch-implement/week-2/day-14-testimonials-index.md` (use 1 testimonial)
- `marketing-and-sales/launch-implement/pre-launch/06-branding/linkedin-pre-launch-posts.md` (Posts 1-5 voice baseline)
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
- `marketing-and-sales/launch-implement/week-2/day-10-call-notes/{best-tester}.md` (story material)

Produce `marketing-and-sales/launch-implement/week-3/day-20-post6.md`:

## Post 6 — Beta tester story + Day-14 milestone

Voice = founder personal, no buzzwords, Mumbai-specific.
Structure:
- Hook (1 line, contrarian or specific): "8 Mumbai brokers later, here's what I learned."
- Mini-story (4-5 lines): brief journey from Day 1 → Day 14, specific moment that proved the wedge
- 1 testimonial verbatim quote (60-sec video as media attachment)
- 1 lesson (1 line) for Mumbai brokers/SaaS founders
- Soft close: "If you're a Mumbai broker curious about this, comment below or DM."
- 200 words max.

## Alt version (50 words shorter, more Twitter-able)

## Suggested 5 comments to leave on broker posts
For each: target post type ("broker complaining about CRM", "agency owner asking for Excel alternatives", "real-estate hiring post"), comment template.

## Inputs needed for the post itself
- Best testimonial video URL
- Tester name + locality (with consent)
- Founder bio link

Stop.
```

## AI Prompt #2 (🤖) — Group/Reddit/Slack content

```
Read inputs:
- `marketing-and-sales/launch-implement/pre-launch/04-positioning/wedge.md`
- `marketing-and-sales/launch-implement/week-2/day-14-testimonials-index.md`
- `marketing-and-sales/research/icp-report-mumbai-launch.md`

Produce `marketing-and-sales/launch-implement/week-3/day-20-community-snippets.md`:

## WhatsApp broker group share (3 versions, 200 chars each)
Casual, value-first. Eg: "Sharing a quick win one of our Andheri beta testers had with RealEstateFlow this week — saved her ~6h on lead follow-up. If anyone wants the link, ping me."

## Reddit r/IndiaInvestments comment template
Context: someone asks about CRM for small business in India.
Comment: 4 lines value + 1 line "I'm building one for Mumbai real-estate; happy to share if relevant" — no link unless asked.

## Indian SaaS Slack/Discord comment templates
3 variants for: launch story / pricing strategy debate / India SaaS challenges.

## Twitter/X reply templates
5 variants for replying to Indian SaaS/real-estate tweets.

Stop.
```

## AI Prompt #3 (🤖) — Day-23 Twitter thread

```
Read inputs from above + `marketing-and-sales/launch-implement/week-2/day-11-cohort-health.md`.

Produce `marketing-and-sales/launch-implement/week-3/day-20-twitter-thread.md` for Day-23 publish:

# Twitter/X Thread: "10 things I learned launching to 8 Mumbai brokers in 14 days"

8-12 tweets, each ≤280 chars. Format:
1. Hook tweet (curiosity + numbers)
2-9. One lesson per tweet (specific data + 1-line takeaway)
10. Quick wedge mention
11. CTA: cal.com / website
12. Like+RT softly

Cross-post-friendly: thread must work as LinkedIn carousel as well.

Stop.
```

## Inputs
- Day-14 testimonials
- Pre-launch LinkedIn posts (P6)
- Beta cohort health
- Wedge

## Outputs
- `day-20-post6.md` (LinkedIn) + published
- `day-20-community-snippets.md` (group comments)
- `day-20-twitter-thread.md` (queued Day 23)
- `day-20-engagement-log.csv`

## Success Criterion
Post 6 published + 30 reactions + 20 LinkedIn comments + 3 WhatsApp groups engaged + 5 Reddit/Slack comments + Day-23 thread queued.

## Fallback / Plan B
If LinkedIn Post 6 underperforms (<10 reactions in 4h), boost via WhatsApp share to broker contacts + Indian SaaS Slack share. Don't pay-promote.

## Risks
| Risk | Mitigation |
|---|---|
| Self-promo backlash in groups | Value-first; no links unless asked |
| Comment looks AI-generated | Founder reviews + personalises every comment |
| WhatsApp group spam-flag | Founder is member; share only context-relevant |
| LinkedIn algorithm doesn't pick up | Post timing + engage commenters in first 30 min |
| Reddit/Slack ban for promo | Read group rules before posting |

## India / Mumbai-Specific Notes
- Mumbai broker WhatsApp groups: founder must be member-by-invitation
- Indian SaaS Slack #IndianFounders / #IndianStartups (popular)
- Reddit India SaaS less active; r/IndiaInvestments + r/CommercialEstateIndia better

## Dependencies
- **Blocks:** Day 23 Twitter publish, Day 25 case study
- **Depends on:** Day 14 testimonials, P6 LinkedIn

## Connected Skills
- `community-marketing` — primary
- `social-content` — Post 6 + thread
- `customer-research` — listening for community pain
