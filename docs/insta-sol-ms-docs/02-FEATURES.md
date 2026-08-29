# Instagram Local Agent — Feature Catalogue

Companion to `PLAN.md`. That document describes the 14 technical modules. This one
describes what an agency owner actually gets, why they care, and how each thing flows.

**Status column**
- ✅ Confirmed available on the official API
- ⚠️ Verify the exact endpoint/metric against the live API version at build time
- ☁️ Cloud lane only — runs server-to-server from RealtyFlow, never from the laptop
- 🔗 Bridge to an existing CRM flow — opt-in, built after v1 per the isolation rule
- ❌ Not possible, listed so nobody asks again

Running example throughout: **Rakesh**, Andheri West brokerage, 8,200 followers.

---

## G1 — Lead capture (the top of the funnel)

| # | Feature | Benefit to the agency | Status | Phase |
|---|---|---|---|---|
| F1 | Comment keyword → auto DM | 130 people comment "PRICE"; all 130 get a real DM in minutes instead of 4 he replies to by hand | ✅ | 3 |
| F2 | Story reply capture | Story replies open a fresh 24h window — the cheapest legal way to start conversations | ✅ | 3 |
| F3 | Story mention / share capture | Someone shares his listing to their story → he knows, and can thank them, which drives more shares | ⚠️ | 3 |
| F4 | First-DM auto-greeting | Someone DMs at 11pm and gets an instant qualified reply instead of silence until morning | ✅ | 3 |
| F5 | Missed-DM rescue queue | Every unanswered thread with a live countdown to window close — nothing worth ₹1.4 Cr rots in the inbox | ✅ | 2 |
| F6 | Phone capture + Indian mobile normalisation | "98123 45678", "+91 9812345678", "9812345678" all become one clean number | ✅ | 3 |
| F7 | Source attribution to the exact reel | Every enquiry carries which reel produced it | ✅ | 2 |
| F8 | Comment capture on boosted/ad posts | Paid campaign comments feed the same engine — no separate ManyChat setup for ads | ✅ | 3 |

**F1 flow — the lead engine**
```
Reel posted with "PRICE comment karo"
  → agent polls comments every 2-5 min
  → comment matches keyword rule
  → public reply: "DM kiya hai! 📩"     (looks responsive to everyone scrolling)
  → private_replies API opens a real DM   (legal for 7 days after the comment)
  → AI sends price + floor plan + one qualifying question
  → thread now in the 24h window, conversation continues
```

---

## G2 — Qualification and scoring

| # | Feature | Benefit | Status | Phase |
|---|---|---|---|---|
| F9 | AI qualification in Hinglish | Budget, area, buy/rent, timeline, loan need, possession — asked conversationally, not as a form | ✅ | 3 |
| F10 | Lead temperature (hot / warm / cold) | Rakesh works 6 hot leads instead of scrolling 60 DMs. Reuses the scoring rules already drafted in `TESTING_INSTAGRAM_LEAD_TEMPERATURE.md` | ✅ | 3 |
| F11 | Buyer / tenant / investor / seller classification | A rental enquiry never gets filed as a buyer again — the same bug the ManyChat webhook already had to fix | ✅ | 3 |
| F12 | Hinglish budget extraction | "1.4 tak", "1 cr ke around", "50 lakh max", "budget thoda tight hai" → a bracket | ✅ | 3 |
| F13 | Locality extraction + mapping | "Andheri West", "andheri w", "4 bunglow" → your existing Areas/Projects records | ✅ | 3 |
| F14 | Duplicate detection | Same person DMing from three different reels stays one enquiry, not three | ✅ | 3 |
| F15 | Timepass / spam filter | "bhai job hai kya", other brokers fishing for inventory, bots — filtered before they reach him | ✅ | 3 |

**F9 flow**
```
Inbound DM
  → AI reads full thread history + which reel they came from
  → asks ONE question at a time, in their language
  → after each reply, fills a field: intent → area → budget → timeline → loan
  → when phone is captured, enquiry record is written
  → temperature scored, pushed to CRM
```

---

## G3 — Conversation and replies

| # | Feature | Benefit | Status | Phase |
|---|---|---|---|---|
| F16 | AI draft with approve / edit / send | Rakesh clears 40 DMs in 6 minutes from a site visit, on his phone | ✅ | 3 |
| F17 | Auto-send for safe FAQ categories | Price, carpet area, floor, parking, possession date, location pin — answered instantly with no human in the loop | ✅ | 3 |
| F18 | Inventory-aware answers | "Andheri me 1.5 tak kuch hai?" → pulls 3 matching flats from the CRM into the reply | ✅ | 3 |
| F19 | Send brochure / floor plan / price list | Media attachments over the official API — no "WhatsApp par bhejta hoon" friction | ✅ | 3 |
| F20 | Site visit booking | Offers slots, captures the confirmed one, writes it to the enquiry | ✅ | 3 |
| F21 | Human handoff / escalation | AI stops and pings Rakesh when it is unsure, when someone is angry, or when the budget is above a threshold | ✅ | 3 |
| F22 | Working hours + out-of-office | "Abhi site pe hoon, 30 min me reply karta hoon" instead of dead air | ✅ | 3 |
| F23 | Language mirroring | Replies in whatever they wrote — Hindi, English, Hinglish, Marathi, Gujarati | ✅ | 3 |
| F24 | In-window follow-up nudge | At hour 20 of 24, one polite nudge before the window shuts forever | ✅ | 3 |
| F25 | Story-CTA re-engagement campaign | The **only legal way** to reach cold threads: post a Story asking them to reply, which reopens the window | ✅ | 3 |
| F26 | Saved reply templates | His own best answers, reusable, editable from the CRM | ✅ | 2 |
| F27 | Typing indicator + seen receipts | Conversations feel human, not robotic | ✅ | 3 |
| F28 | Handoff to WhatsApp | The actual Indian funnel: IG DM → phone number → WhatsApp, where deals really close | 🔗 | 4 |

**F25 flow — the honest answer to the backlog problem**
```
47 threads older than 7 days = permanently CLOSED to automated sending
  → agent generates a Story asset: "Purane DMs clear kar raha hoon —
     agar maine miss kiya ho toh is story pe RETRY reply karo"
  → Rakesh posts it (one tap)
  → each person who replies opens a NEW 24h window
  → agent instantly answers with the context from their old thread
```
This is the difference between a tool that gets him banned and one that works.

---

## G4 — Content intelligence

| # | Feature | Benefit | Status | Phase |
|---|---|---|---|---|
| F29 | Reel leaderboard ranked by **enquiries**, not views | The single most valuable screen. A 200k-view reel with 2 enquiries is a worse reel than a 12k-view one with 20 | ✅ | 2 |
| F30 | Full attribution chain | reel → views → comments → DMs → enquiries → site visits → deal | ✅ | 2 |
| F31 | Hook analysis | Which openings and captions actually produce comments, from his own data | ✅ | 4 |
| F32 | Content gap suggestions | "14 people asked about home loans this month and you have never posted about it" | ✅ | 4 |
| F33 | Hashtag performance on own posts | Which tags correlate with reach on his account specifically | ⚠️ | 4 |
| F34 | Best time to post | Derived from his own engagement history | ⚠️ | 4 |
| F35 | Competitor benchmarking | How his growth compares to 5 other Andheri brokers | ☁️ | 5 |

**F29 — what the screen looks like**
```
Reel                        Views    Comments   DMs   Enquiries   Hot
─────────────────────────────────────────────────────────────────────
2BHK Andheri W ₹1.4Cr       42,100      130      61       23       6
Rent 1BHK Lokhandwala       11,400       38      29       14       4
Market update video        204,000       91      12        1       0   ← vanity
Builder site walkthrough     8,900       22      18       11       3
```
The market update reel is the one he is proudest of and the one he should stop making.

---

## G5 — Audience and market intelligence

| # | Feature | Benefit | Status | Phase |
|---|---|---|---|---|
| F36 | Permanent follower/reach history | Instagram keeps ~90 days. We keep forever. After 6 months he has charts nobody else can show him | ✅ | 1 |
| F37 | Audience geography | 61% of his followers are Mumbai 25–34 — proof for the builder who wants to pay him for promotion | ✅ | 1 |
| F38 | Audience vs buyer mismatch | His followers are 22–28 but his buyers are 35–45 — he is building the wrong audience | ✅ | 4 |
| F39 | **Locality demand heatmap** | Which areas people actually ask about in DMs, ranked. Real demand signal, not listing supply | ✅ | 4 |
| F40 | Budget distribution of enquiries | His audience asks about ₹60–90L but he only posts ₹1.5 Cr+ inventory | ✅ | 4 |
| F41 | Trending questions this week | "9 people asked about possession delays in Lodha projects" | ✅ | 4 |

F39 and F40 are also the most valuable data **RealtyFlow** gets. Aggregated across
agencies (anonymised), they become a live demand index for Indian micro-markets — the
kind of thing 99acres and Housing sell, generated as a by-product of a free tool.

---

## G6 — Comment and reputation management

| # | Feature | Benefit | Status | Phase |
|---|---|---|---|---|
| F42 | Auto-hide competitor poaching | "DM me, same building cheaper" under his listing reels, gone within minutes. A constant, loud broker complaint | ✅ | 4 |
| F43 | Spam / scam comment removal | Loan scams and fake agents cleaned off his posts | ✅ | 4 |
| F44 | Auto-reply to genuine comments | Every comment answered lifts reach, and it is free | ✅ | 4 |
| F45 | Negative comment alert | Angry ex-client posting on a new reel → he is notified in seconds, not days | ✅ | 4 |
| F46 | Comment sentiment trend | Early warning that reputation is slipping | ✅ | 4 |

---

## G7 — Publishing

| # | Feature | Benefit | Status | Phase |
|---|---|---|---|---|
| F47 | Schedule reels / posts / carousels / stories | Post at the right time without being on his phone | ✅ | 4 |
| F48 | Auto-generate listing reels | New flat in the CRM → Remotion renders a reel → queued to publish. Ties `my-video/` into the product | 🔗 | 4 |
| F49 | Auto-story on new listing | Every new listing gets a story, automatically | ✅ | 4 |
| F50 | Publish from laptop | Large video files never touch our servers — our storage and egress cost stays at zero | ✅ | 4 |

---

## G8 — Team and operations

| # | Feature | Benefit | Status | Phase |
|---|---|---|---|---|
| F51 | Multiple Instagram accounts per install | Personal handle + brand handle, or one laptop running two partners' accounts | ✅ | 1 |
| F52 | Assign enquiry to a team member | Andheri leads to Priya, Bandra to Imran | ✅ | 4 |
| F53 | Response SLA tracking | Which of his 3 juniors is actually replying | ✅ | 4 |
| F54 | Daily digest | Morning message: "yesterday 12 enquiries, 3 unanswered, top reel: Andheri 2BHK" | ✅ | 2 |
| F55 | Local console | Everything above in one browser tab on `127.0.0.1`. No cloud needed to read his own inbox | ✅ | 1 |
| F56 | Full data export | His data is his — CSV/Excel out at any time | ✅ | 2 |
| F57 | Works offline | Laptop shut for a week? Local DB is the source of truth, syncs when it reconnects | ✅ | 2 |
| F58 | Push enquiry into the CRM | One button converts an Instagram enquiry into a real CRM lead. Kept manual in v1 so the existing lead pipeline stays untouched | 🔗 | 2 |

---

## G9 — Safety and compliance (the actual product moat)

| # | Feature | Benefit | Status | Phase |
|---|---|---|---|---|
| F59 | Window classifier | Every send checked against Meta's rules before it leaves. Cannot send illegally even if configured wrong | ✅ | 3 |
| F60 | Rate governor | Meta allows 750 private replies/hour; we cap at ~200 sends/hour with jitter | ✅ | 1 |
| F61 | Kill switch | One click stops all automation, instantly | ✅ | 1 |
| F62 | Full audit log | Every API call and every message, logged locally. If Meta ever asks, there is an answer | ✅ | 1 |
| F63 | Dry-run mode | See exactly what would be sent before anything is sent | ✅ | 1 |
| F64 | Token health monitoring | Warns 10 days before expiry instead of failing silently | ✅ | 1 |

---

## What we deliberately will not build

Every one of these is what actually gets Instagram accounts restricted, and none of
them has an official API. Saying no to them is the reason the tool is safe.

| ❌ | Why not |
|---|---|
| Mass/cold DM sending | No API, and the fastest route to a permanent ban |
| Auto follow / unfollow | No API. Classic bot signature |
| Auto-like / auto-view | No API |
| Scraping follower lists | No API, and browser scraping is what gets accounts killed |
| Scraping other accounts or hashtags from the laptop | Cloud lane only (☁️), never from an agency's session |
| Bypassing the 24h window with the HUMAN_AGENT tag on autopilot | Meta's policy says human-only, and they detect misuse. Ours requires a human click |
| Multi-account posting from one session | Ban signature |
| Buying followers/engagement | Obviously |

---

## Why this is worth building — the two sides

**For the agency**

1. Replaces a ₹2,000–8,000/month ManyChat subscription with something free that also
   understands real estate.
2. Answers every DM and comment within minutes, at 11pm, on a Sunday, in Hinglish.
3. Tells them which reel produced money — nothing else in this market does that.
4. Keeps analytics history that Instagram itself deletes after 90 days.
5. Runs on their own laptop with their own account, so nothing they care about is
   sitting in a stranger's cloud.

**For RealtyFlow**

1. A free wedge product that installs our software on the agency's desktop before they
   ever pay us. Distribution, not just a feature.
2. Compute cost near zero — their laptop does the API calls, storage and video upload.
3. An owner opening our console every morning is an owner we can sell the CRM to.
4. Aggregated, anonymised demand data (F39, F40) across every install becomes a market
   index we own and nobody else has.
5. It replaces a real line item in their budget, which makes the sales conversation
   about money saved rather than money spent.

---

## Phase map

| Phase | Features | What Rakesh can do |
|---|---|---|
| **1** | F36, F37, F51, F55, F60–F64 | Connect his account, see permanent follower/reach/audience data in a local console. Safety rails live from day one. |
| **2** | F5, F7, F26, F29, F30, F54, F56, F57, F58 | See his full DM history, the reel leaderboard, daily digest, and push enquiries into the CRM by hand. **First real laptop → CRM value.** |
| **3** | F1–F4, F6, F8–F25, F27, F59 | The lead engine. Comment-to-DM, AI qualification, window-safe replies. **This is the ManyChat replacement.** |
| **4** | F28, F31–F34, F38–F50, F52, F53 | Content intelligence, comment moderation, publishing, team routing, WhatsApp handoff. |
| **5** | F35 | Competitor benchmarking via the cloud lane. |
