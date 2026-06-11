# Pricing Page Copy — RealEstateFlow

**URL:** `https://realestateflow.in/pricing/`  
**Canonical source:** `marketing-and-sales/launch-plan-v2/pricing.json`  
**Last updated:** 2026-06-11

---

## Hero

### H1
Honest pricing for honest brokers.

### H2
₹999 to start. ₹7,999 to hire an AI. No surprises, no hidden fees.

### Trust strip
14-day free trial · No card required · 1-month money-back · GST invoices (HSN 998314) · Data stays in India

### CTAs
- **Primary:** Start 14-day Free Trial → `/signup`
- **Secondary:** Talk to a human → `/demo` (Cal.com)

---

## Annual / Monthly Toggle

**UX spec:** Pill switcher centred above tier cards. Default = **Monthly**.

When **Annual** is selected:
- Show annual price with "Save 20%" badge
- Show monthly equivalent in smaller text below
- AI Employee card shows: "Annual billing not available"

**Annual prices (excl. GST):**
| Plan | Monthly | Annual (20% off) | Monthly equivalent |
|------|---------|------------------|-------------------|
| Solo | ₹999/mo | ₹9,590/yr | ₹799/mo |
| Team | ₹1,999/mo | ₹19,190/yr | ₹1,599/mo |
| Team+ | ₹1,999/mo base | ₹19,190/yr base | ₹1,599/mo base |

*Seat add-ons on Team+ billed monthly at ₹500/seat regardless of annual base plan.*

---

## Tier Cards

### Card 1 — Solo

**Price:** ₹999/month + 18% GST  
**Badge:** 14-day free trial · No card required

**Best for:** Solo brokers managing their own leads, properties, and Khata book.

**Features:**
- 1 member, unlimited properties, full CRM
- Tenants, Owners, Properties, Buyers, Leads
- B2B Leads, Khata Book + Settlement
- Calendar, Hierarchy, Business Analytics
- Rented Properties
- Phone OTP auth, Invite & Member management
- GST invoicing, 1-month money-back
- Free onboarding, training videos, chat & email support

**CTA:** Start free trial → `/signup?plan=solo`

---

### Card 2 — Team ⭐ Most Popular

**Price:** ₹1,999/month + 18% GST  
**Badge:** 14-day free trial · No card required

**Best for:** 2–3 agent agencies sharing leads and Khata book.

**Features:**
- Everything in Solo
- Up to 3 team members
- Member-level activity reports
- Multi-agent Hierarchy view
- Shared Khata book

**CTA:** Start free trial → `/signup?plan=team`

---

### Card 3 — Team+

**Price:** ₹1,999/month + ₹500/seat for 4+ members + 18% GST  
**Badge:** 14-day free trial · No card required

**Best for:** Growing agencies with 4–10+ agents.

**Features:**
- Everything in Team
- ₹500/month per additional member, prorated
- Unlimited members
- Priority chat support

**CTA:** Start free trial → `/signup?plan=teamplus`

---

### Card 4 — AI Employee

**Price:** ₹7,999/month + 18% GST  
**Badge:** Paid from Day 1 — concierge setup within 24h · **No trial · No refund**

**Best for:** Agencies that want an AI teammate on WhatsApp + Telegram.

**Features:**
- Standalone AI Employee (1 per agency)
- Runs CRM via WhatsApp + Telegram
- Qualifies inbound leads automatically
- Sends follow-ups + meeting reminders
- Updates Khata book + settlement
- Concierge setup (24h SLA)
- Loom walkthrough on go-live

**Requires:** Active Solo, Team, or Team+ subscription.

**CTA:** Add AI Employee → `/ai-employee` (contact form + concierge flow)

---

## Add-on Box (below tier cards)

> **Add AI Employee — ₹7,999/mo**  
> Works on WhatsApp + Telegram. Concierge setup within 24 hours.  
> Requires an active Solo, Team, or Team+ plan. No trial — paid from Day 1.

---

## Comparison Table

| Feature | Solo | Team | Team+ | + AI Employee |
|---------|------|------|-------|---------------|
| **Monthly price (excl. GST)** | ₹999 | ₹1,999 | ₹1,999 + ₹500/seat | + ₹7,999 |
| **Members included** | 1 | 3 | 3 (+ unlimited add-on) | — |
| **Properties** | Unlimited | Unlimited | Unlimited | — |
| **Full CRM modules** | ✅ | ✅ | ✅ | ✅ via WhatsApp |
| **Multi-agent hierarchy** | — | ✅ | ✅ | ✅ |
| **Business analytics** | ✅ | ✅ | ✅ | ✅ |
| **Khata book + settlement** | ✅ | ✅ Shared | ✅ Shared | ✅ Auto-updated |
| **AI Employee add-on** | Optional | Optional | Optional | ✅ |
| **GST invoices (HSN 998314)** | ✅ | ✅ | ✅ | ✅ |
| **Support** | Chat + email | Chat + email | Priority chat | Concierge + chat |
| **14-day trial** | ✅ | ✅ | ✅ | ❌ |
| **30-day money-back** | ✅ | ✅ | ✅ | ❌ |

---

## Trust Badges

- **Mumbai-built** — designed for Bandra, Andheri, Powai brokers
- **GST 18%** — HSN 998314 on every invoice
- **Data in India** — AWS Mumbai (ap-south-1)
- **1-month money-back** — Solo, Team, Team+ (first-time subscribers)
- **Razorpay secure** — UPI, card, net banking, wallet

---

## FAQs

### 1. How does the refund work?

Solo, Team, and Team+ come with a **30-day money-back guarantee** for first-time subscribers. Request a refund within 30 days of your first paid charge via [info@realestateflow.in](mailto:info@realestateflow.in) or **Settings → Billing**.

Refunds are **denied** if you exported more than 100 records or sent more than 50 outbound WhatsApp messages during your trial — this prevents abuse.

**AI Employee is non-refundable** because each instance requires manual concierge configuration (sunk cost from Day 1).

Refunds process in **7–10 working days** to your original payment method via Razorpay. Full details: [Refund Policy](/legal/refund).

---

### 2. Do I get a GST invoice?

Yes. Every payment generates a GST invoice with **HSN 998314**. Your invoice includes our GSTIN, your billing GSTIN (if provided), place of supply, and CGST+SGST (Maharashtra) or IGST (inter-state) split.

Download invoices from **Settings → Billing** in the CRM.

---

### 3. What if I add a 4th team member mid-month?

Your plan automatically upgrades to **Team+**. We charge **₹500 prorated** for the remaining days in your billing cycle, then ₹500/month per additional seat thereafter. The in-app upgrade flow handles this — no sales call needed.

---

### 4. Why is there no trial on AI Employee?

Each AI Employee is configured by hand by our support team within a **24-hour SLA** — WhatsApp setup, lead qualification rules, Khata book mapping, and a Loom walkthrough. That concierge cost is real and sunk from Day 1.

We'd rather charge fairly upfront than build trial-abuse safeguards. If your AI Employee isn't running **30 days** after purchase due to our failure, we'll refund pro-rata for the undelivered period.

---

### 5. What happens to my data if I cancel?

You can export your full CRM data as CSV from **Settings → Data Export** while your account is active and for **30 days** after cancellation. After 30 days, we delete your data per our [Privacy Policy](/legal/privacy).

No lock-in. No hostage data.

---

## Footer CTA

### Recap line
14 days. No card. Cancel anytime.

### Primary CTA
**Start free trial** (large button) → `/signup`

### Tertiary links
- [Compare to Sell.do](/vs/sell-do)
- [Compare to Zoho CRM](/vs/zoho-crm)
- [Talk to founder on WhatsApp](https://wa.me/{{WHATSAPP_NUMBER}})

### Legal footer links
[Terms](/legal/terms) · [Privacy](/legal/privacy) · [Refund](/legal/refund) · [Cookies](/legal/cookies) · [Grievance Officer](/grievance)

---

## Microcopy Notes (for implementation)

- All prices display as: `₹{price}/mo + 18% GST` (monthly) or `₹{annualPrice}/yr + 18% GST (save 20%)` (annual)
- AI Employee price always shows: `+ ₹7,999/mo (no trial)`
- GST line appears above CTA on every tier card
- "Most Popular" ribbon on Team card only
- Mobile: cards stack vertically; comparison table scrolls horizontally
