# The Laptop Agent

Runs on the agency owner's own machine, talks to Meta with their own token, keeps a
local SQLite database that is the source of truth, and pushes a projection to
RealtyFlow.

## Install

```bash
cd instagram-local-agent
npm install
cp config/config.example.json ~/.ig-agent/config.json   # or set IG_AGENT_CONFIG
```

Everything the agent owns lives under `~/.ig-agent` (override with `IG_AGENT_HOME`):

| File | What |
|---|---|
| `agent.db` | the SQLite database — all data, all history |
| `config.json` | Meta app credentials, cloud URL, intervals, rate caps |
| `vault.key` | AES-256-GCM key for the token vault, mode 0600 |
| `device.json` | device id + HMAC secret from pairing, mode 0600 |
| `agent.log` | structured log the console and `doctor` read back |

The device secret deliberately lives outside the database: the SQLite file gets copied
around for support and backups, and a credential that can authenticate to the tenant's
cloud data should not ride along with it.

## Commands

```
ig-agent connect            Connect an Instagram professional account (opens consent)
ig-agent pair <code>        Pair this laptop (code from the web app's Devices page)
ig-agent sync [what]        Run collectors: all | profile | media | comments | dm
ig-agent start              Run the scheduler in the foreground
ig-agent console            Open the local console at 127.0.0.1:7317
ig-agent status             Health summary
ig-agent doctor             Diagnose setup problems
ig-agent dry-run on|off     Build requests, send nothing
ig-agent kill on|off        Stop all outbound actions
```

`doctor` is the right first move when anything is wrong: it checks the Node version,
the SQLite schema, the Meta credentials, the cloud URL, whether an account is connected,
each token's health, and whether the laptop is paired.

## First run

```bash
ig-agent doctor      # expect complaints about credentials until config.json is filled
ig-agent connect     # browser consent, stores an encrypted 60-day token
ig-agent pair ABCD2345
ig-agent sync        # first pull — the DM backfill is the slow part
ig-agent console     # look at what came back
ig-agent start       # leave it running
```

## Module map

| Module | Plan ref | What it does |
|---|---|---|
| `src/auth/tokenProvider.js` | A1 | `DevModeProvider` (live), `SharedAppProvider` / `HostedProvider` (stubs). Everything downstream only calls `provider.getToken(accountId)`, so moving out of Dev Mode is a config swap. |
| `src/auth/oauth.js` | A1 | Business Login, code exchange, long-lived token, refresh at day 50 |
| `src/auth/vault.js` | A1 | AES-256-GCM token storage under a machine-local key |
| `src/store/` | — | Schema, versioned migrations, and every SQL statement in the agent |
| `src/collectors/profile.js` | A2 | Nightly account snapshot and audience demographics |
| `src/collectors/media.js` | A3 | Posts and reels plus per-media metrics |
| `src/collectors/comments.js` | A4 | Keyword matching, queues public + private replies |
| `src/collectors/conversations.js` | A5 | DM sync. Full backfill first, then a 60-second poll |
| `src/engine/drafter.js` | A6 | Hinglish reply drafting. Template-based by default, LLM pluggable via `setDrafter()` |
| `src/engine/windowClassifier.js` | A7 | The single send gate |
| `src/engine/sender.js` | A7 | Queue-then-send, with a re-check at send time |
| `src/extract/enquiry.js` | A8 | Phone, budget, intent, area, temperature |
| `src/uplink/` | A9 | HMAC client and the offline upload queue |
| `src/console/server.js` | A12 | Local UI on loopback |
| `src/runtime/` | A13 | Graph client, rate governor, error taxonomy, kill switch |
| `src/actions/`, `src/importers/` | A10/A11/A14 | Phase 4 stubs that refuse with a pointer to the plan |

## How the safety rules are enforced in code

- **`windowClassifier.js` is the only gate.** No code path sends without passing
  through it. `canSend()` checks the window *and* the message kind: a `COMMENT_REPLY`
  window authorises a private reply, never a free-form DM.
- **Queue-then-send with two recorded states.** `window_state_at_queue` and
  `window_state_at_send` both live on the outbox row, so an audit can distinguish "we
  were allowed when we decided" from "we were still allowed when we sent".
- **A window error downgrades, never retries.** Retrying a blocked send is the exact
  pattern Meta's anti-spam systems look for.
- **`HUMAN_AGENT` needs a human.** The classifier reports the state but sets
  `autoSendAllowed: false`; sending requires `human_approved` on the outbox row, which
  only a click in the console sets.
- **The rate governor caps well under Meta's ceilings** (200/hour sends against Meta's
  100/second; 150/hour private replies against 750/hour) with jitter, and halts a
  bucket entirely on error `4`, `613`, `80007` or `2018001`.
- **The Graph client has an allow-list of endpoints.** A path that is not on it throws
  `EndpointNotAllowedError` rather than being called.

## What it will never do

Mass or cold DMs, follow/unfollow, auto-liking, follower-list scraping, browser
automation of instagram.com, or the `HUMAN_AGENT` tag on autopilot. None of these has
an official API and every one is a documented route to an account restriction. A test
scans the whole source tree asserting no banned endpoint appears anywhere.

## The DM backlog

The agent reads every DM thread regardless of age — reading is not window-limited. It
cannot *auto-reply* to a thread older than 7 days, and nothing can. For those, the
console shows a Story-CTA suggestion instead of a Send button: post a Story asking
people to reply, which opens a fresh 24-hour window legally. That is the honest answer,
and it is the one that works.
