# Instagram — Comments Strategy

> **RealEstateFlow · `@realestateflow`**
> Comments are **two things at once**: the strongest algorithm signal (alongside saves) and the top of the DM pipeline. The first 60 minutes of comment activity decide a reel's reach; a buying-intent comment is a warm lead one reply away from a DM. Works with `../../40-sales-and-conversion/dm-to-demo.md`, `dm-workflows.md`, the sales scripts (`../../40-sales-and-conversion/objections.md`, `qualification.md`) and the content plan (`OPP-*`).

**Audience reality:** brokers comment in casual Hinglish, often a single emoji or "100%", sometimes a real objection or a "price?" Treat every comment as a person, never sell in the public thread, always route intent to DM. Reply windows align to peak hours (6–8 AM, 12–1 PM, 9–11 PM).

**Meta's limits bind this whole file:** one private reply per comment, and only within 7 days of that comment. Free-form DMs work only inside the 24-hour window.

---

## 1. Comment-Bait Taxonomy (how to manufacture comments)

Build the comment trigger into the reel/carousel **CTA** and **caption**, not bolted on after.

| Bait type | Mechanic | Example (Hinglish) | Best with | CTA-ID |
|---|---|---|---|---|
| **Binary question** | force a 1-word answer | "Leads kahan? 👉 WhatsApp ya System? Comment karo" | CT-DRAMA/EDU | CTA-COMMENT-045 |
| **Keyword loop** | trade a word for a DM asset | "Comment 'AUDIT' — leakage audit bhej deta hoon" | CT-EDU | CTA-COMMENT-002 |
| **Hot take** | `FW-CONTRARIAN` debate bait | "Market down nahi hai, tumhari follow-up slow hai" | CT-AUTHORITY | CTA-COMMENT-024 |
| **Tag-a-broker** | new viewers via tags | "Tag a broker jo abhi bhi Excel pe hai" | CT-MEME/DRAMA | CTA-COMMENT-015 |
| **Confession** | low-stakes self-admit | "Sach bolo — aaj kitne follow-up miss kiye? 👇" | CT-EDU | CTA-COMMENT-010 |
| **Guess-the-number** | curiosity + reveal | "100 leads aaye — aapke kitne convert hue? Guess karo" | CT-EDU | CTA-COMMENT-031 |
| **This-is-me** | relatability | "Yeh tumhari kahani hai? Comment 🏠" | CT-DRAMA/MEME | CTA-COMMENT-038 |

> One primary comment-bait per piece.
>
> **The month-1 keyword set is `SYSTEM` · `KHATA` · `AUDIT` · `DEMO`.** Keep every CTA on those four words — an ad-hoc keyword nobody has configured produces a comment and no reply. The older LEAK/PRICE/AI/GUIDE/TRIAL/PUNE set is retired; `PUNE` in particular promised a local team that does not exist.
>
> Each keyword doubles as the **rule trigger** in `dm-workflows.md` §1. Comment-to-private-reply automation is built — the keyword rules live in `agency-app/instagram-api` (`services/ruleMatcher.js`) and are driven from the Instagram console. The service is still in Meta **Development Mode**, and `INSTA_DRY_RUN_SENDS` is on in dev, so it cannot reach real followers until App Review passes. Until then a person sends the DM manually within 15 minutes. Replies are drafted first and never auto-sent unreviewed. Graph API only — never browser automation.
>
> Open decision D23 — see marketing-and-sales/launch-plan-v2/00-OPEN-DECISIONS.md

---

## 2. Reply SOP (with examples)

**The 60-minute rule:** reply to **every** comment in the first 60 minutes (algorithm + trust). Keep threads alive by ending replies with a question.

| Comment | Reply (Hinglish) | Then |
|---|---|---|
| "100%" / 🔥 / emoji | "Haha sach hai na 😄 aapki agency mein kitne agents?" | keep thread warm |
| "Excel pe hoon abhi 😅" | "Bhai 2026 aa gaya 😂 ek 90-second walkthrough dekho — pin comment mein link." | soft MOFU |
| "price?" / "kitna?" | "DM kar diya 🙌 (public mein nahi, aapke hisaab se plan batata hoon)" | **move to DM** |
| "demo?" | "Bhej diya inbox mein 👀" | **move to DM** |
| "team ke liye chalega?" | "Bilkul — DM mein team size batao, plan suggest karta hoon 🙌" | **move to DM** |
| Objection ("mera team nahi seekhega") | mini `FW-OBJECTION` reply publicly → "DM mein detail bhejta hoon" | public reframe + DM |
| Troll / competitor | hide if spam; if genuine, reframe once, don't argue | moderate |

**Rules:** never paste pricing in public (sell the demo). Heart genuine comments. Reply *as the brand voice* (warm, street-smart, no corporate). Add a question back ~half the time to extend reach.

---

## 3. Pinned-Comment Strategy

Pin ONE comment on every post, the moment it goes live:
- **TOFU reel:** pin the CTA + keyword ("Comment 'AUDIT' 👇 leakage audit bhej deta hoon").
- **Demo reel:** pin the walkthrough prompt ("90-second walkthrough 👉 realestateflow.in/demo/"). Hold the link back until `realestateflow.in` serves HTTPS.
- **Authority post:** pin the community invite. No "social proof" line — we have no customers to cite.
The pinned comment is prime real estate — it's the first thing a viewer reads, so it carries the CTA the on-screen end-card already showed (reinforcement, not repetition).

---

## 4. Comment → DM Conversion Scripts (Hinglish)

Buying-intent signals: **"price?", "kaise milega?", "demo?", "team ke liye?", "trial?"** → reply publicly with a one-liner ("DM kar diya 🙌") and open the DM:

```
DM open: "Arre 🙌 aapne reel pe comment kiya — yeh raha jo aapne maanga.
          {asset/link}. Waise abhi leads WhatsApp pe ya kisi system pe?"
→ then run the dm-workflows.md qualify→route→handoff flow.
```

A lead created from Instagram lands in the CRM with `source: 'Instagram'`, `sourceAdapter: 'instagram'` and `externalRef`/`reelRef` (`agency-app/api/leadIngestion.js`). There is no `instagram_comment` source value and no content-reference field, so **log the originating `OPP-*` by hand in the tracking sheet** until one exists. See `../../40-sales-and-conversion/dm-to-demo.md` and `follower-to-demo.md`.

---

## 5. Moderation Playbook

| Situation | Action |
|---|---|
| Spam / "DM me for crypto" / link spam | **Hide** (don't delete — hiding is invisible to them) |
| Competitor trolling | hide if pure trash; if a genuine jab, one witty on-brand reply, then ignore |
| Genuine objection | engage publicly with a mini `FW-OBJECTION` reframe, take specifics to DM |
| Abuse / profanity | hide + keyword-filter the word in IG settings |
| Off-topic but friendly | heart + short reply, keep it warm |

Set IG comment filters for common spam terms; never let a thread turn into a public argument (bad for brand + algorithm sentiment).

---

## 6. Comments as Research → new OPP-*

Comments are free market research (research §6 pains surface here in real time).
- **Recurring questions** ("WhatsApp se kaise import?") → log as new `OPP-*` candidates for the content plan and as FAQ/Highlight updates (`stories.md` §6 FAQ Highlight).
- **Recurring objections** → update `../../40-sales-and-conversion/objections.md` and spin a `FW-OBJECTION` reel.
- **Best comment lines** → re-use as hook copy (feed `../../20-content-engine/hooks/hook-library.md`). Do not screenshot a comment as proof or caption it "real broker said" — a public comment is not consent to be used as a testimonial.
- Weekly: skim top 20 comments across the week → 2–3 new content ideas (`growth-loops.md` DM/comment loop).

---

## 7. Daily Comment Routine

1. [ ] For every post in its first 60 min: reply to **all** comments + pin the CTA comment.
2. [ ] Sweep yesterday's posts once more (late commenters).
3. [ ] Route every buying-intent comment to a DM thread (script §4) + tag source/OPP-id.
4. [ ] Hide spam, handle objections, heart genuine fans.
5. [ ] Drop 5–10 **outbound** comments on target broker/agency pages (`../founder-presence.md` daily routine) — value-first, never salesy.
6. [ ] Note recurring questions/objections → research backlog.

---

## 8. Metrics

| Metric | What it tells you | Target |
|---|---|---|
| Comments / reach | engagement-signal strength | rises with bait-led posts |
| Reply rate (first 60 min) | are we showing up | **100%** |
| Comment → DM conversions | pipeline pull | log per `OPP-*` |
| Keyword-trigger volume (SYSTEM/KHATA/AUDIT/DEMO) | lead-magnet capture | track per keyword |
| New OPP-* sourced from comments | research yield | ≥ 2/week |

> Comments are measured by **threads kept alive + DMs opened**, not raw count. Twenty comments that produce 4 DM threads beat 200 emoji drops with zero conversations.
