# Welcome Email Drip — Trial Signups

**Trigger:** Contact added to Brevo list "Trial Signups" on `signup_completed`  
**Timing:** T+0 · T+1 · T+3 · T+7  
**Voice:** Founder direct · Mumbai broker context · No buzzwords  
**Pause condition:** Contact upgrades to paid → move to "Paying Customers" list, exit workflow

---

## Email 1 — T+0 (Instant)

**Subject:** Welcome to RealEstateFlow — add your first buyer in 90 seconds  
**Preheader:** Your 14-day trial starts now. One task. Five minutes.  
**Expected open rate:** 55–65%  
**Expected CTR:** 25–35%

Hi {{first_name}},

Welcome to RealEstateFlow. You just gave yourself something most Mumbai brokers never get — a system that doesn't lose leads in WhatsApp scrollback.

RealEstateFlow is an AI-ready CRM built for brokers like you. Khata book, properties, buyers, team sharing — all in one place. Starts at ₹999/month after your **14-day free trial** (no card required).

**Your first task:** Add one buyer to the CRM. It takes 90 seconds.

[**Start adding buyers →**](https://app.realestateflow.in/buyers/new)

Here's a quick walkthrough if you want a guide: {{LOOM_FIRST_BUYER_URL}}

Stuck? Hit reply — I read every email.

— {{FOUNDER_NAME}}  
Founder, RealEstateFlow

---

## Email 2 — T+1 (24 hours)

**Subject:** Have you tried the AI Employee?  
**Preheader:** It qualifies leads on WhatsApp while you're at site visits.  
**Expected open rate:** 45–55%  
**Expected CTR:** 15–25%

Hi {{first_name}},

Quick check-in — did you add your first buyer yesterday?

If yes: nice. Your CRM is already more organised than 80% of brokers in Andheri.

If not: no stress. Add one today — [**takes 90 seconds →**](https://app.realestateflow.in/buyers/new)

**Today's nudge:** Meet the AI Employee.

It's a ₹7,999/month add-on that runs on your WhatsApp and Telegram — qualifies inbound leads, sends follow-ups, updates your Khata book. Cheaper than a junior agent. Works at 9pm when you're stuck in traffic.

Watch how it works (90 sec): {{LOOM_AI_EMPLOYEE_URL}}  
[**Learn more →**](https://realestateflow.in/ai-employee/)

**Quick win for today:** List your top 3 active buyers in the CRM. Watch how follow-up dates and preferences stay in one place — not scattered across chats.

— {{FOUNDER_NAME}}

---

## Email 3 — T+3 (72 hours)

**Subject:** 5 things Mumbai brokers do in their first week  
**Preheader:** 5-minute read. Real workflow, not theory.  
**Expected open rate:** 40–50%  
**Expected CTR:** 20–30%

Hi {{first_name}},

You're three days into your trial. Here's what successful Mumbai brokers do in Week 1:

1. **Add 10 buyers from WhatsApp** — forward old chats, enter manually, or import CSV
2. **Tag properties by locality** — Andheri, Bandra, Powai… filter leads faster
3. **Set up Khata book for 1 active deal** — track paid, pending, and settlement in one view
4. **Schedule a site visit from the CRM** — calendar syncs with your team's view
5. **Review analytics every Friday** — see which leads went cold before Monday

You don't need all five today. Pick two.

[**Open the CRM →**](https://app.realestateflow.in/)

Questions about Team pricing (₹1,999 for 3 agents) or AI Employee? Reply to this email.

— {{FOUNDER_NAME}}

---

## Email 4 — T+7 (168 hours)

**Subject:** How's RealEstateFlow working for you?  
**Preheader:** One week in — tell me what's working and what's broken.  
**Expected open rate:** 35–45%  
**Expected CTR:** 10–20% (reply-focused)

Hi {{first_name}},

It's been a week. I want to hear from you.

**What's working?**  
**What's broken?**  
**What's confusing?**

Reply to this email or WhatsApp me at {{FOUNDER_WHATSAPP}}. I reply personally.

If RealEstateFlow saved you even one missed follow-up this week, it's already worth ₹999/month.

**Ready to keep going?**

| Plan | Price | Best for |
|------|-------|----------|
| Solo | ₹999/mo | Just you |
| Team | ₹1,999/mo | 2–3 agents |
| Team+ | ₹1,999 + ₹500/seat | 4+ agents |

All plans: 14-day trial done · 30-day money-back · GST invoice (HSN 998314)

[**Pick a plan →**](https://realestateflow.in/pricing/)  
[**Upgrade in app →**](https://app.realestateflow.in/billing?upgrade=true)

Thanks for trying something built in Mumbai, for Mumbai.

— {{FOUNDER_NAME}}  
Founder, RealEstateFlow  
[Book 15 min with me](https://cal.com/{{CAL_HANDLE}})

---

## Brevo Workflow Spec

| Step | Delay | Template | Exit if |
|------|-------|----------|---------|
| 1 | T+0 | Welcome (above) | — |
| 2 | +24h | AI Employee nudge | — |
| 3 | +72h from step 1 | 5 quick wins | — |
| 4 | +168h from step 1 | Week-1 check-in | — |

**List:** Trial Signups (`BREVO_TRIAL_LIST_ID`)  
**Webhook:** `POST /auth/register` success → Brevo `POST /contacts`  
**A/B test (Email 1 subject):** 50/50 split — "Welcome to RealEstateFlow" vs "Add your first buyer in 90 seconds"

---

## Activation Email (separate trigger)

**Trigger:** PostHog `feature_first_use` OR first `buyer_added`  
**Subject:** You added your first {{entity}} — here's what's next  
**Not part of this 4-email sequence** — fire once on activation milestone.
