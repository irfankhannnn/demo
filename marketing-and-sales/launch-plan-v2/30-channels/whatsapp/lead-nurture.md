# WhatsApp — lead nurture

Move a warm WhatsApp lead from **interested** to **demo booked or trial started**. This is the conversion engine between `../../40-sales-and-conversion/dm-to-demo.md` and the sales scripts (`../../40-sales-and-conversion/qualification.md` → `demo-script.md`). The `nurture-bot` agent drafts the sequences and `sdr` drafts warm outbound; a human sends. Tracked by `pipeline-manager`.

**Used by:** `../../week-2-soft-launch/day-09-craft-send-invites.md`, `day-13-checkin-drip.md` · `../../week-3-public-launch/day-18-execute-cold-day1.md`, `day-19-cold-day2-iterate.md` · `../../week-4-optimize-convert/day-23-followup-non-replies.md`.

> **Speed is everything.** First message **within 5 minutes**. One CTA per message, value before the ask, and book a *concrete slot* — never leave it open-ended. (The old draft justified this with "15-min reply converts ~60% vs ~20% after an hour". The rule is right; the statistic has no source, so it is gone.)

> **Which number sends these is not settled**, and a self-hosted number has no template gate. See `README.md` in this folder.
>
> Open decision D29c — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 1. Entry & opt-in
Lead arrives from: an Instagram or Facebook DM hand-off, an event, a referral or a broadcast reply. Paid sources (lead ads, click-to-WhatsApp) are post-PMF — there are no paid ads in M1. The hand-off carries the name, the source `OPP-*` or reel, and a segment guess (solo / team); note that the CRM lead itself only stores `source` and `sourceAdapter`, so the `OPP-*` lives in the tracking sheet. The first WhatsApp message doubles as soft opt-in ("yahan baat karte hain?"). If there is no reply by T3, send one re-engagement and then stop.

## 2. The nurture sequence (consented, branch-aware)

| Touch | Timing | Intent | Branch logic |
|---|---|---|---|
| **T0** | <5 min | Warm greeting + 1 qualify Q (current tool) | — |
| **T1** | same day (+3h) | Send a 60-second AI Employee recording, or the pain reel they engaged with | match it to their stated pain |
| **T2** | +1 day | The Leakage Audit — their own numbers, not a case study | solo and team get the same audit, different framing |
| **T3** | +2 days | Offer: free 10-min pipeline audit OR live demo | replied→book; silent→re-engage |
| **T4** | +4 days | Objection-buster (cost / time / team won't use it) | route to `objections.md` |
| **T5** | +7 days | "Koi pressure nahi" re-engage + best clip | no reply → mark cold, move to broadcast |

**Branch at T0 reply:** solo broker → push **TRIAL** (self-serve, `app.realestateflow.in/signup`). Team or agency owner → push **DEMO** (human walkthrough). The Pune/Marathi branch is parked (D24).

## 3. Verbatim messages (Hinglish)

**T0 — first touch (<5 min):**
> "Hi {{name}} 🙌 RealEstateFlow se {{founder}}. Aapne {{reel/ad}} pe interest dikhaya — thanks! Quick sawaal: abhi leads WhatsApp/Excel pe sambhalte ho ya kisi system pe? Bata do, main *exact* dikhata hoon kaise help hoga."

**T1 — product nudge (+3h):**
> "{{name}}, yeh raha 60-second ka recording 👉 {{link}}. WhatsApp pe AI Employee nayi lead ko khud handle karta hai — qualify karke aapko sirf garam leads deta hai. Apne ek lead pe live try karna ho toh batao 😊"

**T2 — the audit (+1 day):**
> "Ek chhota kaam do minute ka: pichhle mahine ki leads mein se kitno ko *teesra* follow-up gaya? Ginke batao — main uske hisaab se dikhaunga kahan se leak ho raha hai. Reply AUDIT."

The June draft used an invented customer here ("{{city}} ki ek {{segment}} agency… site visits double"). We have no customers, so T2 works on the prospect's own numbers instead.

**T3 — pipeline audit / demo offer (+2 days):**
> "Free 10-min pipeline audit karun? Main dekh ke bataunga aap *kitne leads aur kitna commission silently lose* kar rahe ho — koi sales pitch nahi. Kal {{slot1}} ya {{slot2}}, kaunsa theek hai?"

**T4 — objection handler (+4 days), cost variant:**
> "Bahut log poochte hain 'mahnga toh nahi?' — {{price_line}}. Ek bachi hui deal ka commission hi mahine ka kharcha nikaal deta hai; hisaab aap apne numbers pe karo. {{trial_line}} pe khud test kar lo. Try karein?"

Prices come from `../../pricing.json` only, via the tokens. There is no "Starter" plan — the tiers are Solo, Team, Team+ and the AI Employee add-on.

**T4 — team-won't-use-it variant:**
> "Tension yeh hai na ki 'team use nahi karegi'? Aapki team WhatsApp chala leti hai — yeh usse aasaan hai. 2-min training, bas. Demo mein aapki team ko bhi bula lo, saath dikha dunga."

**T5 — re-engage (+7 days):**
> "Koi pressure nahi {{name}} 🙏 Bas yeh dekh lo — {{best clip}}. Jab ready ho, main yahan hoon. Tab tak ek tip: har lead pe next-action date likho, follow-up kabhi miss nahi hoga."

**Marathi T0 variant (parked — Pune is out of M1 scope, D24):**
> "Namaskar {{name}} 🙌 RealEstateFlow kadun {{founder}}. Sadhya leads WhatsApp var ki kuthlya system var? Sanga, mi exact dakhavto kasa fayda hoil. (Demo Hindi/English madhe pan deto.)"

## 4. Personalisation rules
Use **name, segment and the content they engaged with**. Language per `../../10-audience-and-voice/language-and-tone.md`; M1 is Mumbai Hinglish. Honorifics: owners get **aap**, young brokers **tu/tum**. Reference the specific pain in the reel that brought them in — generic gets ignored.

## 5. Rules
- One CTA per message. Value before ask. Stop on request (STOP / "abhi nahi").
- Book a **concrete slot**, not "kabhi bhi". Confirm timezone (IST) + which feature to show.
- Never two unanswered messages in a row without a value reason.
- Human-first tone — automation is invisible plumbing (`README.md` §1). Drafts are reviewed before they go out.

## 6. Handoff contract
- **"Yes to demo"** → book the slot (demo windows are Tue–Fri 11:00–17:00) and run `../../40-sales-and-conversion/demo-script.md`; stage = Demo Booked; brief from `../../40-sales-and-conversion/qualification.md`. Then `demo-followup.md` takes over.
- **"Yes to trial"** → send the signup link → stage = Trial; hand to `customer-success.md` Day 0.
- **Cold at T5** → move to the broadcast list (`founder-broadcast.md`) and revisit on the next big drop.

## 7. Metrics

Speed to first message (target <5 min), lead → demo rate (target ~30%), average touches to a demo, T0 reply rate, branch split (trial vs demo), cold-drop percentage. Definitions in `../../50-measurement/metric-dictionary.md`. A slow first message or a low T0 reply rate means fixing speed and the opening line before anything else.
