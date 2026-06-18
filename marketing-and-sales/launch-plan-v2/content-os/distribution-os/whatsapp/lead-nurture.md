# WhatsApp — Lead Nurture Strategy

Move a warm WhatsApp lead from **"interested" → "demo booked / trial started"**. This is the conversion engine that sits between Attention OS (`content-to-conversation.md`) and Sales OS (`qualification.md` → `demo-script.md`). Run by `nurture-bot` (sequences) + `sdr` (warm outbound), tracked by `pipeline-manager`.

> **Speed is everything:** a response within 15 min converts ~60% vs ~20% after an hour (`02-market-research §5.2`). First message **within 5 min** (speed-to-lead). One CTA per message, value before ask, book a *concrete slot* — never leave it open-ended.

---

## 1. Entry & opt-in
Lead arrives from: IG/FB DM handoff, FB/Google lead ad, click-to-WhatsApp ad, event, referral, broadcast reply. The handoff carries: name, city (→ language), source `OPP-*`/reel, segment guess (solo / team). First WhatsApp message doubles as soft opt-in ("yahan baat karte hain?"). If no reply by T3, one re-engage, then stop (compliance).

## 2. The nurture sequence (consented, branch-aware)

| Touch | Timing | Intent | Branch logic |
|---|---|---|---|
| **T0** | <5 min | Warm greeting + 1 qualify Q (current tool) | — |
| **T1** | same day (+3h) | Send AI-calling 60s clip OR the pain reel they engaged | match to their stated pain |
| **T2** | +1 day | Case study for their segment (FW-CASE) | solo→agent story, team→agency story |
| **T3** | +2 days | Offer: free 10-min pipeline audit OR live demo | replied→book; silent→re-engage |
| **T4** | +4 days | Objection-buster (cost / time / team won't use it) | route to `objections.md` |
| **T5** | +7 days | "Koi pressure nahi" re-engage + best clip | no reply → mark cold, move to broadcast |

**Branch at T0 reply:** solo broker → push **TRIAL** (self-serve, app.realtyflow.in/signup). Team/agency owner → push **DEMO** (human walkthrough). Pune lead → Marathi handshake, then Hinglish mechanics.

## 3. Verbatim messages (Hinglish)

**T0 — first touch (<5 min):**
> "Hi {{name}} 🙌 RealEstateFlow se {{founder}}. Aapne {{reel/ad}} pe interest dikhaya — thanks! Quick sawaal: abhi leads WhatsApp/Excel pe sambhalte ho ya kisi system pe? Bata do, main *exact* dikhata hoon kaise help hoga."

**T1 — AI demo nudge (+3h):**
> "{{name}}, yeh raha 60-sec ka AI-calling clip 👉 {{link}}. Yeh aapke naye leads ko *khud call* karke qualify karta hai — aap sirf hot wale uthao. Ek lead ka number do toh live try karwa dun? 😊"

**T2 — segment case study (+1 day):**
> "Ek baat share karun — {{city}} ki ek {{segment}} agency WhatsApp pe leads kho rahi thi. RealEstateFlow ke baad lead leakage ~zero, aur 2 mahine mein site visits double. Pura breakdown chahiye? Reply CASE."

**T3 — pipeline audit / demo offer (+2 days):**
> "Free 10-min pipeline audit karun? Main dekh ke bataunga aap *kitne leads aur kitna commission silently lose* kar rahe ho — koi sales pitch nahi. Kal {{slot1}} ya {{slot2}}, kaunsa theek hai?"

**T4 — objection-buster (+4 days), cost variant:**
> "Bahut log poochte hain 'mahnga toh nahi?' — Starter ₹999/mo hai, aur ek bachi hui deal ka commission hi mahine ka kharcha nikaal deta hai. Free trial pe khud test karo, card bhi nahi maangte. Try karein?"

**T4 — team-won't-use-it variant:**
> "Tension yeh hai na ki 'team use nahi karegi'? Aapki team WhatsApp chala leti hai — yeh usse aasaan hai. 2-min training, bas. Demo mein aapki team ko bhi bula lo, saath dikha dunga."

**T5 — re-engage (+7 days):**
> "Koi pressure nahi {{name}} 🙏 Bas yeh dekh lo — {{best clip}}. Jab ready ho, main yahan hoon. Tab tak ek tip: har lead pe next-action date likho, follow-up kabhi miss nahi hoga."

**Pune Marathi (T0 variant):**
> "Namaskar {{name}} 🙌 RealEstateFlow kडून {{founder}}. Sध्या leads WhatsApp var ki kुठल्या system var? Sanga, mi exact dakhavto kasа fayda hoil. (Demo Hindi/English madhe pan deto.)"

## 4. Personalisation rules
Use **name + city + segment + the content they engaged**. City → language (Mumbai Hinglish / Pune Marathi handshake, `03-language-strategy §3`). Honorific: owners → **aap**; young brokers → **tu/tum**. Reference the specific pain from the reel that brought them in — generic = ignored.

## 5. Rules
- One CTA per message. Value before ask. Stop on request (STOP / "abhi nahi").
- Book a **concrete slot**, not "kabhi bhi". Confirm timezone (IST) + which feature to show.
- Never two unanswered messages in a row without a value reason.
- Human-first tone — automation is invisible plumbing (`distribution-os/whatsapp.md §1`).

## 6. Handoff contract
- **"Yes to demo"** → schedule event + trigger `sales-os/demo-script.md`; tag stage = Demo Booked; brief from `qualification.md`. Then `demo-followup.md` takes over.
- **"Yes to trial"** → send signup link → tag stage = Trial; hand to `customer-success.md` Day-0.
- **Cold at T5** → demote to broadcast list (`founder-broadcast.md`), revisit on next big drop.

## 7. Metrics (→ `growth-dashboard.md`)
Speed-to-first-message (target <5 min), Lead→Demo rate (target ~30%), avg touches to demo, T0 reply rate, branch split (trial vs demo), cold-drop %. Slow first message or low T0 reply = fix speed and the opening line first.
