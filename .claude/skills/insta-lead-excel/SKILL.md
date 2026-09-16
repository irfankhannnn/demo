---
name: insta-lead-excel
description: >
  Run or operate the Instagram lead automation for @happyproperties99 at
  tools/kalim-sessions/kalim-automations/hp-insta-lead-automation. The normal path
  is the scheduled pipeline (scripts/run_pipeline.py) that reads DMs from
  instagram.com in the user's own Chrome (via a read-only extension) every 6 hours; the fallback path
  turns a raw pasted DM export (.txt) into rows in the master lead workbook.
  Parses the export into one record per Instagram handle, has the
  insta-lead-analyst agent write the summary, next action, Hinglish reply
  draft, lead score and lead type for each, then upserts into the Excel by
  lead_id so an existing lead is updated in place and a new one is appended.
  The workbook is the source of truth: nothing is ever overwritten silently,
  every field change lands in an append-only Changelog sheet. Use when the
  user says to process Instagram DMs, update the lead sheet, or run the
  Instagram lead automation.
---

# Instagram DM to lead Excel

## 0. The automated path (use this first)

A Windows scheduled task, "HP Insta Lead Automation", runs
`scripts/run_pipeline.cmd` every 6 hours. It reads the inbox (Primary,
General, Requests) from instagram.com in the user's own logged-in Chrome,
through the unpacked "HP Insta Lead Reader" extension in `chrome-extension/`, opens
only threads that changed since the last successful run, reads every message
with Instagram's own sender label, has the `insta-lead-analyst` agent analyse
the changed leads through `claude -p`, upserts the workbook and rebuilds the
dashboard. State lives in `state/fetch-state.json`; each run leaves
`runs/<run_id>/` and one line in `logs/runs.jsonl`.

| Want to | Do |
|---------|----|
| Run it now | `python scripts/run_pipeline.py` |
| Reload the last N days | `python scripts/run_pipeline.py --backfill-days 30` |
| Smoke test one thread, no state change | `python scripts/run_pipeline.py --max-threads 1 --tabs primary --no-state` |
| Re-analyse a saved fetch | `python scripts/run_pipeline.py --skip-fetch --fetched runs/<id>/fetched.json` |
| Check the browser link | `python scripts/chrome_bridge.py --check` (exit 7 = extension not connected, 4 = Instagram logged out) |
| Fix exit 4 / exit 7 | the user logs in to Instagram in Chrome / enables the extension in `chrome://extensions` (Load unpacked `chrome-extension/` if missing) |
| See what happened | last lines of `logs/runs.jsonl`, then `runs/<id>/pipeline.log` |
| Change schedule | `powershell -ExecutionPolicy Bypass -File scripts/register_schedule.ps1 -Hours 6` |

Rules that protect the account and the data:

- The fetcher is read-only. Never add typing, sending, reacting, or clicks on
  Accept/Delete. Keep the pacing in `config/fetch-config.json`.
- `open_unread_threads` stays `false` unless the user says otherwise: opening
  an unread thread shows the lead "Seen".
- Exit 3 means Excel had the workbook open. The run is parked and applied by
  the next run; do not re-run the analysis by hand.
- The extension only runs the named helpers in `chrome-extension/page_lib.js`
  (generated from `scripts/dom_*.js`) and only navigates inside
  instagram.com/direct. Do not add a free-form "eval" command to it.
- Exit 6 means Instagram changed its markup. Inspect the page with
  claude-in-chrome and fix `scripts/dom_thread_list.js` or
  `scripts/dom_extract_thread.js`; never fall back to guessing senders.

The rest of this skill is the manual path for a pasted text export. Text
copies lose which side of the chat each bubble is on, so prefer the automated
path whenever Chrome is logged in and the extension is connected.

Three stages. Stage 1 and 3 are deterministic Python, stage 2 is judgement.
Never do stage 1 or 3 by hand, and never hand-edit the workbook to apply an
analysis, because the changelog and the idempotency both depend on the script.

Working directory for everything below:
`tools/kalim-sessions/kalim-automations/hp-insta-lead-automation`

## 1. Parse the export

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

## 2. Analyse

Launch the `insta-lead-analyst` agent with the parsed file path and tell it to
write `analysis/<stem>.analysis.json`. Its agent definition carries the full
schema and the scoring rules.

Every lead in the parsed file needs an entry. Stage 3 refuses to run on a
partial analysis rather than writing half a picture into the source of truth.

For a small export it is fine to do the analysis directly instead of spawning
the agent, but follow that same definition.

## 3. Upsert into the workbook

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
