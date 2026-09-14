# HP Instagram lead automation

Turns a raw Instagram DM export into a maintained lead sheet. The Excel file is
the source of truth. Every run decides, per Instagram handle, whether to update
an existing row or add a new one, keeps what was already known, and records
every change it makes.

This document is the reference for the whole system. Read it before changing
anything in `scripts/`.

---

## 0. How it runs now

Every 6 hours a Windows scheduled task reads the Instagram inbox of
@happyproperties99 straight from instagram.com, and only the threads that
changed get analysed and written into the workbook. Nobody pastes anything.
Section 12 covers that automated path. Sections 1 and 2 describe the older
manual path from a pasted text export, which still works as a fallback.

## 1. Pipeline

```
sample-dm-file.txt          raw export, copied out of Instagram web
        |
        |  scripts/parse_dm_export.py          deterministic, no judgement
        v
parsed/<name>.parsed.json   one record per handle + every message
        |
        |  insta-lead-analyst agent            judgement only
        v
analysis/<name>.analysis.json  summary, next action, reply, score, type
        |
        |  scripts/upsert_leads_excel.py       deterministic merge
        v
master/hp-insta-leads.xlsx  7 sheets, source of truth
        |
        |  scripts/build_dashboard_data.py      export for the browser
        v
lead-dashboard.html         standalone read-only UI, no server needed
```

The split matters. Anything a machine can decide exactly (handles, dates,
phone numbers, insert versus update, change history) is done in Python and is
reproducible. Anything needing reading comprehension (what this person wants,
what to say next) is done by the model. Neither stage does the other's job.

### Running it

```bash
cd kalim-sessions/kalim-automations/hp-insta-lead-automation

python scripts/parse_dm_export.py sample-dm-file.txt
# then the insta-lead-analyst agent writes analysis/sample-dm-file.analysis.json
python scripts/upsert_leads_excel.py \
  --parsed   parsed/sample-dm-file.parsed.json \
  --analysis analysis/sample-dm-file.analysis.json
```

Add `--dry-run` to the last command to see the insert and update plan without
writing the workbook. In Claude Code, the `insta-lead-excel` skill runs all
three stages.

---

## 2. Input format

The parser expects exactly what Instagram web produces when threads are copied
out, which is what `sample-dm-file.txt` contains.

- Threads are separated by a line of three or more dashes.
- A block may start with the literal line `user-profile-picture`, which is
  ignored.
- The display name is the line above the handle line.
- The handle line is `<handle> · Instagram`. This is the only required line in
  a block. A block without one is skipped and reported as a warning.
- Timestamps appear as separators between message groups, not per message, in
  three forms:

| Form | Example | Handling |
|------|---------|----------|
| Absolute | `26 Jul 2026, 16:01` | used as-is |
| Relative weekday | `Mon 18:50` | resolved against the anchor date |
| Time only | `05:48` | assumed to be the anchor date |

Every message takes the timestamp of the nearest preceding separator. Messages
above the first separator in a block get no date at all and are excluded from
the datewise and weekwise sheets.

### The anchor date

Instagram only shows relative weekday labels for the trailing seven days, so
they need a reference point. The parser uses the input file's last modified
date and prints it on every run. Override it with `--anchor-date YYYY-MM-DD`
when a file has been copied around and its timestamp is no longer the export
date. Using the file date rather than today's date means re-parsing an old
export next month does not silently shift its conversations forward.

Each message row carries a `date_source` column recording which rule produced
its date: `absolute`, `relative_weekday`, `time_only_assumed_anchor` or
`before_first_timestamp`.

### Message direction

The export does not say who sent most messages. The parser resolves direction
only where it can be certain:

| Rule | Result |
|------|--------|
| `You replied to <name>` precedes the message | ours |
| `<name> replied to you` precedes the message | theirs |
| Text matches a phrase in `config/business-phrases.json` | ours |
| The message is a bare mobile number | theirs |
| First message in a thread | theirs, every thread here is inbound |
| Anything else | unattributed |

On the sample export that resolves 81 of 193 messages. The analyst infers the
rest from context when writing summaries, but that inference is not written
back per message, so the `from_lead` and `from_us` columns in the activity
sheets are undercounts and the `unattributed` column holds the remainder.

To improve the split, add your team's standard lines to the
`business_phrases` list in `config/business-phrases.json`. The parser reads
that file at run time, so no code change is needed.

---

## 3. The workbook

`master/hp-insta-leads.xlsx`, seven sheets. All of them except `Changelog`,
`Messages` and `Run Log` are rebuilt on every run from the accumulated data,
so nothing drifts.

### Overview

Consolidated counts: the last run, total leads, the conversation window, the
score split, the type split, the deal type split, what the next action is
across the pipeline, and readiness counters such as how many leads have a
number and how many are ready to close.

### Leads

One row per Instagram handle. Sorted hottest first, and inside each score band
the most recently active on top.

| Column | Source | Meaning |
|--------|--------|---------|
| `lead_id` | parser | Instagram handle, lowercase. The key for every update. |
| `lead_name` | parser | Display name as it appears in the export. |
| `instagram_link` | parser | `https://www.instagram.com/<handle>/` |
| `mobile_number` | parser + analyst | 10-digit Indian numbers, `; ` separated. Accumulates. |
| `whatsapp_available` | analyst | `yes`, `no` or `not_mentioned`. `yes` only when WhatsApp was actually mentioned. |
| `lead_type` | analyst | `buyer`, `seller`, `tenant`, `landlord`, `not_a_lead`, `unknown` |
| `lead_score` | analyst | `very_hot`, `hot`, `cold`. Colour coded. |
| `deal_type` | analyst | `rent`, `buy`, `heavy_deposit` or blank |
| `property_type` | analyst | `1 BHK`, `2 BHK` and so on |
| `locality` | analyst | Free text as the lead said it |
| `city` | analyst | Free text, only when actually named. Never inferred from the agency being Mumbai-based. |
| `building_name` | analyst | Society, building or project name, only when a specific one was named |
| `budget` | analyst | Free text as the lead said it |
| `units_required` | analyst | How many properties/units, only when stated as more than one. Blank means one. |
| `possession_timeline` | analyst | When they need it |
| `requirement_complete` | computed | `yes` when deal type, property type, locality and budget are all present |
| `summary` | analyst | What happened, where it stopped, what the blocker is |
| `next_action` | analyst | The single next step and why |
| `action_channel` | analyst | `dm`, `call`, `whatsapp`, `meeting`, `none` |
| `suggested_reply` | analyst | Ready to paste, Hinglish |
| `meeting_schedule` | analyst | What was agreed, with the date resolved |
| `dm_can_be_closed` | computed | See the rule below |
| `close_reason` | computed | Either the rule that was satisfied, or exactly what is still missing |
| `sourcing_action_for_sameer` | live runner | The task raised when a property search finds nothing. Survives export re-runs. |
| `sourcing_status` | **you** | `open`, `done`, `dropped` or blank. Nothing overwrites your value. |
| `sourcing_raised_on` | live runner | When the task was first raised, so its age is real |
| `conversation_start_date` | parser | Earliest dated message, across all runs |
| `conversation_end_date` | parser | Latest dated message, across all runs |
| `days_since_last_message` | computed | Recalculated every run |
| `message_count` | parser | Messages seen for this lead |
| `reel_links` | parser | Reels shared in the thread. Accumulates. |
| `needs_review` | analyst | `yes` when the reading could be wrong |
| `notes` | analyst | One line a human should know |
| `manual_override` | **you** | Set to `yes` to freeze your own edits. See below. |
| `first_seen_run` | script | Run that created the row |
| `last_updated_run` | script | Run that last changed it |
| `source_files` | script | Every export this lead has appeared in |

### Daily Activity and Weekly Activity

Datewise and weekwise rollups, recomputed from the full message history on
every run, so they cover all exports ever processed and not just the latest.

Daily: date, conversations active, messages, new conversations started,
from lead, from us, unattributed.

Weekly: the same metrics grouped by ISO week with the Monday and Sunday
boundary dates, plus how many days in the week had activity.

### Changelog

Append-only. One row per changed field: run id, timestamp, lead, change type,
field, old value, new value, source file. This is where old data lives after
an update, which is how nothing is ever lost while the Leads sheet still shows
one clean current value per lead.

### Messages

Every message ever parsed, deduplicated on lead, date, time and text. This is
what the activity sheets are computed from, and it is what makes a re-run of
the same export a no-op.

### Run Log

One row per run: run id, source file, anchor date, and the new, updated,
unchanged and messages-added counts.

---

## 4. Merge rules

On every run, for each lead in the export, keyed on `lead_id`:

1. **Not in the sheet** — append a new row, log a `new` changelog entry.
2. **Already in the sheet** — merge field by field:

| Behaviour | Fields |
|-----------|--------|
| Accumulate, never replace | `mobile_number`, `reel_links`, `source_files` |
| Keep the earliest | `conversation_start_date` |
| Keep the latest | `conversation_end_date` |
| Keep the higher | `message_count` |
| Newest non-blank wins, blank never clears | every analyst field, `lead_name`, `whatsapp_available` |
| Recomputed every run | `requirement_complete`, `dm_can_be_closed`, `close_reason`, `days_since_last_message` |

Each field that actually changed writes one Changelog row holding the old and
the new value.

### Blank never clears

If a later export produces a shorter thread and the analyst has no budget for
it, the budget already in the sheet stays. This is what makes partial exports
safe to run.

### manual_override

Type `yes` into the `manual_override` column on any row and later runs will
stop overwriting its `lead_type`, `lead_score`, `summary`, `next_action`,
`suggested_reply`, `meeting_schedule`, `notes`, `budget` and `locality`.
Everything else, including phone numbers and dates, still updates. Use it when
you have spoken to the lead and know more than the DM thread does.

### Idempotency

Running the same export twice reports 0 new, 0 updated, 0 messages added, and
writes no changelog rows. If a re-run does report changes, the analysis file
changed, not the workbook.

### dm_can_be_closed

`yes` requires all three of:

1. a mobile number on record, **and**
2. `requirement_complete` is `yes`, meaning deal type, property type, locality
   and budget are all captured, **and**
3. a personal meeting is scheduled, meaning `meeting_schedule` is filled or
   `action_channel` is `meeting`.

Otherwise `no`, and `close_reason` names exactly what is missing, for example
`waiting on: mobile number; requirement (locality, budget)`. This is the
column that tells you which conversations can leave the DM queue and move to
phone or in-person handling.

---

## 5. Scoring rules

| Score | Meaning |
|-------|---------|
| `very_hot` | A mobile number with a real requirement, or a fixed meeting or site visit. An explicit "call me on this number" from the lead qualifies on its own. Us sending our own number does not. |
| `hot` | A clear requirement, at least two of deal type, configuration, locality and budget, with recent activity, but no number. |
| `cold` | Vague or one-line threads, dead negotiations, stale threads with nothing captured, and anyone who said no. |

Recency is part of the score. A lead with a number who has been silent for
weeks after we quoted above their budget is `hot`, not `very_hot`.

`lead_type` values: `tenant` wants to rent, `buyer` wants to purchase,
`landlord` and `seller` are offering property, `not_a_lead` is collab or spam,
`unknown` is when intent never surfaced. Heavy deposit enquiries are `tenant`
with `deal_type: heavy_deposit`.

---

## 6. The dashboard

`lead-dashboard.html` is a standalone read-only view of the same data, built for
people who will not open Excel. Double-click it, no server and no build step.
It follows the CRM app's design tokens, so it sits next to the product visually.

```bash
python scripts/build_dashboard_data.py     # run after every upsert
```

That reads the workbook and writes `lead-dashboard-data.js`, which the page loads
with a plain script tag. A script tag is used rather than `fetch` because `fetch`
is blocked on `file://` while a script tag is not.

Six tabs:

| Tab | What it holds |
|-----|---------------|
| Pipeline | One row per lead, hottest first, with search and filters for score, has-mobile, ready-to-close, meeting set, needs-review and quiet 14+ days. Clicking a row opens the full detail, including the reconstructed conversation and a copy button on the drafted reply. |
| Requirements | What buyers and tenants are actually asking for, built entirely from `locality`, `city`, `building_name`, `budget` and `units_required`. A consolidated sentence per area+deal combination (e.g. "2 properties for sale required in Kurla West — budget 1.2 Cr"), demand counts by area, by city and by building/society split sale vs rent, and the full one-row-per-lead requirement list. Nothing here is estimated: a blank means the field has never been captured, and it fills in automatically the next time that lead is analysed or handled live. |
| Sourcing (Sameer) | Every open, done and dropped `sourcing_action_for_sameer` task in one action list, with status buttons wired to the same `/api/sourcing/status` endpoint the drawer uses, filterable by status and sorted oldest-open-first. |
| Activity | The datewise bar chart and the weekwise table, plus the Overview counters. |
| Change history | The run log and every field change, showing the old value struck through next to the new one. |
| Data guide | How the data is produced, then every field with its type, allowed values, origin and meaning, followed by the rules worth knowing before trusting a number. |

### Requirements tab: where the numbers come from

The Requirements tab reads the workbook only, exactly like every other tab. A
lead counts toward demand when its `lead_type` is `buyer` (sale side) or
`tenant` (rent side, `heavy_deposit` included), and it has at least one of
`property_type`, `locality`, `budget`, `city` or `building_name` set. Budgets
are never summed or averaged, the same rule as everywhere else in this
document: they are listed as the distinct phrases the leads used, because a
budget is text with a unit, not a number.

If `city` or `building_name` come back empty for most leads, that is expected
on a first pass, most conversations only ever name an area. They get filled
in going forward from two places: the next time `insta-lead-analyst` reads a
fresh export, and the live chat runner's extraction step (`lead_desk_server.py`),
which now asks for both explicitly, the same way it already asks for
`locality` and `budget`. Neither will ever guess a city or a building name;
a blank stays blank rather than being invented.

Context is built into the page rather than left to this document. Every field
label carries an info marker giving its type and meaning, the message timeline
marks messages whose sender could not be proven, and a lead that cannot be closed
shows exactly what is missing.

The page is a snapshot of the workbook at the moment the data file was generated.
The Excel file always wins. `lead-dashboard-data.js` carries real names and phone
numbers and is gitignored for that reason.

---

## 7. Live conversation

The dashboard can carry a conversation forward. Paste what the lead replied and
the runner reads the whole thread, updates the requirement, searches real
inventory and drafts the next Instagram DM.

```bash
cp .env.sample .env        # then fill in the values, see below
python scripts/lead_desk_server.py
```

That serves the dashboard and opens it. Without the runner the page still works
as a plain file, just without the live sections, which say so rather than
failing silently.

### What one turn does

1. **Extract.** The whole thread plus the new reply go to Gemini, which returns
   the requirement as structured JSON. It is told to record only what the lead
   actually said, so a field it has not heard stays empty rather than guessed.
2. **Search.** That requirement goes to the CRM, see section 8.
3. **Compose.** The thread, the requirement and the real matches go back to
   Gemini, which writes the next DM. Its instructions rank the goals: book a
   meeting first, put a real property in front of them second, close the
   remaining requirement gaps third. It is given the matches explicitly and
   told when there are none, so it cannot invent a listing or a price.
4. **You decide.** Nothing is written until you press Save to workbook.

### What Save writes

Same merge discipline as the export upsert. A blank never clears a known value,
phone numbers accumulate, every change lands in the Changelog with run ids
prefixed `chat-`, and both messages are appended to the Messages sheet with
`source_file` of `live-chat` so live turns are distinguishable from exported
ones. `requirement_complete` and `dm_can_be_closed` are then recomputed, which
is how a lead flips to closable the moment a meeting is agreed.

### Which model

Leave `GEMINI_MODEL` blank and the runner asks your key which models it can
use, then picks the cheapest capable one, which is a Flash-tier model. The CRM
backend itself runs `gemini-2.5-flash`, so a blank usually lands on the same
model the product already uses. See the list your key can reach with:

```bash
python scripts/lead_desk_server.py --list-models
```

### Credentials

They live in `.env`, which is gitignored, and are read only by the runner. They
never reach the browser. The runner calls the CRM server-side on purpose: the
CRM's CORS allowlist would reject a browser page on `127.0.0.1`, and proxying
sidesteps that without anyone loosening the allowlist.

---

## 8. Property matching

The runner tries three paths in order and tells you in the panel which one
answered.

| Path | Endpoint | Credentials | Notes |
|------|----------|-------------|-------|
| Embeddings | `POST /api/internal/properties/match` | `CRM_INTERNAL_API_KEY` + `CRM_TENANT_ID` | Semantic search over Bedrock Titan embeddings and DynamoDB vector search, the same one the AI voice agent uses |
| Filters | `GET /api/crm/properties` | `CRM_AUTH_TOKEN`, a Cognito ID token | Exact filters: `area`, `bhk`, `minRent`, `maxRent`, `status` |
| Mock | `config/mock-properties.json` | none | Twelve Mumbai listings shaped like real CRM records |

**The embeddings path can return empty without meaning "nothing matches."** If
the DynamoDB vector index was never built for that environment, the backend
catches the failure and returns an empty list rather than an error. The runner
therefore treats an empty semantic result as inconclusive and falls through to
the filter search before declaring no match, and says so in the notes.

Whatever answers, results are re-scored locally. The three endpoints take
different parameter names and the semantic one ranks by embedding distance, so
one local pass is what makes the ranking consistent. Scoring: locality is
mandatory, then configuration, deal type and budget add to the score. A
different side of the same suburb still matches but ranks lower, so "Kurla
West" will surface Kurla East rather than pretending nothing exists, and will
never surface Bhandup West on the word "West" alone.

Budgets are parsed from the lead's own words, so `40k to 42k`, `5 to 10 lakh
deposit`, `25-30lakh` and `60 lac` all resolve. On a heavy-deposit requirement
the deposit is compared, not the monthly rent, or the ranking would come out
backwards.

### The sourcing task for Sameer

When a search returns nothing, the runner writes the requirement into
`sourcing_action_for_sameer`, sets `sourcing_status` to `open` and stamps
`sourcing_raised_on`. The Pipeline table shows it as a column, there is a
Sourcing open filter and a counter tile, and the detail panel has buttons to
mark it `done` or `dropped`. The dedicated **Sourcing (Sameer)** tab is the
consolidated version of the same thing: every task in one list, filterable by
status, sorted oldest-open-first, with the same done/dropped buttons acting
on the same endpoint, so it does not matter which page you resolve a task
from.

That status is yours. An export upsert never writes these three columns, it
only carries them forward, so re-running the DM export will not reopen a task
you have closed.

---

## 9. Files

```
hp-insta-lead-automation/
├── README.md                        this document
├── .gitignore                       keeps the private data out of git
├── sample-dm-file.txt               the reference export format
├── lead-dashboard.html              standalone read-only UI
├── lead-dashboard.css               its stylesheet, CRM design tokens
├── lead-dashboard-data.js           generated from the workbook, gitignored
├── .env.sample                      copy to .env and fill in, gitignored
├── config/
│   ├── business-phrases.json        which lines are ours, editable, no code change
│   └── mock-properties.json         fallback inventory when no CRM creds are set
├── scripts/
│   ├── parse_dm_export.py           stage 1, deterministic
│   ├── upsert_leads_excel.py        stage 3, deterministic
│   ├── build_dashboard_data.py      workbook to dashboard data file
│   ├── lead_desk_server.py          local runner: Gemini + CRM + workbook writes
│   └── property_search.py           the three CRM paths and the local scorer
├── parsed/                          stage 1 output, gitignored
├── analysis/                        stage 2 output, gitignored
└── master/
    └── hp-insta-leads.xlsx          the source of truth, gitignored
```

The Claude Code pieces live at the repository root:

- `.claude/skills/insta-lead-excel/SKILL.md` — runs the three stages
- `.claude/agents/insta-lead-analyst.md` — the stage 2 reasoning contract

### Exit codes

| Code | Script | Meaning |
|------|--------|---------|
| 0 | both | Success |
| 1 | both | Input file missing |
| 2 | parse | No lead blocks found, check the separators |
| 2 | upsert | Analysis failed validation, nothing was written |
| 3 | upsert | Workbook is open in Excel, close it and re-run |

Validation rejects an analysis that is missing a lead, has a duplicate lead,
names a lead that is not in the export, uses an invalid enum value, or has an
empty summary. Nothing is written when validation fails.

---

## 10. Known limits

- **The drafted reply is a draft.** Read it before sending. The model is told
  never to invent a property or a price and is given the real matches, but it
  is still writing on your behalf.
- **A Cognito ID token expires in about an hour**, so the filter-search path
  needs a fresh `CRM_AUTH_TOKEN` for each session of use. The embeddings path
  uses a static service key and does not.
- **Nothing is sent to the lead.** The runner drafts and records. Sending
  stays manual in Instagram.

- **Direction is partial for text exports only.** The automated fetch reads
  the sender of every message from Instagram, see section 12. For a pasted
  export it was 74 of 185 messages on the sample. The activity
  sheet's `from_lead` and `from_us` columns undercount by design and
  `unattributed` holds the rest. Extending `config/business-phrases.json`
  improves this over time.
- **Some threads carry no timestamps at all.** Four threads in the sample
  export have no timestamp separator anywhere, so their conversation dates are
  blank and they do not appear in the datewise or weekwise sheets. This is a
  property of how the DMs were copied, not of the parser.
- **Instagram groups messages under one timestamp**, so message times are
  accurate to the group, not the message.
- **The same handle in two blocks** of one export is merged into a single lead.
  `afshu99` in the sample is the example.
- **Phone numbers are validated as Indian mobiles**, ten digits starting with
  6 to 9, with `91`, `091` or `0` prefixes stripped. Landlines are not picked
  up.
- **`city`, `building_name` and `units_required` are additive columns.** Any
  lead analysed before these were added simply has them blank, same as any
  other analyst field the thread never mentioned. Re-run the export through
  `insta-lead-analyst` (or handle the lead in a live chat) to backfill them;
  nothing needs to be migrated by hand.

## 11. Privacy

The workbook holds real names, mobile numbers and private message content.
`master/`, `parsed/` and `analysis/` are gitignored, and this whole folder sits
under `kalim-sessions/` which the repository already ignores. Do not commit
this data, and do not upload the workbook to any external service.

## 12. Automated fetch from Instagram web

### Why not the pasted export

A thread copied as text loses which side of the chat each bubble sits on. In
the sample, `sameenaruknuddin` ended up with our own number 9594191916
recorded as hers, scored `very_hot`, because "Call on 9594191916" and the
contact card after it looked like the lead sharing a number. The fetcher
avoids that class of error entirely: every message bubble on instagram.com
carries a hidden "React to message from <username>" button, and that label is
what sets `direction`.

### Flow

```
Windows Task Scheduler, every 6 h
  scripts/run_pipeline.cmd -> scripts/run_pipeline.py
    1. apply any run parked because Excel had the workbook open
    2. scripts/fetch_instagram_dms.py      Chrome, own profile, read-only
         reads Primary, General, Requests lists
         opens only changed threads, reads messages + sender from the DOM
         -> runs/<id>/fetched.json
    3. scripts/build_parsed_from_fetch.py  merges workbook history per lead
         -> runs/<id>/parsed.json
    4. claude -p --agent insta-lead-analyst, 12 leads per batch, one retry
         -> runs/<id>/analysis.json
    5. scripts/upsert_leads_excel.py       same merge rules as section 4
    6. scripts/build_dashboard_data.py
    7. advance state/fetch-state.json, append logs/runs.jsonl
```

### What counts as changed

Read from Instagram's own thread list, newest first:

| Situation | Opened? |
|-----------|---------|
| First run ever, or `--backfill-days N` | every thread active in the last N days (config `first_run_backfill_days`, 30) |
| Last activity newer than the last successful run, plus 2 h slack | yes |
| Preview line differs from what state recorded | yes |
| Thread never seen before | yes |
| Instagram shows it as unread | **no**, see below |
| Three known, unchanged threads in a row | stop reading the list |

`state/fetch-state.json` holds `last_success_started_at`, and per Instagram
thread id the handle, display name, tab, preview line and when it was last
fetched. It only advances after the workbook save succeeds, so a failed run
is simply redone next time.

### Protecting the account

- **Read-only.** The scripts never type, send, react, or press Accept,
  Delete or Block. The only clicks are on thread rows and the inbox tabs.
- **Unread threads are skipped** (`open_unread_threads: false`). Opening one
  would show the lead "Seen" with no reply. They are picked up on the first run
  after someone on the team has read them. Message requests are always safe:
  Instagram tells the sender nothing until the request is accepted.
- **Human pace.** 4 to 9 seconds between threads, a 40 to 90 second break every
  12 threads, at most 40 threads per 6-hour run (150 on a backfill). All in
  `config/fetch-config.json`.
- **A normal Chrome.** Chrome is started by the script with its own profile in
  `%LOCALAPPDATA%\hp-insta-lead-automation\chrome-profile` and controlled over
  its DevTools port. It is not a headless or test browser.

This keeps the risk low, not zero: Instagram's terms do not allow automated
collection. Keep the pacing as it is.

### Setup, once

```bash
python scripts/fetch_instagram_dms.py --login --wait-minutes 30
#   log in as happyproperties99 in the window that opens
python scripts/run_pipeline.py --max-threads 1 --tabs primary --no-state   # smoke test
python scripts/run_pipeline.py                                              # first run = 30 day backfill
powershell -ExecutionPolicy Bypass -File scripts/register_schedule.ps1      # every 6 hours
```

The task runs only while the user is logged on to Windows, because Chrome
needs the desktop. Sleep or hibernate pauses it; a missed run starts as soon
as the laptop is awake.

### Operating it

| Symptom | Meaning | Fix |
|---------|---------|-----|
| `logs/runs.jsonl` status `ok` / `ok_nothing_new` | fine | none |
| `fetch_failed_exit_4` | Instagram logged the profile out | `python scripts/fetch_instagram_dms.py --login` |
| `fetch_failed_exit_6` | no thread rows recognised, Instagram changed its page | fix `scripts/dom_thread_list.js` / `dom_extract_thread.js` |
| `parked_excel_open` | workbook was open in Excel | close Excel, the next run applies it |
| `analysis_incomplete` | the analyst skipped a lead twice | look in `runs/<id>/batches/`, re-run with `--skip-fetch --fetched runs/<id>/fetched.json` |
| status missing, lock file present | a run is in progress or crashed | a lock older than 3 h is cleared automatically |

Skipped threads and why (unread, row not found) are listed at the end of
each `runs/<id>/pipeline.log`.

### Files

| Path | Role |
|------|------|
| `config/fetch-config.json` | account, tabs, pacing, caps, backfill days, batch size |
| `config/business-phrases.json` | `business_phone_numbers`: our numbers, never a lead's |
| `scripts/dom_thread_list.js`, `scripts/dom_extract_thread.js` | the only code that knows Instagram's markup |
| `state/fetch-state.json` | incremental state |
| `runs/<run_id>/` | fetched, parsed, analysis, batches, pipeline.log per run |
| `logs/runs.jsonl`, `logs/scheduler.log` | one line per run; raw scheduler output |
| `archive/2026-09-14-text-export/` | the workbook built from the pasted export, before the switch |

`runs/`, `state/`, `logs/` and `archive/` are gitignored. They hold message
content.

