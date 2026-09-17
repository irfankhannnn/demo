# Follow-up script

Most deals close on the follow-up — which is a little on the nose for a follow-up product, so we model the behaviour. Pairs with `../30-channels/whatsapp/lead-nurture.md`, `demo-followup.md` and `message-templates.md`.

**Used by:** `../week-2-soft-launch/day-13-checkin-drip.md` · `../week-3-public-launch/day-19-cold-day2-iterate.md` · `../week-4-optimize-convert/day-23-followup-non-replies.md`, `day-24-reactivation-stalled-trials.md`.

> **Principles:** one CTA per message · value before the ask · reference their specific pain and the content they engaged with · always propose a concrete next step, a slot or the trial, never "let me know" · stop on request.

> **Prices are tokens** — `{{price_line}}`, `{{trial_line}}`, `{{ai_employee_disclosure}}` from `../pricing.json`. **No invented peers.** We have zero customers, so no message here cites another broker's result.

---

## Channel rules
- **WhatsApp is primary.** It is where brokers live. Templates: `../30-channels/whatsapp/message-templates.md`. Remember the 24-hour window if you are sending through a Cloud API number, and the ban risk if you are sending from a self-hosted one (`../30-channels/whatsapp/README.md`).
- **Call** the high-value owners — Hot leads, Team+ or AI Employee prospects — at Touch 3 and Touch 5, inside the demo window (Tue–Fri, 11:00–17:00 IST).
- **Timing:** send in the peak windows — 6–8 AM, 12–1 PM, 6–8 PM. Never 9–11 PM; they are done for the day.
- **One CTA. One ask. One message.** No walls of text — brokers scroll past.

---

## Core cadence (post-demo / warm lead)

| Touch | Day | Channel | Intent | Verbatim |
|---|---|---|---|---|
| 1 | 0 (≤1h) | WhatsApp | Recap + trial link + the one objection | see below |
| 2 | +1 | WhatsApp | Remove setup friction | see below |
| 3 | +3 | WhatsApp/Call | ROI arithmetic on their own numbers | see below |
| 4 | +5 | WhatsApp | Product recording + "ek lead pe try karo" (`FW-AI`) | see below |
| 5 | +7 | WhatsApp/Call | Decision nudge + honest offer | see below |
| 6 | +12 | WhatsApp | Soft re-engage, no pressure | see below |
| 7 | +21 | WhatsApp | Break-up | see below |

### Verbatim messages

**Touch 1 — Day 0, ≤1h (recap):**
> "{{name}} bhai, aaj demo ka maza aaya 🙌 Jaise dikhaya — har lead ka ek malik aur ek next step. Yeh raha trial link *(link)*. {{trial_line}}, no card, aur main aapke pehle 10 leads khud import kar dunga. Kab time hai 10 min setup ke liye — aaj shaam ya kal subah?"

**Touch 2 — Day 1 (friction remover):**
> "Setup mein koi dikkat? Mujhe apni lead list (Excel/WhatsApp) bhej do — main import karke pehla follow-up set kar deta hoon. Aapko sirf dekhna hai farak. 👍"

**Touch 3 — Day 3 (ROI arithmetic, their numbers):**
> "Ek quick maths bhejta hoon — aapke {{N}} leads pe agar 5% bhi bach gaye toh kitna commission. 2 min mein bhej dun?"
> *(For a Hot lead, or a Team+ or AI Employee prospect: call instead — "bhai 5 min baat karein, hisaab samjha doon?")*

This touch used to carry an invented customer — "Andheri ke ek 6-agent owner ne ₹8L deal recover kiya". There is no such owner. The arithmetic on their own pipeline does the same job and survives being checked.

**Touch 4 — Day 5 (AI wow, `FW-AI`):**
> "Yeh 30-second clip dekho — AI ne ek lead ko khud qualify kiya 👇 *(clip)*. Aap apne ek real lead pe abhi try kar sakte ho trial ke credits pe. On kar dun?"

The clip is a **real screen recording** on a sample lead, `[REC]`, not a dramatisation and not a claimed result.

**Touch 5 — Day 7 (decision nudge):**
> "Bhai seedhi baat — abhi season hai, leads aa rahe hain. Har din wait = leak. Aaj trial on karo, main personally setup karunga aur ek hafta saath rahunga. Bolo, haan?"
> *(honest urgency only — festival/launch lead-flood or limited onboarding slot. Never fake scarcity.)*

**Touch 6 — Day 12 (soft re-engage):**
> "Koi pressure nahi 🙏 Bas yeh soch ke bheja — {{their pain, e.g. 'follow-up bhool jaana'}} pe ek choti cheez. *(best `FW-` content)*. Jab ready ho, main yahin hoon."

**Touch 7 — Day 21 (break-up):**
> "{{name}} bhai, main aapko baar-baar tang nahi karunga 🙂 Abhi timing nahi toh koi baat nahi — par jab woh agla lead haath se nikalne lage, ek message kar dena. Main turant set kar dunga. All the best! 🙌"

---

## Branch logic

**If REPLIED with interest →** jump to the matching next step:
- "kitna ka hai" → take pricing to DM, anchor on ROI → `closing-script.md`.
- "team se baat karni hai" → arm them (sales-enablement one-liner), set a follow-up slot.
- "trial on karo" → `onboarding-script.md` Day 0 immediately.

**If they reply with an objection →** route to `objections.md`, resolve it, re-ask, then resume the cadence.

**If NO REPLY →** continue cadence to Touch 7. After 2 consecutive no-replies, **switch channel once** (WhatsApp → one call) before continuing.

**If "abhi nahi / baad mein" →** move to long-term nurture (`../30-channels/whatsapp/community.md` or the founder broadcast) and set a 30- or 60-day re-touch.

---

## Speed-to-lead cadence (NEW inbound, pre-demo — research §5: 15-min response wins)
For fresh Instagram, portal or referral leads that have not been demoed yet:

- **≤5 min:** "Hi {{name}}! Aapne {{reel}} pe DM kiya. Quick — solo ho ya team? 2 min mein bata dunga RealEstateFlow kaise fit hota hai."
- **+30 min, no reply:** "Bas ek line — abhi leads WhatsApp/Excel pe ya kisi system pe? Iske hisaab se exact dikhaunga."
- **+1 day:** value drop (`FW-LEAD-LEAKAGE`) and a soft demo ask. The ROI maths is done by hand — the on-site calculator is a placeholder, so do not link it.
- **+3 days:** product curiosity (`FW-AI`) → push to the 90-second walkthrough (`demo-script.md`, short variant).

> **Speed is the whole game.** Reply within five minutes. The old note here quoted "15 min ≈ 60%, after an hour ≈ 20%" — unsourced, so it is gone. The rule does not need it.

---

## Re-engagement sequence (gone-cold lead, 30+ days silent)
- **Touch A:** Pattern-interrupt value, no ask — "{{name}} bhai, ek naya feature aaya jo aapki {{pain}} pe seedha kaam karta hai 👇"
- **Touch B (+4d):** a product update or a clip of a new feature. Not a peer win — there are no peers to cite.
- **Touch C (+8d):** soft offer — "{{trial_line}} pe try kar lo, kuch lagana nahi."
- No reply after C → move them to the broadcast list (`../30-channels/whatsapp/founder-broadcast.md`) and stop the 1:1.

---

## Break-up → nurture transition
On Touch 7 / break-up with no reply: stop personal follow-up, add to long-term nurture (broadcast + community), set a 60-day re-touch tied to a buying trigger ("season aane pe" / "naya project launch pe"). A break-up message often *triggers* a reply — that's the point.

---

## Templates per persona
- **Owner:** their own ROI arithmetic and where leads go missing. Call at Touch 3 and 5.
- **Manager:** team visibility and "owner ko dikhane layak report". Arm them to sell up.
- **Agent:** automatic follow-up and their own numbers. Short, fast, mobile. They push the owner.
- **Pune:** growth framing and a Marathi rapport line. Parked (D24).

---

## Output
Update the lead stage at each touch and log every touch to the pipeline (`pipeline-manager`) with the channel and the response. After seven touches with no movement, go to long-term nurture. Feed recurring objections back into `objections.md`. Metric definitions live in `../50-measurement/metric-dictionary.md`.
