# 04 — GTM OS Deep Dive (Layer 2)

> File 03 introduced GTM OS in one page. This is the detailed tour of its **4 sub-systems** and the exact files inside each.

GTM OS = *get the content in front of the right person and turn them into a customer.* Four sub-systems, each a folder:

```
attention-os/     win the scroll
distribution-os/  publish per platform
sales-os/         convert lead → customer
automation-os/    run it without manual work
```

---

## 1. attention-os/ — winning attention

Before distribution, you must *deserve* the scroll-stop. These files define how.

| File | What it answers |
|---|---|
| `attention-model.md` | The theory: how attention is earned in a feed (pattern-break → hook → hold) |
| `audience-research.md` | Where your audience already hangs out + what they react to |
| `content-to-conversation.md` | Turning a passive view into a DM/comment/reply |
| `virality-engine.md` | What makes a post shareable (the share triggers) |
| `retention-engine.md` | Keeping attention *across* posts so followers come back |

**Flow:**

```
Pattern-break visual  →  Hook (HK-*)  →  Hold (value)  →  Conversation (comment/DM)
   "stop scrolling"      "read this"     "stay"            "engage"
```

**Example:** A reel opens with "₹2 crore deal Excel mein? 😳" (pattern-break + hook), shows the chaos, then the clean dashboard (hold), ends with "Comment 'DEMO' 👇" (conversation). That last line is straight from `content-to-conversation.md`.

---

## 2. distribution-os/ — publishing per platform

The same asset, re-tuned for each channel. One file per platform sets the rules.

| File | Platform rules it holds |
|---|---|
| `instagram.md` (+ `instagram/`) | Feed/Reels/Stories formats, cadence, peak times |
| `facebook.md` | Longer captions, group strategy, ad-ready posts |
| `linkedin.md` | English-first, professional tone, B2B timing |
| `youtube.md` | Shorts + long-form, SEO title/desc/tags |
| `whatsapp.md` (+ `whatsapp/`) | Broadcast lists, status, 1:1 follow-up |
| `founder-brand.md` / `founder-engine.md` | Posting from the **founder's** personal account (often out-reaches the brand account) |

**Why a "founder engine"?** In Indian B2B, a real person's account usually beats a logo. `founder-engine.md` is the playbook for the founder to post consistently and build trust that the brand page can't.

**Flow — one asset, four channels:**

```
ig-post-chaos-control-01.png
 ├─ Instagram → Hinglish caption, 9 AM Tue, link in bio
 ├─ Facebook  → longer story + boost ₹500/day
 ├─ LinkedIn  → English rewrite, 8 AM, no emojis
 └─ Founder   → personal "main bhi yahi galti karta tha…" angle
```

---

## 3. sales-os/ — converting the lead

A lead is not a customer. This folder is the **scripted path** from interest to paid.

```
qualification.md   → is this lead worth time? (budget, team size, intent)
demo-script.md     → how to run the product demo
objections.md      → answers to "too costly / no time / WhatsApp is fine"
closing-script.md  → ask for the sale
followup-script.md → the 7-touch nudge sequence
onboarding-script.md → first-week setup so they don't churn
customer-journey.md → the full map tying it all together
```

**Flow:**

```
Lead → Qualify → Demo → Handle objection → Close → Onboard → Retained customer
       (skip bad fits)         (most deals die here)        (week-1 = churn risk)
```

**Example objection (from `objections.md`):**
> *"WhatsApp se hi kaam chal raha hai."*
> → "Bilkul chalega — 10 leads tak. Par 50 leads pe kaunsi follow-up reh gayi, yaad rahega? RealtyFlow yaad rakhta hai."

---

## 4. automation-os/ — running it hands-free

The glue. Defines which steps happen *automatically* vs by hand.

| File | Purpose |
|---|---|
| `architecture.md` | How the automation layer is wired together |
| `workflow-map.md` | Every automated workflow, end to end |
| `integrations.md` | What connects to what (CRM, WhatsApp, forms, ads) |
| `implementation-plan.md` | Build order — what to automate first |

**Example automation (from `workflow-map.md`):**

```
New lead fills realtyflow.in/trial form
   ↓ (automatic)
Added to CRM + tagged with source post (OPP-*)
   ↓ (automatic)
WhatsApp welcome message fires
   ↓ (automatic)
Day 2 no-demo? → followup-script.md nudge sent
   ↓ (manual)
Sales rep runs demo
```

Note the mix: automation handles capture + nudges; humans handle the demo. `implementation-plan.md` tells you what's safe to automate first (capture + tagging) before the harder stuff.

---

## How GTM OS connects up and down

```
Layer 1 (Content OS)  →  gives GTM the asset + caption
Layer 2 (GTM OS)      →  attention → distribution → sales → automation
Layer 3 (Growth)      →  reads GTM's results, says what to do more of
```

Every published post should carry an **`OPP-*` tag** so Layer 3 can trace it back to leads and revenue (see file 05).

→ Next: **05-growth-platform-deep-dive.md** (measuring it all + cloning for new businesses).
