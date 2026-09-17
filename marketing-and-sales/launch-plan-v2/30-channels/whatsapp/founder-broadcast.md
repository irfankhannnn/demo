# WhatsApp — founder broadcast

A **consented broadcast list** of warm followers and leads the founder nurtures personally. This is the founder's owned audience — the one distribution surface Meta cannot throttle. Pairs with `../founder-presence.md` and the Instagram broadcast channel (`../virality-and-retention.md` §5).

> **Why it matters:** brokers spend hours a day on WhatsApp (`../../10-audience-and-voice/market-research.md` §3.2) and trust a real banda over a logo (`README.md` §1). A founder voice note at 8 AM out-converts an ad. Keep claims at the workflow level — what the product does — never at the outcome level.

> **Which number sends this is not settled.** A broadcast list from a self-hosted, QR-linked number has no template gate and a real ban risk at volume; the Cloud API path is planned in `docs/realestateflow-vision/39-whatsapp-official-api-plan.md`.
>
> Open decision D29c — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 1. Build the list (opt-in only)

| Source | How they opt in | Tag |
|---|---|---|
| IG DM handoffs (warm) | "WhatsApp pe broker tips bhej dun? Reply HAAN" | `bc-ig` |
| Demo no-shows / not-yet-ready | "Pressure nahi — weekly tips list pe rakh dun?" | `bc-demo` |
| Trial + paying users | auto-offer at onboarding | `bc-customer` |
| Community members | pinned join message | `bc-community` |
| Event / meetup contacts | QR → "Save number → reply START" | `bc-event` |

Rules: **explicit opt-in always** — never scrape a group. Save each contact, because a broadcast list only delivers to people who saved your number. A broadcast list caps at about 256 contacts, so run several by segment. M1 is Mumbai only (D24). A WhatsApp Channel can run in parallel for one-to-many at scale — no save needed, but less intimate.

## 2. Content mix (value : promo ≥ 4 : 1)

| Slot | Type | CT-* / source | Example |
|---|---|---|---|
| 2–3×/wk | One sharp tip | CT-EDU repurposed | "Aaj ka 1 tip: har lead pe next-action date likho — warna woh follow-up reh jaata hai." |
| 1×/wk | Behind-the-scenes build | CT-AUTHORITY | voice note: "Yeh hafta khata book ka naya settlement flow bana rahe hain. Aapko kya chahiye, batao." |
| 1×/wk | What shipped this week | CT-DEMO `[REC]` | "Is hafte AI Employee mein yeh add kiya — 40 second ka recording 👇" |
| weekly | Poll / question | engagement | "Reply with your #1 pain: 1) Lead leak 2) Follow-up 3) Commission hisaab" |
| 1 in 5 | Soft demo/trial nudge | CT-DEMO | "Jisko AI Employee live dekhna ho, reply DEMO — Hindi mein dikha dunga." |

## 3. Verbatim broadcast templates

**Monday tip (hi-dominant):**
> "Subah ka 1 tip 👇 Jis lead se kal baat hui, usko *aaj ek line* bhejo — 'sir, woh flat available hai, dekhna chahenge?'. 90% deals follow-up se banti hain, lead se nahi. Try karke batao. — {{founder}}"

**Build-in-public (founder voice):**
> "Sach bataun? Brokers se baat karke ek cheez baar-baar sunne ko mili — commission ka hisaab sabse bada sirdard hai. Toh khata book mein settlement ka naya flow bana diya. Jo try karna chahe, reply KHATA 🙏"

Send that line only if those conversations actually happened. The June draft said "pichhle mahine 3 agencies ne bola", which is a specific, checkable claim nobody can check.

**Marathi handshake (parked — Pune is out of M1 scope, D24):**
> "Namaskar 🙌 Aajcha tip: pratyek lead la 'next follow-up date' lava — Excel athvun det nahi, system deto. Try kara, sanga kasa vatla. — {{founder}}"

**Promo (1-in-5, soft):**
> "Koi pressure nahi — par jisko 90-second walkthrough chahiye, reply DEMO. Main khud dikhata hoon, sales pitch nahi 😊"

## 4. Tone & timing
- **Tone:** Hinglish, personal, like a smart broker friend — first name where possible, one emoji max, never a marketing blast. Voice notes 1–2×/week (highest trust, hardest to fake).
- **Cadence:** 2–3 broadcasts/week. **Windows:** 8–9 AM (coffee scroll) or 8–9 PM (wind-down), IST (`../../10-audience-and-voice/market-research.md` §3.2, §12). Never overlap two broadcasts in a day — over-messaging kills opt-in.

## 5. 4-week example calendar

| Week | Mon | Wed | Fri |
|---|---|---|---|
| 1 | Follow-up tip | Build-in-public (khata) | What shipped + screen recording |
| 2 | Lead-leakage math (their numbers) | Poll: biggest pain | Product recording |
| 3 | RERA/news drop (CT-NEWS) | BTS voice note | Soft DEMO nudge |
| 4 | Khata tip | Build-in-public | "Reply with your goal for next month" |

## 6. Growth → conversion loop
Grow the list from the Instagram bio ("WhatsApp tips → link"), demos, trials and events. Convert: the warm list → DEMO/TRIAL (one nudge in five), and seed referrals (`referral.md`) from the highest-engagement repliers. Every reply is a 1:1 opening — route buying intent to `lead-nurture.md`.

## 7. Compliance

Opt-in required; easy opt-out ("STOP likho — turant hata dunga"); no unsolicited bulk. Honour STOP within 24 hours. Never add a number that did not save you or reply in.

**Template approval is a Cloud API concept and does not apply to a self-hosted linked number.** On a self-hosted number, opt-in and low volume are the only protection against the number being banned — which makes the cadence cap above a survival rule rather than a courtesy.

## 8. Metrics

List size by segment, broadcast **read rate** (target >70%), **reply rate** (target >8%), broadcast → demo, broadcast → referral, opt-out rate (keep under 2% a month). Definitions in `../../50-measurement/metric-dictionary.md`. A falling read rate means too much promo or the wrong timing — rebalance towards the 4:1 value ratio.
