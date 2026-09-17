# Ingestion into db/lead-desk.db

Two things are written down here: what the existing DM pipeline actually reads
(the question was whether it takes screenshots, and whether it updates
incrementally by Instagram handle), and how `scripts/ingest_to_db.py` loads the
pipeline's artefacts into SQLite.

All line references are to the files as they stand in this folder. The lead
handles in the worked examples below (`lead_a`, `lead_b`, `https.lead_c`,
`lead_d`) are stand-ins: the runs were real, but the handles and the mobile
number belong to real people and this folder does not commit those.

---

## 1. Does anything read image files?

No. Nothing in the pipeline opens a `.png` or `.jpg`. There is no OCR, no
vision call, no image decoding of any kind.

The parser reads text and only text:

    scripts/parse_dm_export.py:321-322
        with open(args.input, encoding="utf-8") as fh:
            raw_lines = fh.readlines()

`readlines()` on a PNG raises `UnicodeDecodeError`. There is no branch above or
below it that looks at the file's extension or magic bytes.

A search across every script, the Chrome extension and the config files turns
up three mentions of images, none of which read one:

- `scripts/dom_extract_thread.js:69` — when the DOM extractor meets a picture
  attachment in a thread it substitutes the literal string `[image]`:
  `parts.push({ kind: "media", text: "[image]" });`. It records that a picture
  was there; it never looks at it.
- `scripts/dom_extract_thread.js:84` — drops that `[image]` placeholder when the
  bubble is a shared reel, because the placeholder is just the thumbnail.
- `scripts/lead_desk_server.py:119-120` — a deny-list that keeps the model
  picker away from `image`, `vision`, `imagen` and `veo` models. It is
  excluding vision models, not using one.

`scripts/chrome_bridge.py:275` matches a search for "image" only because
Windows `tasklist` takes a filter called `IMAGENAME`.

`README.md` (39 KB) does not contain the word "screenshot" anywhere.

### So what is `screenshots-dm/`?

It is a real folder of real images that the pipeline cannot read:

    screenshots-dm/17-09-2026/Screenshot 2026-09-17 051720.png   1736 x 1386 PNG
    screenshots-dm/17-09-2026/Screenshot 2026-09-17 052809.png   1720 x 1364 PNG
    screenshots-dm/17-09-2026/Screenshot 2026-09-17 052909.png   1702 x 1408 PNG
    screenshots-dm/17-09-2026/Screenshot 2026-09-17 052945.png   1758 x 1516 PNG
    screenshots-dm/17-09-2026/Screenshot 2026-09-17 053025.png   1748 x 1554 PNG
    screenshots-dm/17-09-2026/Screenshot 2026-09-17 053049.png   1738 x 1556 PNG
    screenshots-dm/17-09-2026/Screenshot 2026-09-17 053121.png   1750 x 1426 PNG
    screenshots-dm/17-09-2026/Screenshot 2026-09-17 053143.png   1726 x 1540 PNG

`parsed/screenshots-dm-17-09-2026.parsed.json` was produced from them by a
person or an agent reading the pictures and typing the JSON. The file says so
itself:

    "source_kind": "screenshot_transcription",
    "transcription_note": "Each screenshot shows Instagram DM bubble alignment
      directly: lead messages are left-aligned with the lead's avatar, business
      (HP) messages are right-aligned in blue. Direction below was read from
      that alignment, not inferred from wording, so it is exact rather than a
      guess."
    "anchor_basis": "not applicable - every timestamp in the screenshots is an
      absolute date/time"

No file the pipeline ships writes `source_kind`; `parse_dm_export.py:340-348`
writes `source_file`, `parsed_at`, `anchor_date`, `anchor_basis`, `lead_count`,
`warnings` and `leads`, and nothing else. The matching
`analysis/screenshots-dm-17-09-2026.analysis.json` records the same thing in its
`analyst` field: `"claude (direct, small export - 4 leads, direction read
visually from screenshots)"`.

That transcription was worth doing. It caught a real bug: the earlier text
export had recorded our own number 9XXXXXXXXX as the lead `lead_d`'s
mobile, and scored her `very_hot`, because a pasted thread loses which side of
the chat a bubble sits on (`README.md:656-667`). Reading the picture fixed it.
But it is manual work, and it is the reason `--images` below exists.

## 2. What input does the parser actually expect?

A `.txt` file holding threads copied out of Instagram web, threads separated by
a line of three or more dashes (`README.md:76-96`).

The rules, in code:

- `SEPARATOR_RE` (`parse_dm_export.py:32`) splits blocks on `^\s*-{3,}\s*$`.
- `HANDLE_RE` (`parse_dm_export.py:33`) is the only required line in a block:
  `^(?P<handle>[A-Za-z0-9._]{1,40})\s*[·]\s*Instagram\s*$`. A block without one
  is skipped with a warning (`parse_dm_export.py:121-127`).
- The display name is the nearest non-noise line above the handle line
  (`parse_dm_export.py:129-134`).
- Timestamps are separators between message groups, not per message, in three
  forms: absolute `26 Jul 2026, 16:01` (`ABS_TS_RE`, line 34), relative weekday
  `Mon 18:50` (`REL_TS_RE`, line 35) and bare `05:48` (`TIME_ONLY_RE`, line 36).

A concrete block:

    user-profile-picture
    Test Lead
    testlead_x · Instagram
    17 Sep 2026, 10:15
    Hi, 2bhk chahiye Bhandup mein
    Reply
    10:16
    Sure, budget kya hai?
    ---
    Another One
    another_y · Instagram
    17 Sep 2026, 11:00
    9876501234

That is the exact text used to test `--export` below; it parsed into two leads
and four messages.

## 3. Is the update incremental, and is the handle the key?

Yes to both, in three separate places.

### The lead key is the lowercased handle

`parse_dm_export.py:267` sets `"lead_id": handle.lower()` from the handle line,
and every downstream stage keys on it:

- Within one export, the same handle appearing in two blocks is folded into one
  record rather than added twice (`parse_dm_export.py:283-302`, called at
  `:329-330`).
- `upsert_leads_excel.py:504` builds `by_id = {as_text(row["lead_id"]).lower():
  row for row in existing_leads}` from the workbook, then `:512` looks the
  incoming lead up in it; a miss appends a row (`:514-527`), a hit merges into
  the row that is already there.
- `lead_db.py:43` makes `lead_id` the `leads` table PRIMARY KEY, and
  `upsert_lead` lowercases it at `lead_db.py:277` and matches case-insensitively
  at `:258-260`.

### Messages de-duplicate on (lead_id, date, time, text)

`upsert_leads_excel.py:578-590` reads every message already in the workbook into
`seen_messages` and skips any incoming message whose key is in it.
`migrate_to_sqlite.py:133-142` does the same against the SQLite table.
`scripts/ingest_to_db.py` uses the same four-part key.

### A blank never clears a stored value

`lead_db.py:270-274` says it outright, and `:304-305` enforces it:

    if protect_existing and not new:
        continue

So re-importing a partial export cannot wipe a field an earlier, fuller export
filled in. `upsert_leads_excel.py:89` carries the same rule for the analyst's
fields.

### The fetch window is incremental

`state/fetch-state.json` (path at `fetch_instagram_dms.py:46`,
`run_pipeline.py:45`) holds `last_success_started_at` plus, per Instagram thread
id, the handle, display name, tab and list preview line.

`fetch_instagram_dms.py:237-248` turns that into a window:

    last_success = state.get("last_success_started_at")
    if backfill_days is None and not last_success:
        backfill_days = cfg["first_run_backfill_days"]          # 30, config
    ...
        since_hours = (now - datetime.fromisoformat(last_success)).total_seconds() / 3600 \
                      + cfg["incremental_slack_hours"]          # 2, config
        window_hours = max(since_hours, 24.0)

So the first run ever backfills 30 days (`config/fetch-config.json:23`) and
every later run asks only for what changed since the last success, plus two
hours of slack (`config/fetch-config.json:25`) to cover clock skew and a run
that started before a message landed.

A thread is opened when it is newer than that window, when its preview line
differs from what state recorded, or when it has never been seen
(`fetch_instagram_dms.py:290-298`). Three known, unchanged rows in a row stop
the list walk (`:296-300`, `stop_after_unchanged_rows`, config line 30).

State only advances after the run succeeds. `run_pipeline.py:203-218`
(`apply_state`) is called at `:313-315` and `:352-354`, after the workbook write;
if Excel has the workbook open the whole run is parked in `pending_runs`
(`:341-345`) and replayed later (`apply_pending`, `:231-250`). A failed run
therefore re-fetches rather than skipping.

### What makes a re-run not duplicate

Four independent guards, any one of which would be enough for its own layer:

1. `lead_id` is the lowercased handle and is a primary key, so a second sighting
   of a handle is an update, never a second row.
2. Messages are keyed on `(lead_id, date, time, text)` against what is already
   stored, so the same message arriving twice is skipped.
3. Blank incoming values are ignored, so a thinner export cannot undo a richer
   one.
4. `last_success_started_at` means the fetcher does not even ask Instagram for
   threads that have not moved.

## 4. What breaks or is missed today

- **New DMs from a handle already in the sheet are not lost, but the run has to
  reach them.** The upsert handles it correctly — the lead row updates in place
  and only the new messages are appended. The gap is upstream: the fetcher opens
  a known thread only if its age is inside the window or its preview line
  changed (`fetch_instagram_dms.py:290-293`), and it gives up on the list after
  three unchanged rows (`:296-300`). A thread that moves while the run is
  paused — and the automated fetch is on hold entirely,
  `README.md:650-653` — is only picked up on the next run that sees it.
- **Threads Instagram shows as unread are deliberately skipped.**
  `fetch_instagram_dms.py:313-315` refuses to open them unless
  `open_unread_threads` is true, which it is not
  (`config/fetch-config.json:20-21`), so that the lead never sees a "Seen"
  receipt from the automation. The consequence is that the newest and most
  interesting threads are exactly the ones deferred, until a human opens them in
  Instagram. They are recorded in the run's `skipped` list, not in the sheet.
- **Messages with no timestamp get no date at all.** `parse_dm_export.py:251-253`
  writes `date: None` and `date_source: "before_first_timestamp"` for anything
  before the first timestamp separator. `README.md:624-627` records that four
  threads in the original sample had no timestamp anywhere, so their
  conversation dates are blank and they are missing from the datewise and
  weekwise sheets. Because the de-duplication key contains the date, two undated
  messages with the same text are also indistinguishable.
- **Direction is a guess in a pasted export.** 74 of 185 messages on the sample
  had a stated direction (`README.md:618-623`); the rest are `unknown` and lean
  on `config/business-phrases.json`. This is the misattribution that put our own
  number on `lead_d` (`README.md:656-667`).
- **Instagram stamps a group of bubbles, not each bubble**, so times are
  accurate to the group (`README.md:628-629`).
- **A landline is never captured.** `normalise_phone`
  (`parse_dm_export.py:82-91`) accepts only ten digits starting 6-9.
- **`screenshots-dm/` had no automated route in at all** before
  `ingest_to_db.py --images`. The pictures had to be read by hand.

---

## 5. Running scripts/ingest_to_db.py

It loads `parsed/*.parsed.json` and `analysis/*.analysis.json` into
`db/lead-desk.db` through `scripts/lead_db.py`, which is the only thing that
touches the database.

    python scripts/ingest_to_db.py --all
    python scripts/ingest_to_db.py --parsed parsed/x.parsed.json \
                                   --analysis analysis/x.analysis.json
    python scripts/ingest_to_db.py --all --since 2026-09-01
    python scripts/ingest_to_db.py --all --dry-run
    python scripts/ingest_to_db.py --export sample-dm-file.txt
    python scripts/ingest_to_db.py --images screenshots-dm/17-09-2026

| Flag | Meaning |
|------|---------|
| `--parsed FILE` | one parsed file. Its analysis is found by name if `--analysis` is not given |
| `--analysis FILE` | the judgement file to pair with it |
| `--all` | every file in `parsed/`, oldest first, each paired with its analysis by stem |
| `--since YYYY-MM-DD` | with `--all`, skip artefacts last written before this date |
| `--dry-run` | report the same numbers without writing anything |
| `--export FILE.txt` | parse a raw pasted DM export first, then ingest it |
| `--images FOLDER` | read `.png`/`.jpg` thread screenshots with the Gemini vision API, then ingest |
| `--anchor-date` | anchor for the weekday labels in an `--export` |

Exit codes: 0 ok, 1 bad input or a missing key, 2 nothing to ingest.

`--all` sorts oldest first on purpose: a later export is the more recent truth
about a lead, so it has to be the last writer.

### What it guarantees

- Leads merge through `lead_db.upsert_lead`, keyed on the lowercased handle. The
  blank-never-clears rule is that function's, not a reimplementation of it.
- Messages de-duplicate on `(lead_id, date, time, text)`, read back out of the
  `messages` table at the start of each file rather than remembered between
  runs.
- A message with a date but no time is stored at `00:00`, because normalising
  once means the key used to de-duplicate is the key that was stored. A message
  with no date at all keeps both fields blank, which is what
  `migrate_to_sqlite.py` stores too, so the two importers agree and do not each
  insert their own copy.
- `first_seen_run` is stamped only when the lead is new and `last_updated_run`
  only when something else actually changed, so an unchanged re-run reports
  nothing rather than reporting itself.
- One row goes into the `runs` table per ingest with the real counts.

### Dry run

`--dry-run` copies the database to a temporary directory, points `lead_db` at
the copy and does the whole job for real against it, then deletes it. The
numbers it prints are therefore the numbers a real run would produce, not a
second guess at the merge rules. A parsed artefact generated by `--export` or
`--images` during a dry run is written to that temporary directory too, so
`parsed/` is left alone.

### Raw .txt exports

`--export` reuses `parse_dm_export.py`'s own functions (`load_config`,
`resolve_anchor`, `split_blocks`, `parse_block`, `merge_duplicate`) and writes
the same `parsed/<name>.parsed.json` the manual pipeline writes, then ingests
it. `parse_dm_export.py` is not modified.

### Screenshots (`--images`)

Built because section 1 established that nothing else here can read an image.

It sends each `.png`/`.jpg` in the folder to
`https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`
as an `inline_data` base64 part, with a response schema pinning the output to
`{instagram_handle, display_name, messages[{text, direction, date, time}]}`. The
prompt tells the model to read direction from bubble alignment — left for the
lead, right and blue for us — and never from the wording, which is the whole
reason the hand transcription was more accurate than the text export. The result
is written out in exactly the shape `parse_dm_export.py` produces, so every
stage after it is unchanged and the handle stays the key.

Credentials come from the `.env` beside `README.md`: `GEMINI_API_KEY`, and
`GEMINI_MODEL` if you want to pin one (default `gemini-2.5-flash`). With no key
it prints where to put one and exits 1. Standard library only — `base64`,
`urllib`, `json`.

Several screenshots of one thread are merged into a single lead and their
overlapping bubbles de-duplicated on `(date, time, text)` before ingestion, so
scrolling a long conversation across four captures does not produce four leads
or four copies of the same message.

**Treat this path as a fallback, not as better than a careful reading.** On the
eight screenshots in `screenshots-dm/17-09-2026/` it read `lead_c` where the
handle is actually `https.lead_c`, returned nothing at all for one of the four
`lead_a` captures, and put that conversation's start at 2026-07-24 against
the hand-transcribed 2026-07-19. Ingesting it would have created a fifth,
duplicate lead. Run it with `--dry-run` first and read the per-image handle list
it prints before letting it write.

---

## 6. Test record

`db/lead-desk.db` already held the four leads and 26 messages from
`migrate_to_sqlite.py`, so the re-run behaviour was checked against real data.

    $ python scripts/lead_db.py --stats
    database: ...\local-insta-automation\db\lead-desk.db
      leads      4
      messages   26

    $ python scripts/ingest_to_db.py --all --dry-run
    ingesting screenshots-dm-17-09-2026.parsed.json + screenshots-dm-17-09-2026.analysis.json

    run ingest-20260918-011057-565  (DRY RUN, nothing written)
      leads    : 0 new, 0 updated, 4 unchanged  (4 in the files)
      messages : 0 added, 26 skipped as duplicates
      reels    : 0 added
      handles  : lead_d, lead_b, https.lead_c, lead_a

The same run against an empty database, twice, to show both halves:

    run 1:  leads: 4 new, 0 updated, 0 unchanged   messages: 26 added, 0 skipped
    run 2:  leads: 0 new, 0 updated, 4 unchanged   messages: 0 added, 26 skipped

And with a synthetic export carrying one new message for `lead_a` (a handle
already stored), a brand-new handle `NewHandle_99`, a blank `lead_name` and an
undated message:

    run 1:  leads: 1 new, 1 updated, 0 unchanged   messages: 4 added, 0 skipped
    run 2:  leads: 0 new, 0 updated, 2 unchanged   messages: 0 added, 4 skipped

`lead_a` kept the name `Lead A` against the blank incoming value,
`NewHandle_99` was stored as `newhandle_99`, and the undated message went in
with blank `date` and `time` and matched itself on the second run.

## Handle guard on the screenshot path (added after the accuracy test above)

Reading a handle off a picture is the one step in this pipeline with no ground
truth behind it, and a single wrong character creates a second lead for someone
already on file. `--images` now checks every handle it reads against the
handles already in the database before ingesting:

- a handle that is a fragment of a stored one, or that a stored one is a
  fragment of, snaps to the stored one
- otherwise a close spelling (difflib ratio 0.85 or better) snaps to it
- anything else is left exactly as the model read it, because an unfamiliar
  handle is how a genuinely new lead arrives

The real case this was written for is the `lead_c` / `https.lead_c` misread
recorded above: it now resolves to the existing lead and prints

```
  17-09-2026-04.png    read as @lead_c, matched to @https.lead_c already on file
```

both in the run output and in the parsed file's warnings, so the correction is
visible rather than silent. It does not make the vision path trustworthy on its
own -- the missing messages and the wrong start date in the test are untouched
by it -- so `--dry-run` first, and check the per-image handle list, still
stands.
