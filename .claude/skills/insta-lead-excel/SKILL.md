---
name: insta-lead-excel
description: >
  Run or operate the Instagram lead automation for @happyproperties99 at
  tools/kalim-sessions/kalim-automations/hp-insta-lead-automation. The
  primary path turns a raw pasted DM export (.txt, e.g. sample-dm-file.txt)
  into rows in the master lead workbook: parses it into one record per
  Instagram handle, has the insta-lead-analyst agent write the summary, next
  action, Hinglish reply draft, lead score and lead type for each, then
  upserts into the Excel by lead_id so an existing lead is updated in place
  and a new one is appended. The workbook is the source of truth: nothing is
  ever overwritten silently, every field change lands in an append-only
  Changelog sheet. Do not push to CRM (scripts/push_leads_to_crm.py) unless
  the user explicitly asks — paused per user instruction 2026-09-17. Use when
  the user says to process Instagram DMs, update the lead sheet, or run the
  Instagram lead automation.
---

# Instagram DM to lead Excel

## 0. The primary path: pasted text export

As of 2026-09-17 this is the primary path. The user does not want DM data
collected via the Chrome extension. Feed it a raw pasted DM export saved as a
`.txt` file (e.g. `sample-dm-file.txt`) and run the three stages below.

**Do not push to CRM.** `scripts/push_leads_to_crm.py` (stage 4, README
section 9) is paused per user instruction 2026-09-17. Stop after the
workbook upsert (stage 3) unless the user explicitly asks to push.

### The Chrome-extension automated path is on hold

`scripts/run_pipeline.py` / `run_pipeline.cmd` and the "HP Insta Lead
Automation" Windows scheduled task read DMs from instagram.com through the
unpacked "HP Insta Lead Reader" extension. This still works technically, but
the user explicitly asked (2026-09-17) not to use it to get DM data — use the
manual `.txt` path below instead. No scheduled task is currently registered.
Do not re-register it (`scripts/register_schedule.ps1`) or run
`scripts/run_pipeline.py` unless the user asks to switch back. Reference only:

| Want to | Do |
|---------|----|
| Run it now (only if asked) | `python scripts/run_pipeline.py` |
| Check the browser link | `python scripts/chrome_bridge.py --check` (exit 7 = extension not connected, 4 = Instagram logged out) |
| Change/re-register schedule | `powershell -ExecutionPolicy Bypass -File scripts/register_schedule.ps1 -Hours 6` |

Rules that protect the account and the data, if it is ever used again:

- The fetcher is read-only. Never add typing, sending, reacting, or clicks on
  Accept/Delete. Keep the pacing in `config/fetch-config.json`.
- `open_unread_threads` stays `false` unless the user says otherwise: opening
  an unread thread shows the lead "Seen".
- The extension only runs the named helpers in `chrome-extension/page_lib.js`
  (generated from `scripts/dom_*.js`) and only navigates inside
  instagram.com/direct. Do not add a free-form "eval" command to it.

## 1. The manual pipeline

Three stages. Stage 1 and 3 are deterministic Python, stage 2 is judgement.
Never do stage 1 or 3 by hand, and never hand-edit the workbook to apply an
analysis, because the changelog and the idempotency both depend on the script.

Working directory for everything below:
`tools/kalim-sessions/kalim-automations/hp-insta-lead-automation`

### 1.1 Parse the export

```bash
python scripts/parse_dm_export.py <input.txt>
```

Writes `parsed/<stem>.parsed.json`. Splits on the `----` separator lines,
reads the handle from the `<handle> · Instagram` line, and extracts
timestamps, phone numbers, reel links and whatever message direction the
export states outright.

Check the output before moving on:

- **Lead count** should match the number of separator blocks. Any block the
  parser could not attribute is printed as a WARNING with its first two lines.
- **Anchor date.** Relative labels like `Mon 18:50` carry no date. They are
  resolved against the input file's modified date, printed on every run. If
  the file was copied around and the date is wrong, re-run with
  `--anchor-date YYYY-MM-DD`.
- **Threads with no timestamps at all** end up with null conversation dates.
  That is the export's limitation, not a bug. They are excluded from the
  datewise and weekwise sheets.

### 1.2 Analyse

Launch the `insta-lead-analyst` agent with the parsed file path and tell it to
write `analysis/<stem>.analysis.json`. Its agent definition carries the full
schema and the scoring rules.

Every lead in the parsed file needs an entry. Stage 3 refuses to run on a
partial analysis rather than writing half a picture into the source of truth.

For a small export it is fine to do the analysis directly instead of spawning
the agent, but follow that same definition.

### 1.3 Upsert into the workbook

```bash
python scripts/upsert_leads_excel.py \
  --parsed parsed/<stem>.parsed.json \
  --analysis analysis/<stem>.analysis.json \
  [--dry-run]
```

Run `--dry-run` first on anything unfamiliar. It prints the full insert and
update plan without touching the file.

The script validates the analysis, matches on `lead_id`, and for each lead
either appends a new row or merges into the existing one. Merge rules that
matter:

- A blank incoming value never clears a value already in the sheet.
- Phone numbers, reel links and source file names accumulate, they do not
  replace.
- `conversation_start_date` keeps the earliest, `conversation_end_date` takes
  the latest.
- Every changed field writes a Changelog row with the old and new values.
- A row with `manual_override` set to `yes` keeps its human-written summary,
  score, reply and meeting through later runs.
- `requirement_complete` and `dm_can_be_closed` are computed, never supplied.

Re-running the same export twice is a no-op: the second run reports 0 new,
0 updated, and adds no changelog rows. If it does not, something is wrong with
the analysis file, not with the workbook.

## After the run

Report to the user, in this order:

1. New leads, updated leads, and what specifically changed on the updated ones.
2. The very_hot list with the action for each, since that is the day's work.
3. Anything flagged `needs_review`, and why.
4. Cross-lead patterns worth acting on, such as repeated demand we have no
   inventory for, unanswered inbounds, or quotes sent above a stated budget.

Stop there. Do not run `scripts/push_leads_to_crm.py` afterwards — CRM push
is paused per user instruction (2026-09-17) until the user asks for it.

## Failure modes

- **Workbook open in Excel** exits with code 3 and changes nothing. Ask the
  user to close it and re-run.
- **Validation failure** exits with code 2 and lists every problem. Fix the
  analysis file and re-run. Do not bypass it.
- **Wrong lead count** almost always means a separator line was lost when the
  DMs were copied out of the browser. Check the raw export before parsing
  again.

## Privacy

The workbook holds names and mobile numbers of real people. The folder's
`.gitignore` already excludes `master/`, `parsed/` and `analysis/`. Never
commit those, and never send the workbook to any external service.
