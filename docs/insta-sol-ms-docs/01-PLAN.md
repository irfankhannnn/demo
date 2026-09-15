# Instagram Local Agent — Build Plan

> **Superseded (September 2026).** This is the original laptop-agent plan, kept for history. The product was rebuilt as a hosted service (one Meta app, "Connect Instagram" in the console, webhooks + scheduled sync) and `instagram-local-agent/` was removed. Current design: [03-ARCHITECTURE.md](03-ARCHITECTURE.md), setup: [07-META-APP-SETUP.md](07-META-APP-SETUP.md).

**Status:** proposal, awaiting decisions in §9. No code written yet.
**Date:** 2026-08-29
**Folder:** `instagram-local-agent/` (repo root)

An app the agency owner installs on their own laptop. It logs into their Instagram
account through Meta's official API, keeps a local copy of their account data, reels,
comments and DM threads, drafts and sends DM replies, and pushes the results up to
RealtyFlow as a tenant-scoped feed.

---

## 1. Scope rule: additive only

This is a **new, isolated feature**. It does not modify, wrap, or depend on any
existing flow.

Specifically it does **not** touch:
- `server/routes/webhooks.js` — the ManyChat Instagram lead webhook stays exactly as
  it is and keeps running in parallel.
- `server/agencyConfigService.js` and the `AgencyConfig` table — no new fields.
- The existing `Leads` table, `createLead`, `notifyNewLead`, or the `lead.created`
  EventBridge flow.
- `server/infra/cfn-backend.yaml` — new tables go in their own stack.

Everything the agent produces lands in **its own tables** and shows up on **its own
CRM page**. If we later decide Instagram DM leads should become real CRM leads, that
is a separate, explicit switch built after this ships — not a dependency of it.

**Total edit to existing code: 2 lines in `server/server.js`** (one import, one
`app.use('/api/ig-agent', ...)`), plus one route line in the frontend router. Nothing
else in the repo changes.

---

## 2. Four corrections to the assumptions we started from

**A Facebook Page is no longer required.** Since 2024 Meta ships *Instagram API with
Instagram Login*: the agency logs in with their Instagram professional account
directly. Scopes are `instagram_business_basic`, `instagram_business_manage_messages`,
`instagram_business_manage_comments`, `instagram_business_content_publish` (the old
`instagram_manage_*` names were retired 27 Jan 2025). This removes the biggest
onboarding blocker — most Indian agents have no Facebook Page.

**Reading old DMs is not window-limited. Only sending is.**
`GET /me/conversations` and `GET /<conversation_id>/messages` return thread history at
any age. So pulling your own DM history into the CRM — including the 2-month backlog —
is fully available on day one. The 24-hour rule only blocks *outbound* messages to a
cold thread.

**The send window is 24h plus two documented extensions.**
`POST /<comment_id>/private_replies` opens a DM to anyone who commented, up to **7
days** after the comment — this is the real lead engine, not DM blasting. The
`HUMAN_AGENT` tag also gives 7 days, but Meta's policy restricts it to a human
resolving an issue and they detect misuse, so we implement it as human-click-to-send
only, never as an autonomous queue.

**"Scraping" is two different things.** Our own account data (profile, media, reels,
insights, our own DM threads) is a first-party API read with zero ban risk — that is
90% of what we want. Anyone else's data (competitor followers, hashtag feeds) has no
official API at all; if we want it, it runs server-to-server from RealtyFlow cloud via
a vendor like Apify, never from the agency's laptop and never from their logged-in
session.

---

## 3. A running example

Rakesh runs a 3-person brokerage in Andheri West. 8,200 Instagram followers. He posts
a reel walking through a 2BHK, ₹1.4 Cr. In the caption: *"Price ke liye PRICE comment
karo."* Over the next 48 hours the reel gets 42,000 views, 130 comments and 60 DMs.
Today those DMs sit unanswered for days and he has no idea which reel actually
produced business.

Every automation below is described against what happens to Rakesh.

---

## 4. The automations, in six groups

### GROUP 1 — Getting connected (A1)

#### A1. Token Keeper
**What it is.** The login and credential layer. Opens Instagram's consent screen in a
browser window, gets back an access token, swaps it for a 60-day long-lived token, and
then quietly refreshes it around day 50 so it never expires. The token is encrypted at
rest using the OS keychain (Windows Credential Manager / macOS Keychain). Supports more
than one Instagram account per install, which matters for agencies running a personal
handle plus a brand handle.

**Rakesh's experience.** He runs the installer, clicks "Connect Instagram", picks his
account, taps Allow. Done — he never sees a token or a settings screen again.

**Runs:** once at setup, then a refresh check daily.
**In the CRM:** a status chip — *Connected · @rakeshproperties · healthy*, or
*Reconnect needed*.

---

### GROUP 2 — Pulling your own data ("the scraping you asked for") (A2, A3, A5, A14)

This group is pure reading. No sending, no risk, and it is what makes the CRM page
worth opening.

#### A2. Account & Profile Sync
**What it is.** A nightly snapshot of the account itself: username, bio, follower
count, following count, post count, plus the account-level insights Meta exposes —
reach, views, accounts engaged, total interactions, follows and unfollows, link taps,
and the audience demographic breakdowns (city, age, gender).

**Why it matters more than it sounds.** Instagram only keeps roughly 90 days of this.
We snapshot it daily and keep it forever, so after six months Rakesh has a follower and
reach chart nobody else can show him — not ManyChat, not the Instagram app itself.

**Rakesh's experience.** He opens the CRM and sees "followers +340 this month, reach
down 12% vs last month, 61% of your audience is Mumbai 25-34".

**Runs:** once a night, ~10 API calls.
**In the CRM:** growth charts on the Instagram page.

#### A3. Media & Reel Sync
**What it is.** Pulls every post and reel — caption, type, permalink, thumbnail,
timestamp — and then per-item performance: views, reach, likes, comments, saves,
shares, total interactions, and for reels the average watch time and total watch time.
It is incremental: it only fetches things it hasn't seen, and refreshes stats for
anything posted in the last 30 days.

**Why it matters.** This is where content stops being guesswork. Once we also have DM
and comment data (A4, A5), we can attribute enquiries back to the specific reel that
caused them.

**Rakesh's experience.** A table sorted by "enquiries generated": the Andheri 2BHK reel
produced 23 DMs, the market-update reel produced 1. He now knows what to shoot next
week.

**Runs:** nightly, plus a lighter refresh every few hours for reels under 7 days old.
**In the CRM:** a reel leaderboard with views → comments → DMs → enquiries.

#### A5. DM Inbox Sync (read only)
**What it is.** Reads all conversations and their messages into a local database —
sender, text, timestamp, attachments, direction. The first run backfills the entire
history the API will give us; after that it polls for new messages every 60 seconds.

**This is the answer to your original question.** You cannot *reply* to a 2-month-old
DM automatically, but you can absolutely *read* it, index it, and count it. All the
analytics you wanted from the backlog are available.

**Rakesh's experience.** Every DM he has ever received is searchable in one place, with
stats: 312 total conversations, 47 never answered, median response time 9 hours.

**Runs:** one heavy paced first sync, then a 60-second poll.
**In the CRM:** inbox volume, unanswered count, response-time stats, common questions.

#### A14. Backfill Lane (one-time, browser)
**What it is.** A wrapper around the `instagram-dm-export` skill this repo already has,
which pulls DMs from a logged-in Chrome session and writes them into the same local
database as A5. It exists to fill any gap the API leaves and to give day-one history.

**Why it is safe when general browser automation is not.** It runs once, manually, at
human speed, in the owner's own browser, on their own inbox. It is never scheduled and
never looped. That distinction — one manual export vs a bot polling in a loop — is
exactly what Meta's detection is looking at.

**Runs:** once per account, manually triggered.
**In the CRM:** nothing directly; it makes A5's data complete from the first minute.

---

### GROUP 3 — Replying to DMs (A4, A6, A7)

#### A4. Comment Watcher & Private Reply — *the lead engine*
**What it is.** Watches comments on recent reels. When someone comments a trigger word,
it does two things: posts a public reply on the comment, and fires a **private reply**
which opens a real DM thread with that person. Meta allows this for 7 days after the
comment, and it is the officially blessed way to turn a comment into a conversation.

**This is the single feature agents pay ManyChat ₹2,000–8,000/month for.** We give it
away inside the CRM.

**Rakesh's experience.** 130 people comment "PRICE" on his reel. Each one gets a public
"DM kiya hai! 📩" and a real DM with the price, floor plan and a question about their
budget. He did nothing.

**Runs:** every 2–5 minutes.
**In the CRM:** keyword rules he can edit ("PRICE" → this message), and a log of every
comment that triggered.

#### A6. AI Reply Drafting
**What it is.** For each unanswered inbound thread it builds context — the whole
conversation, which reel the person came from, matching inventory from the CRM — and
drafts a reply in Hinglish using the agent stack this repo already has for WhatsApp.
The draft is *stored*, not sent.

**Rakesh's experience.** Someone asks "parking hai kya, aur loan me help karoge?" The
draft reads: *"Haan ji, 2 covered parking hai. Loan ke liye humara tie-up hai HDFC aur
ICICI dono se — 15 min me pre-approval nikal denge. Aap kis area me dekh rahe ho?"* He
taps approve.

**Runs:** whenever A5 sees a new inbound message.
**In the CRM:** drafts appear on his phone for approval, so he can clear the inbox from
a site visit.

#### A7. Window-Aware Sender
**What it is.** The one gate every outbound message passes through. It classifies each
thread and decides what is legal:

| State | Meaning | What we do |
|---|---|---|
| `STANDARD` | they messaged within 24h | auto-send allowed |
| `COMMENT_REPLY` | commented within 7 days | private reply allowed |
| `HUMAN_AGENT` | within 7 days, support case | send only on a human click |
| `CLOSED` | older than that | **no send possible** |

It also handles Meta's error codes correctly — on a window error it downgrades the
thread state instead of retrying, because retrying a blocked send is exactly the
pattern that gets accounts flagged.

**Rakesh's experience.** On his 60-day-old backlog, the Send button is replaced by a
suggestion: *"Post a Story asking these 47 people to reply RETRY — that reopens the
window legally."* Honest, and it actually works.

**Why it exists as its own module.** Our whole promise is "this will not get your
account restricted." That has to be enforced in one auditable place in code, and it is
the first thing Meta's App Review will look at.

---

### GROUP 4 — Getting data into RealtyFlow (A8, A9)

#### A8. Enquiry Extractor
**What it is.** An LLM pass over each DM thread that pulls out structured fields: name,
phone number, buy vs rent intent, budget bracket, preferred area, and which reel they
originally came from. It writes an *Instagram enquiry* record — **not** a CRM lead —
into the feature's own table.

**Why not a CRM lead (for now).** Per the scope rule in §1, this feature does not touch
the existing lead pipeline. Rakesh sees Instagram enquiries on their own page. Turning
one into a real CRM lead is a button he presses, or a switch we flip later once you are
happy with the extraction quality.

**Rakesh's experience.** "23 enquiries from Instagram this week" with name, phone,
budget and source reel already filled in — instead of him scrolling DMs with a notepad.

#### A9. Uploader
**What it is.** Batches everything from A2, A3, A5 and A8 and posts it to the new
RealtyFlow endpoints, signed with a per-tenant device key. It queues when offline,
retries with backoff, and survives the laptop being shut for a week.

**Important design point.** The local database is the source of truth; the cloud copy
is a projection. A failed upload can never lose data, and a laptop that dies is a
re-sync, not a disaster.

**Runs:** every 15 minutes, or immediately for enquiries.
**In the CRM:** everything above. This is the module that makes the laptop useful to
*us*, not just to Rakesh.

---

### GROUP 5 — Account management (A10, A11)

#### A10. Comment Moderation & Safe Actions
**What it is.** The write actions Meta officially supports: reply to a comment, hide or
unhide a comment, delete our own comment, mark a DM as seen, show the typing indicator.
Rule-driven — regex plus an LLM spam classifier — with every action logged and
reversible.

**Rakesh's experience.** Competitors dropping "DM me for cheaper in same building" under
his listing reels get auto-hidden within minutes. This is a genuine, constant complaint
from brokers.

**What is deliberately absent:** no follow/unfollow, no auto-liking, no mass DMs. None
of those have an API, and every one of them is what actually gets accounts banned.

#### A11. Content Publisher *(optional, later phase)*
**What it is.** Publishes reels, images, carousels and stories from a queue the CRM
fills, using Meta's official publishing endpoints. Capped at 50 posts per 24 hours by
Meta.

**Why it fits here.** It closes the loop with the `my-video` / Remotion pipeline already
in this repo: generate a listing reel in the CRM → schedule it → publish it → measure
it in A3. And because the upload happens from the laptop, large video files never
transit our infrastructure, so our storage and egress cost stays at zero.

---

### GROUP 6 — Making it reliable (A12, A13)

#### A12. Local Console
**What it is.** A small web UI on `127.0.0.1` that opens in the owner's browser:
unified inbox, AI drafts with approve/edit/send, sync status, token health, how much
rate-limit budget is left today, an audit log of every action taken, and a kill switch.
No inbound ports, no tunnel, no cloud dependency to read your own inbox.

**Why it matters commercially.** An owner who opens our console every morning is an
owner we can sell the paid CRM to. The free tool is the beachhead.

#### A13. Runner, Governor & Safety
**What it is.** The scheduler (Windows Task Scheduler / launchd / systemd) plus the
safety layer: a per-endpoint token-bucket rate limiter, randomised jitter so traffic
doesn't look robotic, exponential backoff, a structured error taxonomy, a global kill
switch, and a dry-run mode for testing.

**Concrete defaults.** Meta's ceiling is 750 private replies/hour and 100 messages/sec.
We run at roughly 200 sends/hour maximum and stop entirely on any rate error until the
next window. Deliberately far below the line.

---

## 5. One reel, end to end

| Time | What happens | Module |
|---|---|---|
| 0:00 | Rakesh posts the 2BHK reel | — |
| 0:05 | Agent sees the new media, starts tracking it | A3 |
| 2:10 | "PRICE" comment appears | A4 |
| 2:10 | Public reply posted + DM opened via private reply | A4, A7 |
| 2:11 | Person replies "Andheri me hi chahiye, 1.5 Cr tak" | A5 |
| 2:11 | AI drafts a Hinglish response with matching inventory | A6 |
| 2:12 | Rakesh approves on his phone; sent inside the 24h window | A7 |
| 2:20 | Phone number shared → enquiry record created | A8 |
| 2:35 | Enquiry pushed to RealtyFlow | A9 |
| 03:00 | Nightly snapshot: reel stats + account growth | A2, A3 |
| next day | CRM shows: this reel → 42k views → 130 comments → 61 DMs → 23 enquiries | A9 |

---

## 6. Exactly what gets touched

**New files only:**
```
instagram-local-agent/               entire laptop app
server/routes/instagramAgent.js      new router, /api/ig-agent/*
server/instagramAgentService.js      new DynamoDB access layer
server/infra/cfn-instagram-agent.yaml   own CFN stack, own tables
real-estate-crm-app/src/pages/instagram/  new CRM page
```

**Existing files edited (2 lines + 1):**
```
server/server.js          import + app.use('/api/ig-agent', validateToken, igAgentRoutes)
frontend router           one <Route> entry
```

**New tables** (own stack, `TENANT#<id>` partition key, same multi-tenancy convention
as the rest of the CRM):
- `IgAgentDevices` — registered laptops, device key hashes, last seen
- `IgAgentSnapshots` — daily account + media metrics
- `IgAgentEnquiries` — extracted enquiries, isolated from the Leads table
- `IgAgentThreads` — conversation summaries and stats

**Auth for laptop → cloud:** a per-tenant device key issued from CRM settings, with
requests signed HMAC-SHA256 over body + timestamp. Rotatable and revocable from the CRM,
so a lost laptop is one click to cut off.

---

## 7. Build phases

| Phase | Modules | Outcome |
|---|---|---|
| 1 | A1, A2, A3, A13, basic A12 | Connect an account, see your own profile and reel data locally. Proves the Meta setup works end to end. |
| 2 | A5, A14, A9 + CRM endpoints/tables/page | DM history and metrics visible in the SaaS. First real laptop → CRM value. |
| 3 | A4, A6, A7, A8 | The lead engine. This is the ManyChat replacement. |
| 4 | A10, A11, installer, onboarding docs | Ready to hand to design-partner agencies. |

## 8. Hard limits to design around

- Outbound DM: 24h standard; 7d via comment private reply; 7d via `HUMAN_AGENT`
  (human-approved only). Nothing reaches a cold 60-day-old thread.
- Rate: 4,800 × impressions per rolling 24h app-wide; messaging capped separately at
  100/s text, 10/s media, 750/hr comment private replies. We run far below all of these.
- `impressions` and `plays` were removed April 2025 — use `views`. `profile_views` is
  gone from the API too. Verify the exact metric list against the live API version at
  build time rather than trusting any document, including this one.
- No API exists for: follower lists, other accounts' data, hashtag feeds, following or
  liking.
- Publishing: 50 posts per 24 hours.
- Cost: the Instagram API itself is free. Our only costs are DynamoDB storage and, if we
  ever add the competitor lane, Apify usage.

## 9. Decisions needed before code

**D0 — Isolation.** ✅ *Answered: new feature, additive only, no changes to existing
flows. Reflected throughout this document.*

**D1 — Meta app model.** ✅ *Answered: **Development Mode** first. Each account we test
with is added as an Instagram tester on our own Meta app. No Business Verification, no
App Review, no waiting — we can build and test today. Once the tool is proven we move to
a shared RealtyFlow app (App Review) and/or a hosted microservice.*

**Design consequence — build this in from day one.** The token source goes behind a
`TokenProvider` interface with three implementations planned:

```
TokenProvider
 ├── DevModeProvider     (Phase 1) token from a local Meta app, account added as tester
 ├── SharedAppProvider   (later)   token from RealtyFlow's App-Reviewed Meta app
 └── HostedProvider      (later)   token fetched from a RealtyFlow microservice
```

Everything downstream — collectors, reply engine, uploader — only ever sees
`provider.getToken(accountId)`. Moving to app mode or a hosted service later is a config
change and one new class, not a rewrite. Nothing else in the agent knows or cares where
the token came from.

**What Dev Mode does and does not limit.** It does *not* limit which endpoints work or
how much data we get — a tester account has the full API surface. It only limits *whose*
accounts we can touch: each account must be explicitly added as a tester on the app and
accept the invite from Instagram settings (~5 minutes). Fine for you plus a handful of
design-partner agencies; not something to hand to 500 agents.

**D2 — Realtime transport.** Polling only (no tunnel, ~60s lag, simplest) vs Meta
webhooks → RealtyFlow cloud → laptop long-polls (near-instant, still no ngrok on the
agent's machine, but cloud becomes a hard dependency).
**Recommendation: poll for Phases 1–2, add the cloud relay in Phase 3** when reply
latency starts to matter.

**D3 — Stack.** Node/TypeScript (matches the repo, one toolchain, ships as a signed
`.exe` via pkg) vs Python. **Recommendation: Node/TS.**

**D4 — Competitor/market data.** In scope now via cloud-side Apify, or defer? It is the
only piece that costs money per call. **Recommendation: defer, stub the interface now.**
