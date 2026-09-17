# WhatsApp — community

A WhatsApp Community for engaged brokers — **"RealEstateFlow Brokers Club"** — built as a retention and word-of-mouth engine. Pairs with `referral.md`, `customer-success.md`, `../virality-and-retention.md` §5 and the Instagram broadcast channel.

> **Why a community:** peer validation beats every other trust signal in this market (`../../10-audience-and-voice/market-research.md` §2.2, §9.2). Brokers already live in WhatsApp groups; a *better-run* group — value first, zero spam, no poaching — becomes the room they do not want to leave, which is retention the algorithm cannot take away.

> **Which number runs the community is not settled.** The product's WhatsApp is a self-hosted Baileys service used as the agency's own command channel today (`platform/whatsapp-platform/`), and a community run from a personal or self-hosted number carries ban risk at volume. See `README.md` in this folder and `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`.
>
> Open decision D29c — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 1. Purpose & structure

WhatsApp **Community** (the umbrella) with structured sub-groups:

| Group | Type | Who posts | Purpose |
|---|---|---|---|
| **📢 Announcements** | admin-only | founder/team | tips, feature drops, RERA news, event invites |
| **💬 Broker Adda** | open, moderated | members | peer Q&A, follow-up help, deal-doubt resolution |
| **🏆 Wins** | semi-open | members + team | member wins, shared by the member, with consent |

Start with Announcements plus one discussion group; split by topic only once there are more than 150 active members.

**The Wins group opens only after there are paying customers.** Pre-launch there is nothing to put in it, and seeding it with invented "closed via the app" stories is exactly the fabrication the claims policy forbids (`../../10-audience-and-voice/claims-and-proof-policy.md`). A Pune sub-group is out of scope while M1 is Mumbai only (D24).

## 2. Rituals (predictability = retention)

| Day | Ritual | Format |
|---|---|---|
| **Mon** | "Pipeline Cleanup" tip | text + 1 action ("aaj 5 dead leads close-mark karo") |
| **Tue** | Open doubt thread | "Aaj koi bhi sawaal poocho — community jawab degi" |
| **Wed** | Member spotlight (once there are members with wins) | screenshot + 2-line story, **with written consent** |
| **Thu** | Product tip | short clip or screenshot of a real feature |
| **Fri** | Build-in-public + feature drop | clip + what shipped |
| **Monthly** | Founder voice-note AMA | 30-minute Q&A, pin the replies. Voice note or text — never video |

## 3. Verbatim ritual messages

**Monday Pipeline Cleanup:**
> "Monday cleanup time 🧹 Apne CRM mein jao, 5 sabse purane 'pending' leads dhundo. Har ek ko ek line bhejo ya close-mark karo. Pipeline saaf = dimaag saaf. Kitne clear kiye? Reply karo 👇"

**Wednesday spotlight (template — needs a real member and their consent):**
> "Is hafte ka spotlight: {{member name}} — {{what they did, in their own words, shared with permission}}. 👏 Apni win share karni ho toh Wins group mein daalo."

Do not fill this template with an example. Until a member supplies one, run a product tip in the slot instead.

**Thursday product tip:**
> "Aaj ka tip: site visit ke turant baad CRM mein note aur next date daal do. Deal visit ke baad follow-up mein banti hai. Try karke batao!"

*(This was a Marathi-language tip for the Pune sub-group. The Marathi line is parked with the rest of the Pune scope under D24; the tip itself works in Hinglish.)*

## 4. Rules (pin these)
1. **Value first.** No "buy now" spam.
2. **No broker-vs-broker poaching** — koi kisi ke agent/client ko target nahi karega.
3. **No unrelated promos / chain forwards.**
4. **Respect** — koi sawaal chhota nahi.
5. Breaking → warning → remove. Light but firm moderation keeps signal high.

## 5. Growth tactics
- "Join the Club" CTA in IG bio + Stories (CTA-COMMUNITY-013), demo/trial follow-ups, founder broadcast.
- Members-only perks advertised publicly: early features, free lead magnets, a trial extension on whatever terms `../../pricing.json` supports (CTA-COMMUNITY-047), the monthly AMA.
- Invite-a-peer nudge → ties to referral loop. Founder personally welcomes each new joiner by name.

## 6. Conversion mechanics
Community is TOFU/retention, **not** a pitch room — conversion is *earned* via value:
- Genuine help in Broker Adda → DM the most engaged → soft DEMO offer.
- Wins group (once it exists) → real peer proof → "main bhi try karun?" inbound → route to `lead-nurture.md`.
- Members are the **prime referral source** once referrals exist → `referral.md`.
- One in-community trial offer a month converts lurkers, on `../../pricing.json` terms.

## 7. Metrics

Members, **active %** (posted or reacted in 7 days, target >25%), messages per week, new joins per week, community → demo, community → referral, leave rate. Definitions in `../../50-measurement/metric-dictionary.md`; reported in `../../50-measurement/weekly-scorecard.md`. A quiet group needs a ritual or a provocative doubt thread — never let it become a ghost town.
