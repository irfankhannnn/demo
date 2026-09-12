# HP Instagram lead automation

Turns a raw Instagram DM export into a maintained lead sheet. The Excel file is
the source of truth. Every run decides, per Instagram handle, whether to update
an existing row or add a new one, keeps what was already known, and records
every change it makes.

This document is the reference for the whole system. Read it before changing
anything in `scripts/`.

---

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
| `budget` | analyst | Free text as the lead said it |
| `possession_timeline` | analyst | When they need it |
| `requirement_complete` | computed | `yes` when deal type, property type, locality and budget are all present |
| `summary` | analyst | What happened, where it stopped, what the blocker is |
| `next_action` | analyst | The single next step and why |
| `action_channel` | analyst | `dm`, `call`, `whatsapp`, `meeting`, `none` |
| `suggested_reply` | analyst | Ready to paste, Hinglish |
| `meeting_schedule` | analyst | What was agreed, with the date resolved |
| `dm_can_be_closed` | computed | See the rule below |
| `close_reason` | computed | Either the rule that was satisfied, or exactly what is still missing |
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
| `very_hot` | A mobile number with a real requirement, or a fixed meeting or site visit. An explicit "call me on this number" qualifies on its own. |
| `hot` | A clear requirement, at least two of deal type, configuration, locality and budget, with recent activity, but no number. |
| `cold` | Vague or one-line threads, dead negotiations, stale threads with nothing captured, and anyone who said no. |

Recency is part of the score. A lead with a number who has been silent for
weeks after we quoted above their budget is `hot`, not `very_hot`.

`lead_type` values: `tenant` wants to rent, `buyer` wants to purchase,
`landlord` and `seller` are offering property, `not_a_lead` is collab or spam,
`unknown` is when intent never surfaced. Heavy deposit enquiries are `tenant`
with `deal_type: heavy_deposit`.

---

## 6. Files

```
hp-insta-lead-automation/
├── README.md                        this document
├── .gitignore                       keeps the private data out of git
├── sample-dm-file.txt               the reference export format
├── config/
│   └── business-phrases.json        which lines are ours, editable, no code change
├── scripts/
│   ├── parse_dm_export.py           stage 1, deterministic
│   └── upsert_leads_excel.py        stage 3, deterministic
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

## 7. Known limits

- **Direction is partial.** 81 of 193 messages on the sample. The activity
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

## 8. Privacy

The workbook holds real names, mobile numbers and private message content.
`master/`, `parsed/` and `analysis/` are gitignored, and this whole folder sits
under `kalim-sessions/` which the repository already ignores. Do not commit
this data, and do not upload the workbook to any external service.
