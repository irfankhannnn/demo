# 02 - Audience & Pain Research

Source material for every hook in this pack. If a script feels weak, come back here and pick a
sharper pain. Research pass run 6 Aug 2026; sources listed in §5.

---

## 1. The 20 real pains of an Indian agency owner

Ranked by **content potential** = (how deeply it hurts) × (how rarely anyone says it out loud).
Tier A is where the breakout reels come from.

### TIER A - high pain, almost nobody talks about it

**A1. The employee leaves and takes the client list with him.**
Every contact lived in *his* personal WhatsApp. He resigns on Monday; by Friday he is calling your
owners from his own number. You built that relationship. You paid for that lead. You cannot even
prove it was yours.
→ *This is the single most under-served pain in Indian broking. Use it early and use it hard.*
→ Product answer: contacts, leads and history live in the agency's tenant, not a person's phone.

**A2. You cannot answer "how many live deals do I have right now?"**
Not in 10 minutes. Not accurately. You would have to scroll four WhatsApp groups and ask three
people. A business doing ₹50L-₹2Cr a year, and the owner cannot state its position.
→ Product answer: `get_pipeline_summary`, `get_business_health`, dashboard.

**A3. Two of your agents call the same client on the same day.**
The client now thinks your agency is amateur. Your two agents now think each other is a thief. You
find out only when someone shouts.
→ Product answer: lead ownership + assignment.

**A4. You owe money and you don't remember to whom.**
₹15,000 security deposit to an owner. ₹8,000 deep-cleaning you promised to adjust. A brokerage split
with a sub-broker. It is all in your head, and your head is full.
→ Product answer: Khata Book - To Give / To Take, per party, per property, with settlement status.

**A5. The buyer no longer needs you to find the builder.**
RERA transparency and portals mean buyers reach developers directly. Access used to be the product.
Access is now free. If your only value was "I know the builder," your fee is under attack.
→ *The most strategically important post of the month. Reframes them from gatekeeper to operator -
which is exactly the person who buys an OS.*

### TIER B - high pain, widely felt, still fresh if said specifically

**B1.** Lead lands at 11:47 PM. You reply *"kal call karta hoon."* You don't. Three months later he
buys through someone else. You never even learn you lost him.

**B2.** *"Woh Andheri wali agreement kahaan hai?"* - the PDF is in a WhatsApp chat from seven months
ago, 4,000 messages up. Twenty minutes gone, in front of a client.

**B3.** Your phone dies, or you switch phones and the backup is broken. Your entire business was in
one app on one device.

**B4.** Rent due dates for 30 managed properties, tracked in a diary and your memory. One slip and
an owner calls you angry about *his own* money.

**B5.** The owner asks *"mere flat pe kitne visits hue?"* You have no idea. You guess. He hears the
guess.

**B6.** Security-deposit refund fight with a tenant. He says ₹10,000 deduction, you say ₹18,000.
Neither of you wrote anything down. You eat the difference to end the argument.

**B7.** You send a 2BHK to a client who told you 3BHK - three weeks ago, in a message you never
recorded. He stops replying.

**B8.** You answered 200 WhatsApp messages today and closed nothing. You cannot point at one thing
that moved forward.

### TIER C - real, useful, lower ceiling

**C1.** New joinee takes 3 months to be useful because nothing is written down.
**C2.** Festival-season surge: 3× the leads, same brain, worse follow-up.
**C3.** Commission split disputes with sub-brokers, verbal, unrecorded.
**C4.** RERA registration and record-keeping obligations that vary by state.
**C5.** You are the bottleneck - nothing happens in the agency unless you are in the loop.
**C6.** Follow-up depth: most deals need many touches, most brokers stop after one or two.
**C7.** No idea which lead source actually produced revenue, so ad spend is guesswork.
**C8.** Cannot check a client's history while standing on a site visit.

---

## 2. Pain → product mapping (verified against the codebase)

Every claim below is backed by a feature that actually exists. Do not script a capability that is
not on this table.

| Pain | Real feature | Verified in |
|------|--------------|-------------|
| A1 employee takes contacts | Multi-tenant CRM - leads/buyers/owners/tenants/contacts owned by the agency | `server/agents`, tenant-scoped tables |
| A2 no pipeline visibility | `get_pipeline_summary`, `get_business_health`, `get_crm_metrics`, `get_dashboard_snapshot` | `server/shared/toolDefinitions.js` |
| A3 duplicate calling | Lead assignment + ownership, `update_lead` | CRM lead module |
| A4 who do I owe | **Khata Book** - `TO_GIVE`/`TO_TAKE`, party type, per-property, settlement status, reminders | `real-estate-crm-app/src/types/khata.ts` |
| B1 missed follow-up | `get_followup_summary`, `get_priority_leads`, `suggest_next_actions`, `get_daily_brief` | tool definitions |
| B2 lost documents | `create_property_document`, `get_property_documents` | tool definitions |
| B4 rent reminders | Khata `reminderAt` + notification service | `server/notificationDynamodbService.js` |
| B5 visit history | Notes + meetings per entity (`get_owner_notes`, `get_upcoming_meetings`) | tool definitions |
| B6 deposit disputes | Khata categories: Security Deposit, Deep Cleaning, Repair, Maintenance + line items | `khata.ts` |
| B7 requirement mismatch | Buyer records with BHK/budget/location/furnishing | `search_buyers` schema |
| B8 busywork | `get_daily_brief` - one message, whole day | tool definitions |

**Khata Book categories (exact, use these words on screen):**
Brokerage · Maintenance · Deep Cleaning · Repair · Security Deposit · Rent · Utility Bills · Other

---

## 3. ★ The buried gold: the AI speaks Hinglish natively

The agent's router recognises Hindi vocabulary directly. These are **real keywords in the shipped
code**, not marketing invention:

> `kharidar` (buyer) · `kirayedar` (tenant) · `makan` (property) · `malik` (owner) ·
> `sampark` (contact) · `milan` (meeting) · `kitne` / `kitni` (how many) · `dikhao` (show me)

Meaning an agency owner can type, in his own language, into the WhatsApp he already uses:

```
"Andheri ke kharidar dikhao"
"Kitne leads pending hain?"
"Aaj ka brief do"
"Malik ko kitna dena hai?"
```

…and get **live data out of his own CRM**, back in Hinglish.

**This is the most demo-able, least replicable thing the company owns.** Every competitor claims
"AI-powered." Nobody can show an Indian broker typing Hindi into WhatsApp and getting his real
pipeline back. Week 4 is built entirely around this.

---

## 4. Hook bank

Pull from here whenever a script needs a stronger opening. 1.5 seconds to land.

### Pain hooks (Hinglish)
1. "Aapka employee resign karta hai. Uske phone mein aapke 400 client the."
2. "Raat ke 11:47. Lead aaya. 'Kal call karta hoon.' Kal kabhi nahi aaya."
3. "Abhi bataiye - aapki agency mein kitni deal live hai? Sochna pada? Wahi problem hai."
4. "Aapko yaad hai aap kis owner ka pandrah hazaar daba ke baithe ho?"
5. "Client saamne baitha hai. Aap 4,000 message upar scroll kar rahe ho."
6. "Aapka poora business ek phone ke ek app mein hai. Phone gir gaya toh?"
7. "Do agent, ek client, ek din. Client ne aapki agency ko amateur samajh liya."
8. "Owner ne pucha 'kitne visit hue?' Aapne guess kiya. Usne guess sun liya."
9. "Aaj 200 message ka reply diya. Ek deal aage badhi? Nahi."
10. "Deposit ka jhagda. Usne kaha das hazaar. Aapne kaha atthara. Likha kisi ne kuch nahi."

### Category / authority hooks
11. "Har CRM India mein fail hota hai. Kyunki broker WhatsApp nahi chhodta."
12. "Buyer ab builder tak aapke bina pahunch jaata hai. Aapki value ab access nahi - service hai."
13. "WhatsApp aapka darwaza hai. Aapka daftar nahi."
14. "System ka matlab software nahi hai. System ka matlab - aapke bina bhi kaam chale."
15. "Aapki agency badi nahi ho rahi. Aapka chaos bada ho raha hai."
16. "Aap agency nahi chala rahe. Aap 14 ghante ka customer support kar rahe ho."

### Product / magic hooks
17. "Maine apne CRM ko WhatsApp pe message kiya. Usne jawab de diya."
18. "'Andheri ke kharidar dikhao' - Hindi mein type kiya. Data aa gaya."
19. "Naya employee. Wahi WhatsApp. Zero training. Kabhi chutti nahi."
20. "Aapka CRM aapko subah 9 baje WhatsApp pe brief bhejta hai. Aapko kholna bhi nahi padta."

### Money hooks
21. "Aapki agency paisa nahi kama rahi. Aapki agency paisa gira rahi hai."
22. "Aapko pata hai kitna aaya. Aapko nahi pata kitna aana tha. Farq hi loss hai."
23. "To Give. To Take. Do column. Aapki poori agency inhi do column mein hai."

---

## 5. Sources

Market and audience context gathered 6 Aug 2026. **Treat every statistic in these as unverified
for publication** - see `14-METRICS-CLAIMS-REVIEW.md` §2 before putting any number on screen.

- [8 Challenges Faced by Real Estate Brokers in India](https://www.sell.do/blog/challenges-faced-by-real-estate-brokers) - lead scatter, follow-up failure, agent retention
- [How Real Estate Brokerage Works in India (2026 Guide) - RE/MAX](https://remax.in/blog/how-real-estate-brokerage-works-in-india-2026-guide-20)
- [RERA 2.0 Explained - broker obligations 2026](https://propertiezzzz.com/rera-2-0-explained-what-every-buyer-builder-broker-must-know-in-2026/)
- [How To Become A Real Estate Agent In India 2026 + RERA rules - TeleCRM](https://telecrm.in/blog/how-to-become-a-real-estate-agent-in-india/) - state registration, 5-yr validity, ₹10k-₹50k
- [JLL India Residential Dynamics Q1 2026](https://www.jll.com/en-in/insights/market-dynamics/india-residential) - Mumbai/Pune volume concentration
- [Global Property Guide - India rental yields](https://www.globalpropertyguide.com/asia/india/rental-yields) - avg gross yield ~5.16% (Q2 2026)
- [India Property Market Report 2026 - AI-Ghar](https://www.ai-ghar.com/blog/india-property-market-report-2026-ai-ghar) - direct-to-builder search behaviour (single-source, unverified)
- [Cushman & Wakefield India Outlook 2026](https://www.cushmanwakefield.com/en/india/insights/india-outlook)
- [Instagram Reels for Real Estate 2026 - Krista Mashore](https://blog.kristamashore.com/articles/instagram-reels-strategy-real-estate-2026) - format/cadence benchmarks (US B2C; treat as directional only)

**Important caveat on the last source and its cousins:** almost all published "real estate
Instagram" advice is written for US agents marketing *to home buyers*. We are an Indian B2B brand
marketing *to agency owners*. Listing reels, neighbourhood tours and open-house content do not
apply to us and must not be copied. Only the mechanical benchmarks (length, cadence, saves as a
signal) transfer.
