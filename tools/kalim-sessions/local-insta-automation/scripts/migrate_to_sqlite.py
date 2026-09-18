#!/usr/bin/env python3
"""
migrate_to_sqlite.py -- move the lead desk off Excel and onto SQLite.

Reads master/hp-insta-leads.xlsx (if it is there) and copies every sheet into
db/lead-desk.db. Where there is no workbook it falls back to the parsed/ and
analysis/ JSON the pipeline already writes, so a fresh machine can still start.

It is safe to run more than once: leads merge by lead_id, messages de-duplicate
on (lead_id, date, time, text), and the changelog and run log skip rows that are
already there.

Usage:
    python scripts/migrate_to_sqlite.py
    python scripts/migrate_to_sqlite.py --workbook master/hp-insta-leads.xlsx
    python scripts/migrate_to_sqlite.py --from-json     # skip the workbook
    python scripts/migrate_to_sqlite.py --reset         # start the db empty
"""

import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import lead_db as db  # noqa: E402

DEFAULT_WORKBOOK = os.path.join(ROOT, "master", "hp-insta-leads.xlsx")

SHEETS = {
    "Leads": "leads",
    "Messages": "messages",
    "Changelog": "changelog",
    "Run Log": "runs",
}

# Derived in the database from the messages, so importing the workbook's copy
# would overwrite a fresh value with a stale one and report a change every run.
COMPUTED_COLUMNS = {
    "requirement_complete", "dm_can_be_closed", "close_reason",
    "days_since_last_message", "message_count",
}


def read_workbook(path):
    from openpyxl import load_workbook
    workbook = load_workbook(path, data_only=True)
    out = {}
    for sheet_name, key in SHEETS.items():
        if sheet_name not in workbook.sheetnames:
            out[key] = []
            continue
        sheet = workbook[sheet_name]
        header = [db.as_text(c.value) for c in sheet[1]]
        records = []
        for raw in sheet.iter_rows(min_row=2, values_only=True):
            if all(v in (None, "") for v in raw):
                continue
            records.append({header[i]: db.as_text(raw[i])
                            for i in range(min(len(header), len(raw)))})
        out[key] = records
    return out


def read_json_fallback():
    """Rebuild from the pipeline's own artefacts when there is no workbook."""
    leads, messages = {}, []
    for path in sorted(glob.glob(os.path.join(ROOT, "parsed", "*.parsed.json"))):
        with open(path, encoding="utf-8") as fh:
            payload = json.load(fh)
        source = os.path.basename(path)
        for record in payload.get("leads", payload if isinstance(payload, list) else []):
            lead_id = db.as_text(record.get("lead_id") or
                                 record.get("instagram_id")).lower()
            if not lead_id:
                continue
            row = leads.setdefault(lead_id, {"lead_id": lead_id})
            for key in db.LEAD_COLUMNS:
                if record.get(key) and not row.get(key):
                    row[key] = db.as_text(record[key])
            row.setdefault("lead_name", db.as_text(record.get("lead_name")))
            row.setdefault("instagram_link",
                           "https://www.instagram.com/%s/" % lead_id)
            for message in record.get("messages", []):
                messages.append({
                    "lead_id": lead_id,
                    "lead_name": row.get("lead_name", ""),
                    "date": db.as_text(message.get("date")),
                    "time": db.as_text(message.get("time")),
                    "date_source": db.as_text(message.get("date_source")),
                    "direction": db.as_text(message.get("direction")) or "unknown",
                    "text": db.as_text(message.get("text")),
                    "source_file": source,
                })

    for path in sorted(glob.glob(os.path.join(ROOT, "analysis", "*.analysis.json"))):
        with open(path, encoding="utf-8") as fh:
            payload = json.load(fh)
        for record in payload.get("leads", payload if isinstance(payload, list) else []):
            lead_id = db.as_text(record.get("lead_id")).lower()
            if not lead_id:
                continue
            row = leads.setdefault(lead_id, {"lead_id": lead_id})
            for key in db.LEAD_COLUMNS:
                if record.get(key):
                    row[key] = db.as_text(record[key])
    return {"leads": list(leads.values()), "messages": messages,
            "changelog": [], "runs": []}


def import_payload(conn, payload, source_label):
    counts = {"new": 0, "updated": 0, "unchanged": 0, "messages": 0,
              "changelog": 0, "runs": 0, "reels": 0}

    for record in payload.get("leads", []):
        record = {k: v for k, v in record.items()
                  if k in db.LEAD_COLUMNS and k not in COMPUTED_COLUMNS}
        if not db.as_text(record.get("lead_id")):
            continue
        outcome, _ = db.upsert_lead(conn, record, change_type="excel import",
                                    source_file=source_label)
        counts[outcome] = counts.get(outcome, 0) + 1
        blob = db.as_text(record.get("reel_links"))
        if blob:
            added, _ = db.add_reels(conn, db.as_text(record["lead_id"]).lower(),
                                    blob)
            counts["reels"] += added

    seen = set()
    for row in conn.execute("SELECT lead_id, date, time, text FROM messages"):
        seen.add((row[0].lower(), row[1], row[2], row[3]))
    for message in payload.get("messages", []):
        lead_id = db.as_text(message.get("lead_id")).lower()
        key = (lead_id, db.as_text(message.get("date")),
               db.as_text(message.get("time")), db.as_text(message.get("text")))
        if not lead_id or key in seen:
            continue
        seen.add(key)
        conn.execute(
            "INSERT INTO messages (lead_id, lead_name, date, time, date_source,"
            " direction, text, source_file, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (lead_id, db.as_text(message.get("lead_name")),
             db.as_text(message.get("date")), db.as_text(message.get("time")),
             db.as_text(message.get("date_source")),
             db.as_text(message.get("direction")) or "unknown",
             db.as_text(message.get("text")),
             db.as_text(message.get("source_file")) or source_label, db.now_iso()))
        counts["messages"] += 1

    have_log = set()
    for row in conn.execute("SELECT run_id, lead_id, field, new_value FROM changelog"):
        have_log.add(tuple(db.as_text(v) for v in row))
    for entry in payload.get("changelog", []):
        key = (db.as_text(entry.get("run_id")), db.as_text(entry.get("lead_id")),
               db.as_text(entry.get("field")), db.as_text(entry.get("new_value")))
        if key in have_log:
            continue
        have_log.add(key)
        conn.execute(
            "INSERT INTO changelog (run_id, run_timestamp, lead_id, lead_name,"
            " change_type, field, old_value, new_value, source_file)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            tuple(db.as_text(entry.get(c)) for c in
                  ("run_id", "run_timestamp", "lead_id", "lead_name",
                   "change_type", "field", "old_value", "new_value",
                   "source_file")))
        counts["changelog"] += 1

    for run in payload.get("runs", []):
        run_id = db.as_text(run.get("run_id"))
        if not run_id:
            continue
        conn.execute(
            "INSERT OR REPLACE INTO runs (run_id, run_timestamp, source_file,"
            " anchor_date, leads_in_file, new_leads, updated_leads,"
            " unchanged_leads, messages_added) VALUES (?,?,?,?,?,?,?,?,?)",
            (run_id, db.as_text(run.get("run_timestamp")),
             db.as_text(run.get("source_file")), db.as_text(run.get("anchor_date")),
             run.get("leads_in_file") or 0, run.get("new_leads") or 0,
             run.get("updated_leads") or 0, run.get("unchanged_leads") or 0,
             run.get("messages_added") or 0))
        counts["runs"] += 1

    conn.commit()
    for lead in db.all_leads(conn):
        db.refresh_computed(conn, lead["lead_id"])
    return counts


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--workbook", default=DEFAULT_WORKBOOK)
    parser.add_argument("--from-json", action="store_true",
                        help="ignore the workbook and rebuild from parsed/ + analysis/")
    parser.add_argument("--reset", action="store_true",
                        help="delete the database first")
    args = parser.parse_args()

    if args.reset and os.path.isfile(db.DB_PATH):
        os.remove(db.DB_PATH)
        for suffix in ("-wal", "-shm"):
            side = db.DB_PATH + suffix
            if os.path.isfile(side):
                os.remove(side)
        print("removed the old database")

    conn = db.init()

    if not args.from_json and os.path.isfile(args.workbook):
        payload = read_workbook(args.workbook)
        label = os.path.basename(args.workbook)
        print("reading %s" % args.workbook)
    else:
        payload = read_json_fallback()
        label = "parsed+analysis json"
        print("no workbook, rebuilding from parsed/ and analysis/")

    counts = import_payload(conn, payload, label)
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)",
                 ("migrated_from", label))
    conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)",
                 ("migrated_at", db.now_iso()))
    conn.commit()

    print("\nimported into %s" % db.DB_PATH)
    print("  leads   : %d new, %d updated, %d unchanged"
          % (counts["new"], counts["updated"], counts["unchanged"]))
    print("  messages: %d added" % counts["messages"])
    print("  reels   : %d added" % counts["reels"])
    print("  history : %d changelog, %d runs" % (counts["changelog"], counts["runs"]))
    print("\nnow holding: %s" % ", ".join(
        "%s %d" % (k, v) for k, v in db.stats(conn).items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
