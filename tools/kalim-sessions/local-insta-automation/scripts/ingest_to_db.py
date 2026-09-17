#!/usr/bin/env python3
"""
ingest_to_db.py -- load the pipeline's artefacts into db/lead-desk.db.

The pipeline already writes parsed/<name>.parsed.json (facts) and
analysis/<name>.analysis.json (judgement). This is the step that folds them
into SQLite, keyed on the Instagram handle, so the same export can be replayed
as often as you like without growing the database.

What makes a re-run safe:
  - leads merge through lead_db.upsert_lead, which never lets a blank incoming
    value clear something already known
  - messages de-duplicate on (lead_id, date, time, text), read back out of the
    database first, not kept in memory between runs
  - reels carry a UNIQUE(lead_id, url) constraint of their own

Usage:
    python scripts/ingest_to_db.py --all
    python scripts/ingest_to_db.py --parsed parsed/x.parsed.json \
                                   --analysis analysis/x.analysis.json
    python scripts/ingest_to_db.py --all --since 2026-09-01 --dry-run
    python scripts/ingest_to_db.py --export sample-dm-file.txt
    python scripts/ingest_to_db.py --images screenshots-dm/17-09-2026

Exit codes: 0 ok, 1 bad input or missing credentials, 2 nothing to ingest.
"""

import argparse
import base64
import difflib
import glob
import json
import os
import shutil
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import lead_db as db  # noqa: E402
import parse_dm_export as pde  # noqa: E402

PARSED_DIR = os.path.join(ROOT, "parsed")
ANALYSIS_DIR = os.path.join(ROOT, "analysis")
ENV_PATH = os.path.join(ROOT, ".env")

GEMINI_HOST = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg")

# Derived from the messages table by refresh_computed. Importing the file's
# copy would overwrite a fresh value with a stale one and report a change on
# every single run.
COMPUTED_COLUMNS = {
    "requirement_complete", "dm_can_be_closed", "close_reason",
    "days_since_last_message", "message_count", "conversation_end_date",
}

# Written by this script, not by the export, so they are kept out of the
# content merge and stamped separately once the outcome is known.
RUN_COLUMNS = {"first_seen_run", "last_updated_run", "source_files"}


def log(msg):
    print(msg, flush=True)


# ------------------------------------------------------------------ files --

def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def stem_of(path):
    """parsed/x.parsed.json and analysis/x.analysis.json share the stem 'x'."""
    name = os.path.basename(path)
    for suffix in (".parsed.json", ".analysis.json"):
        if name.endswith(suffix):
            return name[:-len(suffix)]
    return os.path.splitext(name)[0]


def mtime_date(path):
    return date.fromtimestamp(os.path.getmtime(path))


def collect_all(since):
    """Every parsed file, oldest first, paired with its analysis when there is one.

    Oldest first matters: a later export is the more recent truth about a lead,
    so it has to be the last writer.
    """
    analyses = {stem_of(p): p
                for p in glob.glob(os.path.join(ANALYSIS_DIR, "*.analysis.json"))}
    pairs = []
    for parsed_path in glob.glob(os.path.join(PARSED_DIR, "*.parsed.json")):
        if since and mtime_date(parsed_path) < since:
            continue
        pairs.append((parsed_path, analyses.get(stem_of(parsed_path))))
    pairs.sort(key=lambda pair: os.path.getmtime(pair[0]))
    return pairs


# --------------------------------------------------------------- merging ---

def lead_values(record, judgement):
    """One row's worth of columns, facts first, judgement on top."""
    values = {
        "lead_id": db.as_text(record.get("lead_id")).lower(),
        "lead_name": db.as_text(record.get("lead_name")),
        "instagram_link": db.as_text(record.get("instagram_link")),
        "conversation_start_date": db.as_text(record.get("conversation_start_date")),
    }
    phones = [db.as_text(p) for p in record.get("phones_detected") or []]
    if phones:
        values["mobile_number"] = "; ".join(phones)
    if not values["instagram_link"] and values["lead_id"]:
        values["instagram_link"] = "https://www.instagram.com/%s/" % values["lead_id"]

    for key, value in (judgement or {}).items():
        if key in db.LEAD_COLUMNS and key not in COMPUTED_COLUMNS \
                and key not in RUN_COLUMNS and key != "lead_id":
            text = db.as_text(value)
            if text:
                values[key] = text
    return values


def message_rows(record, source_file):
    """Normalise once, so the key used to de-duplicate is the key that is stored."""
    lead_id = db.as_text(record.get("lead_id")).lower()
    lead_name = db.as_text(record.get("lead_name"))
    out = []
    for message in record.get("messages") or []:
        day = db.as_text(message.get("date"))
        # Instagram stamps a group of bubbles, not each one, so a message can
        # have a date and no time. Pinning it to 00:00 keeps the key stable
        # across runs; a message with no date at all keeps both blank, which is
        # what migrate_to_sqlite stores too, so the two importers agree.
        time_of_day = db.as_text(message.get("time"))
        if day and not time_of_day:
            time_of_day = "00:00"
        if not day:
            time_of_day = ""
        out.append({
            "lead_id": lead_id,
            "lead_name": lead_name,
            "date": day,
            "time": time_of_day,
            "date_source": db.as_text(message.get("date_source")),
            "direction": db.as_text(message.get("direction")) or "unknown",
            "text": db.as_text(message.get("text")),
            "source_file": source_file,
        })
    return out


def existing_message_keys(conn):
    return {(db.as_text(r[0]).lower(), db.as_text(r[1]), db.as_text(r[2]),
             db.as_text(r[3]))
            for r in conn.execute("SELECT lead_id, date, time, text FROM messages")}


def store_message(conn, row):
    if row["date"]:
        when = datetime.fromisoformat("%sT%s" % (row["date"], row["time"]))
        db.add_message(conn, row["lead_id"], row["direction"], row["text"],
                       lead_name=row["lead_name"], when=when,
                       date_source=row["date_source"],
                       source_file=row["source_file"])
        return
    # add_message always resolves a datetime, so an undated message would be
    # stamped with today and stop matching itself on the next run. These rows
    # go in with the blank date the export actually carried.
    conn.execute(
        "INSERT INTO messages (lead_id, lead_name, date, time, date_source,"
        " direction, text, source_file, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (row["lead_id"], row["lead_name"], "", "", row["date_source"],
         row["direction"], row["text"], row["source_file"], db.now_iso()))


def merge_source_files(existing, incoming):
    files = [f.strip() for f in db.as_text(existing).split(";") if f.strip()]
    if incoming not in files:
        files.append(incoming)
    return "; ".join(files)


# --------------------------------------------------------------- ingest ----

def ingest_pair(conn, parsed_path, analysis_path, run_id, counts):
    parsed = read_json(parsed_path)
    judgements = {}
    if analysis_path:
        for entry in read_json(analysis_path).get("leads") or []:
            lead_id = db.as_text(entry.get("lead_id")).lower()
            if lead_id:
                judgements[lead_id] = entry

    source = os.path.basename(parsed_path)
    seen = existing_message_keys(conn)
    touched = []

    for record in parsed.get("leads") or []:
        values = lead_values(record, judgements.get(
            db.as_text(record.get("lead_id")).lower()))
        lead_id = values["lead_id"]
        if not lead_id:
            continue
        touched.append(lead_id)
        counts["in_file"] += 1

        existing = db.get_lead(conn, lead_id)
        values["source_files"] = merge_source_files(
            (existing or {}).get("source_files"), source)
        if existing is None:
            values["first_seen_run"] = run_id
            values["last_updated_run"] = run_id

        outcome, _ = db.upsert_lead(conn, values, run_id=run_id,
                                    change_type="ingest", source_file=source)
        counts[outcome] += 1
        if outcome == "updated":
            # Stamped after the fact: writing it up front would make every run
            # a change and every re-run look like new work.
            db.upsert_lead(conn, {"lead_id": lead_id, "last_updated_run": run_id},
                           run_id=run_id, change_type="ingest", source_file=source)

        blob = " ".join(db.as_text(u) for u in record.get("reel_links") or [])
        if blob:
            known = {r["url"].lower() for r in db.reels_for(conn, lead_id)}
            fresh = [r for r in db.parse_reel_links(blob)
                     if r["url"].lower() not in known]
            if fresh:
                added, _ = db.add_reels(conn, lead_id, blob)
                counts["reels"] += added

        for row in message_rows(record, source):
            key = (row["lead_id"], row["date"], row["time"], row["text"])
            if key in seen:
                counts["messages_skipped"] += 1
                continue
            seen.add(key)
            store_message(conn, row)
            counts["messages"] += 1

    conn.commit()
    for lead_id in dict.fromkeys(touched):
        db.refresh_computed(conn, lead_id)
    counts["anchor_date"] = counts["anchor_date"] or db.as_text(
        parsed.get("anchor_date"))
    counts["handles"].extend(dict.fromkeys(touched))
    counts["sources"].append(source)
    return counts


def record_run(conn, run_id, counts):
    conn.execute(
        "INSERT OR REPLACE INTO runs (run_id, run_timestamp, source_file,"
        " anchor_date, leads_in_file, new_leads, updated_leads, unchanged_leads,"
        " messages_added) VALUES (?,?,?,?,?,?,?,?,?)",
        (run_id, db.now_iso(), "; ".join(dict.fromkeys(counts["sources"])),
         counts["anchor_date"], counts["in_file"], counts["new"],
         counts["updated"], counts["unchanged"], counts["messages"]))
    conn.commit()


# ------------------------------------------------- raw .txt export input ---

def parse_export(txt_path, out_dir, anchor_override=None):
    """Run the existing text parser over a pasted export and keep its output.

    parse_dm_export.py stays untouched; this reuses its functions so an export
    ingested here and one run through the pipeline by hand produce the same file.
    """
    cfg = pde.load_config()
    anchor, anchor_basis = pde.resolve_anchor(txt_path, anchor_override)
    with open(txt_path, encoding="utf-8") as fh:
        raw_lines = fh.readlines()

    warnings, leads, order = [], {}, []
    for block in pde.split_blocks(raw_lines):
        record = pde.parse_block(block, anchor, cfg, warnings)
        if record is None:
            continue
        if record["lead_id"] in leads:
            pde.merge_duplicate(leads[record["lead_id"]], record)
        else:
            leads[record["lead_id"]] = record
            order.append(record["lead_id"])
    if not leads:
        return None, warnings

    payload = {
        "source_file": os.path.abspath(txt_path),
        "parsed_at": datetime.now().isoformat(timespec="seconds"),
        "anchor_date": anchor.isoformat(),
        "anchor_basis": anchor_basis,
        "lead_count": len(leads),
        "warnings": warnings,
        "leads": [leads[k] for k in order],
    }
    out = os.path.join(out_dir, "%s.parsed.json"
                       % os.path.splitext(os.path.basename(txt_path))[0])
    os.makedirs(out_dir, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    return out, warnings


# ----------------------------------------------- optional: screenshot input --
# Nothing else in this folder can read an image. parse_dm_export.py takes
# .txt only (it calls readlines on the file), the DOM extractor reduces an
# attached picture to the literal string "[image]", and the one parsed file
# whose name says "screenshots-dm" was transcribed by hand. This path closes
# that gap: it asks a vision model to read the screenshots and emits exactly
# the shape parse_dm_export.py emits, so everything downstream is unchanged.

IMAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "instagram_handle": {"type": "string"},
        "display_name": {"type": "string"},
        "messages": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "direction": {"type": "string"},
                    "date": {"type": "string"},
                    "time": {"type": "string"},
                },
                "required": ["text", "direction"],
            },
        },
    },
    "required": ["instagram_handle", "messages"],
}

IMAGE_PROMPT = """You are reading one screenshot of an Instagram Direct thread
taken from Instagram web by the account @happyproperties99, a Mumbai real
estate agency.

Return JSON only.

instagram_handle: the handle of the OTHER person in the thread, exactly as
Instagram spells it, without the @. It is in the thread header or on the
profile link. If you cannot read it, return an empty string.
display_name: that person's display name from the header.
messages: every message bubble you can read, top to bottom, in order.
  text      the message exactly as written, one bubble per entry. Skip
            reactions, "Seen", typing indicators and date separators.
  direction "lead" for a left-aligned bubble (grey/white, next to the other
            person's avatar) and "business" for a right-aligned bubble (blue,
            ours). Read the alignment, never the wording.
  date      the date that bubble sits under, as YYYY-MM-DD, from the nearest
            separator above it. Empty string if no date is visible anywhere.
  time      HH:MM in 24-hour form if a time is visible, otherwise empty.

Do not invent a handle, a date or a message. An empty string is the correct
answer when something is not on screen."""


def load_env():
    """Minimal .env reader, same rules the lead desk server uses."""
    config = {}
    if os.path.isfile(ENV_PATH):
        with open(ENV_PATH, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                config[key.strip()] = value.strip().strip('"').strip("'")
    for key in ("GEMINI_API_KEY", "GEMINI_MODEL"):
        if os.environ.get(key):
            config[key] = os.environ[key]
    return config


def mime_for(path):
    return "image/png" if path.lower().endswith(".png") else "image/jpeg"


def read_screenshot(path, key, model):
    with open(path, "rb") as fh:
        encoded = base64.b64encode(fh.read()).decode("ascii")
    payload = {
        "contents": [{"role": "user", "parts": [
            {"text": IMAGE_PROMPT},
            {"inline_data": {"mime_type": mime_for(path), "data": encoded}},
        ]}],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseSchema": IMAGE_SCHEMA,
        },
    }
    url = "%s/models/%s:generateContent?key=%s" % (
        GEMINI_HOST, urllib.parse.quote(model), urllib.parse.quote(key))
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), method="POST")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        raise RuntimeError("Gemini HTTP %s: %s" % (exc.code, detail))
    except urllib.error.URLError as exc:
        raise RuntimeError("could not reach Gemini: %s" % exc.reason)

    candidates = body.get("candidates") or []
    if not candidates:
        blocked = body.get("promptFeedback", {}).get("blockReason")
        raise RuntimeError("Gemini returned nothing" +
                           (" (blocked: %s)" % blocked if blocked else ""))
    text = "".join(part.get("text", "")
                   for part in candidates[0].get("content", {}).get("parts") or [])
    try:
        return json.loads(text)
    except ValueError:
        raise RuntimeError("Gemini did not return valid JSON: %s" % text[:300])


def snap_handle(handle, known):
    """Correct a handle the vision model nearly got right.

    Reading a handle off a screenshot is the one step with no ground truth
    behind it, and a single wrong character creates a second lead for a person
    already on file. A handle that is a fragment of one we know, or a near
    spelling of it, is the model dropping or mangling characters rather than a
    new person: a read of "name" against a stored "https.name" is the real case
    this was written for. An unfamiliar handle is left exactly as read.
    """
    lowered = handle.lower()
    if not known or lowered in known:
        return lowered, ""
    for candidate in known:
        if lowered in candidate or candidate in lowered:
            return candidate, ("read as @%s, matched to @%s already on file"
                               % (handle, candidate))
    close = difflib.get_close_matches(lowered, list(known), n=1, cutoff=0.85)
    if close:
        return close[0], ("read as @%s, matched to @%s already on file"
                          % (handle, close[0]))
    return lowered, ""


def parse_images(folder, out_dir, known_handles=None):
    """Turn a folder of thread screenshots into a parsed payload."""
    config = load_env()
    key = config.get("GEMINI_API_KEY", "")
    if not key:
        log("GEMINI_API_KEY is not set. Put it in %s (copy .env.sample to .env)"
            % ENV_PATH)
        log("or export it for this shell, then run --images again.")
        return None, 1
    model = config.get("GEMINI_MODEL", "").strip() or DEFAULT_GEMINI_MODEL

    images = sorted(os.path.join(folder, n) for n in os.listdir(folder)
                    if n.lower().endswith(IMAGE_SUFFIXES))
    if not images:
        log("no .png or .jpg files in %s" % folder)
        return None, 2

    log("reading %d screenshot(s) with %s" % (len(images), model))
    leads, order, warnings = {}, [], []
    for path in images:
        name = os.path.basename(path)
        try:
            result = read_screenshot(path, key, model)
        except RuntimeError as exc:
            warnings.append("%s: %s" % (name, exc))
            log("  %-44s FAILED: %s" % (name, exc))
            continue

        handle = db.as_text(result.get("instagram_handle")).lstrip("@")
        if not handle:
            warnings.append("%s: no handle readable, skipped" % name)
            log("  %-44s no handle readable, skipped" % name)
            continue

        lead_id, snapped = snap_handle(handle, known_handles or set())
        if snapped:
            warnings.append("%s: %s" % (name, snapped))
            log("  %-44s %s" % (name, snapped))
            handle = lead_id
        record = leads.get(lead_id)
        if record is None:
            record = {
                "lead_id": lead_id,
                "lead_name": db.as_text(result.get("display_name")),
                "instagram_handle": handle,
                "instagram_link": "https://www.instagram.com/%s/" % handle,
                "phones_detected": [],
                "whatsapp_mentioned_in_chat": False,
                "reel_links": [],
                "seen_marker": False,
                "messages": [],
                "source_images": [],
            }
            leads[lead_id] = record
            order.append(lead_id)
        record["source_images"].append(name)

        # Consecutive screenshots of one thread overlap where they were
        # scrolled, so the same bubble arrives twice.
        present = {(m["date"], m["time"], m["text"]) for m in record["messages"]}
        for message in result.get("messages") or []:
            text = db.as_text(message.get("text"))
            if not text:
                continue
            day = db.as_text(message.get("date"))
            time_of_day = db.as_text(message.get("time"))
            direction = db.as_text(message.get("direction")).lower()
            if direction not in ("lead", "business"):
                direction = "unknown"
            if (day, time_of_day, text) in present:
                continue
            present.add((day, time_of_day, text))
            record["messages"].append({
                "date": day or None,
                "time": time_of_day or None,
                "date_source": "absolute" if day else "before_first_timestamp",
                "direction": direction,
                "direction_basis": "screenshot: bubble alignment read by %s" % model,
                "text": text,
            })
        log("  %-44s @%s, %d message(s)"
            % (name, handle, len(result.get("messages") or [])))

    if not leads:
        log("nothing readable in %s" % folder)
        return None, 2

    for record in leads.values():
        record["messages"].sort(key=lambda m: (m["date"] or "9999",
                                               m["time"] or "99:99"))
        dated = [m["date"] for m in record["messages"] if m["date"]]
        record["conversation_start_date"] = min(dated) if dated else None
        record["conversation_end_date"] = max(dated) if dated else None
        record["message_count"] = len(record["messages"])
        record["undated_message_count"] = len(record["messages"]) - len(dated)
        for message in record["messages"]:
            for url in pde.URL_RE.findall(message["text"]):
                if url not in record["reel_links"]:
                    record["reel_links"].append(url)

    payload = {
        "source_file": os.path.abspath(folder),
        "source_kind": "screenshot_vision",
        "screenshot_files": [os.path.basename(p) for p in images],
        "vision_model": model,
        "parsed_at": datetime.now().isoformat(timespec="seconds"),
        "anchor_date": date.today().isoformat(),
        "anchor_basis": "not applicable - timestamps come from the screenshots",
        "lead_count": len(leads),
        "warnings": warnings,
        "leads": [leads[k] for k in order],
    }
    out = os.path.join(out_dir, "%s.parsed.json"
                       % os.path.basename(os.path.normpath(folder)))
    os.makedirs(out_dir, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    log("wrote %s" % out)
    return out, 0


# ------------------------------------------------------------------ main ---

def standalone_analysis(args):
    """--analysis belongs to --export / --images only when --parsed is absent."""
    if args.parsed or not args.analysis:
        return None
    return args.analysis if os.path.isfile(args.analysis) else None


def cleanup(scratch):
    if scratch:
        shutil.rmtree(scratch, ignore_errors=True)


def new_counts():
    return {"in_file": 0, "new": 0, "updated": 0, "unchanged": 0,
            "messages": 0, "messages_skipped": 0, "reels": 0,
            "anchor_date": "", "handles": [], "sources": []}


def use_scratch_copy():
    """Point lead_db at a throwaway copy of the database.

    A dry run has to report exactly what a real run would do, so it does the
    real work against a copy rather than against a second guess at the merge
    rules.
    """
    scratch = tempfile.mkdtemp(prefix="ingest-dry-run-")
    target = os.path.join(scratch, "lead-desk.db")
    for suffix in ("", "-wal", "-shm"):
        side = db.DB_PATH + suffix
        if os.path.isfile(side):
            shutil.copyfile(side, target + suffix)
    db.DB_PATH = target
    return scratch


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--parsed", help="one parsed/<name>.parsed.json")
    parser.add_argument("--analysis", help="its analysis/<name>.analysis.json")
    parser.add_argument("--all", action="store_true",
                        help="every file in parsed/, oldest first")
    parser.add_argument("--since", metavar="YYYY-MM-DD",
                        help="with --all, skip artefacts last written before this date")
    parser.add_argument("--export", metavar="FILE",
                        help="a raw pasted DM .txt, parsed first by parse_dm_export.py")
    parser.add_argument("--images", metavar="FOLDER",
                        help="a folder of thread screenshots, read by the Gemini"
                             " vision API (needs GEMINI_API_KEY in .env)")
    parser.add_argument("--anchor-date", help="anchor for --export weekday labels")
    parser.add_argument("--dry-run", action="store_true",
                        help="report the same numbers without touching the database")
    args = parser.parse_args()

    if not (args.parsed or args.all or args.export or args.images):
        parser.error("give one of --parsed, --all, --export or --images")

    since = None
    if args.since:
        try:
            since = date.fromisoformat(args.since)
        except ValueError:
            log("ERROR: --since wants YYYY-MM-DD, got %r" % args.since)
            return 1

    scratch = use_scratch_copy() if args.dry_run else None
    out_dir = scratch or PARSED_DIR

    pairs = []
    if args.export:
        if not os.path.isfile(args.export):
            log("ERROR: no such file: %s" % args.export)
            cleanup(scratch)
            return 1
        parsed_path, warnings = parse_export(args.export, out_dir,
                                             args.anchor_date)
        if parsed_path is None:
            log("ERROR: no lead blocks parsed from %s" % args.export)
            cleanup(scratch)
            return 2
        for warning in warnings:
            log("WARNING: %s" % warning)
        log("parsed %s -> %s" % (args.export, parsed_path))
        pairs.append((parsed_path, standalone_analysis(args)))

    if args.images:
        if not os.path.isdir(args.images):
            log("ERROR: no such folder: %s" % args.images)
            cleanup(scratch)
            return 1
        # Handles already on file, so a misread one snaps to the real lead
        # instead of creating a second row for the same person.
        probe = db.init()
        known = {row["lead_id"] for row in db.all_leads(probe)}
        probe.close()
        parsed_path, code = parse_images(args.images, out_dir, known)
        if parsed_path is None:
            cleanup(scratch)
            return code
        pairs.append((parsed_path, standalone_analysis(args)))

    if args.parsed:
        if not os.path.isfile(args.parsed):
            log("ERROR: no such file: %s" % args.parsed)
            cleanup(scratch)
            return 1
        analysis = args.analysis
        if analysis and not os.path.isfile(analysis):
            log("ERROR: no such file: %s" % analysis)
            cleanup(scratch)
            return 1
        if not analysis:
            guess = os.path.join(ANALYSIS_DIR,
                                 "%s.analysis.json" % stem_of(args.parsed))
            analysis = guess if os.path.isfile(guess) else None
        pairs.append((args.parsed, analysis))

    if args.all:
        pairs.extend(collect_all(since))

    if not pairs:
        log("nothing to ingest")
        cleanup(scratch)
        return 2

    try:
        conn = db.init()
        # Milliseconds, because two ingests a second apart are still two runs.
        run_id = datetime.now().strftime("ingest-%Y%m%d-%H%M%S-%f")[:-3]
        counts = new_counts()
        for parsed_path, analysis_path in pairs:
            log("ingesting %s%s" % (
                os.path.basename(parsed_path),
                " + %s" % os.path.basename(analysis_path) if analysis_path else ""))
            ingest_pair(conn, parsed_path, analysis_path, run_id, counts)
        record_run(conn, run_id, counts)
        totals = db.stats(conn)
    finally:
        cleanup(scratch)

    log("")
    log("run %s%s" % (run_id, "  (DRY RUN, nothing written)" if args.dry_run else ""))
    log("  leads    : %d new, %d updated, %d unchanged  (%d in the files)"
        % (counts["new"], counts["updated"], counts["unchanged"], counts["in_file"]))
    log("  messages : %d added, %d skipped as duplicates"
        % (counts["messages"], counts["messages_skipped"]))
    log("  reels    : %d added" % counts["reels"])
    handles = list(dict.fromkeys(counts["handles"]))
    log("  handles  : %s" % (", ".join(handles) or "none"))
    if not args.dry_run:
        log("  database : %s" % ", ".join("%s %d" % (k, v)
                                          for k, v in totals.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
