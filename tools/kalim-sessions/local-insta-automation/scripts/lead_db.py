#!/usr/bin/env python3
"""
lead_db.py -- the SQLite store behind the Instagram Lead Desk app.

This replaces master/hp-insta-leads.xlsx as the source of truth. Everything the
app reads or writes goes through here, so there is exactly one place that knows
the shape of the data.

Tables
    leads       one row per Instagram handle, same columns the workbook had
    messages    every DM, lead-sent, us-sent or unattributed
    changelog   append-only: every field change, who/what changed it, when
    runs        one row per import/pipeline run
    reels       Instagram reel/post links pasted as conversation context,
                optionally tagged with the property they are about
    tasks       sourcing / assignment queue (Sameer's board)
    answers     cached Q&A about a specific property, per lead
    meta        key/value odds and ends

Nothing is ever deleted silently. A field change writes a changelog row; a
delete writes a changelog row too.

    python scripts/lead_db.py --stats
"""

import json
import os
import re
import sqlite3
import sys
import threading
from datetime import datetime, date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DB_DIR = os.path.join(ROOT, "db")
DB_PATH = os.environ.get("LEAD_DB") or os.path.join(DB_DIR, "lead-desk.db")

_lock = threading.RLock()

# Same column list the workbook used, so a migration is a straight copy and
# nothing downstream has to learn new names.
LEAD_COLUMNS = [
    "lead_id", "lead_name", "instagram_link", "mobile_number", "whatsapp_available",
    "lead_type", "lead_score", "deal_type", "property_type", "locality", "city",
    "building_name", "budget", "units_required",
    "possession_timeline", "requirement_complete", "summary", "next_action",
    "action_channel", "suggested_reply", "meeting_schedule", "call_requested",
    "meeting_datetime", "dm_can_be_closed",
    "close_reason", "sourcing_action_for_sameer", "sourcing_status",
    "sourcing_raised_on", "conversation_start_date", "conversation_end_date",
    "days_since_last_message", "message_count", "reel_links", "needs_review",
    "notes", "manual_override", "first_seen_run", "last_updated_run", "source_files",
    "pushed_to_crm", "pushed_to_crm_at", "crm_lead_id",
]

# Fields a human may edit straight from the pipeline row.
EDITABLE_FIELDS = {
    "lead_name", "mobile_number", "whatsapp_available", "lead_type", "lead_score",
    "deal_type", "property_type", "locality", "city", "building_name", "budget",
    "units_required", "possession_timeline", "summary", "next_action",
    "action_channel", "suggested_reply", "meeting_schedule", "meeting_datetime",
    "call_requested", "sourcing_action_for_sameer", "sourcing_status",
    "needs_review", "notes", "manual_override", "stage", "owner",
}

SCHEMA = """
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS leads (
    lead_id TEXT PRIMARY KEY,
    %s,
    stage TEXT DEFAULT 'new',
    owner TEXT DEFAULT '',
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    lead_name TEXT DEFAULT '',
    date TEXT DEFAULT '',
    time TEXT DEFAULT '',
    date_source TEXT DEFAULT '',
    direction TEXT DEFAULT 'unknown',
    text TEXT DEFAULT '',
    source_file TEXT DEFAULT '',
    created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id, date, time);

CREATE TABLE IF NOT EXISTS changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT DEFAULT '',
    run_timestamp TEXT DEFAULT '',
    lead_id TEXT DEFAULT '',
    lead_name TEXT DEFAULT '',
    change_type TEXT DEFAULT '',
    field TEXT DEFAULT '',
    old_value TEXT DEFAULT '',
    new_value TEXT DEFAULT '',
    source_file TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_changelog_lead ON changelog(lead_id, id DESC);

CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    run_timestamp TEXT DEFAULT '',
    source_file TEXT DEFAULT '',
    anchor_date TEXT DEFAULT '',
    leads_in_file INTEGER DEFAULT 0,
    new_leads INTEGER DEFAULT 0,
    updated_leads INTEGER DEFAULT 0,
    unchanged_leads INTEGER DEFAULT 0,
    messages_added INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    url TEXT NOT NULL,
    shortcode TEXT DEFAULT '',
    kind TEXT DEFAULT 'reel',
    property_id TEXT DEFAULT '',
    note TEXT DEFAULT '',
    added_by TEXT DEFAULT 'you',
    added_at TEXT,
    UNIQUE(lead_id, url)
);
CREATE INDEX IF NOT EXISTS idx_reels_lead ON reels(lead_id);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT DEFAULT '',
    lead_name TEXT DEFAULT '',
    assignee TEXT DEFAULT 'Sameer',
    title TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    property_id TEXT DEFAULT '',
    deal_type TEXT DEFAULT '',
    property_type TEXT DEFAULT '',
    locality TEXT DEFAULT '',
    city TEXT DEFAULT '',
    budget TEXT DEFAULT '',
    units TEXT DEFAULT '',
    possession TEXT DEFAULT '',
    reel_urls TEXT DEFAULT '',
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    source TEXT DEFAULT 'app',
    created_at TEXT,
    updated_at TEXT,
    closed_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT DEFAULT '',
    property_id TEXT DEFAULT '',
    question TEXT DEFAULT '',
    answer TEXT DEFAULT '',
    dm_reply TEXT DEFAULT '',
    facts_json TEXT DEFAULT '[]',
    reel_urls TEXT DEFAULT '',
    source TEXT DEFAULT '',
    created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_answers_lead ON answers(lead_id, id DESC);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);
""" % (",\n    ".join('"%s" TEXT DEFAULT \'\'' % c
                      for c in LEAD_COLUMNS if c != "lead_id"))


# ------------------------------------------------------------------ basics --

def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def today_iso():
    return date.today().isoformat()


def as_text(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        if value.hour or value.minute or value.second:
            return value.strftime("%Y-%m-%dT%H:%M")
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def connect():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=20, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init(conn=None):
    """Create everything that is missing. Safe to call on every start."""
    own = conn is None
    conn = conn or connect()
    with _lock:
        conn.executescript(SCHEMA)
        # Columns added after the first release land here rather than in a
        # migration file, because this database only ever lives on one laptop.
        have = {r["name"] for r in conn.execute("PRAGMA table_info(leads)")}
        for column in LEAD_COLUMNS + ["stage", "owner", "created_at", "updated_at"]:
            if column not in have:
                conn.execute('ALTER TABLE leads ADD COLUMN "%s" TEXT DEFAULT \'\''
                             % column)
        conn.commit()
    if own:
        return conn
    return conn


def rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def one(conn, sql, params=()):
    row = conn.execute(sql, params).fetchone()
    return dict(row) if row else None


# ------------------------------------------------------------- changelog ---

def log_change(conn, lead_id, field, old, new, change_type="app",
               run_id="", lead_name="", source_file="app"):
    conn.execute(
        "INSERT INTO changelog (run_id, run_timestamp, lead_id, lead_name,"
        " change_type, field, old_value, new_value, source_file)"
        " VALUES (?,?,?,?,?,?,?,?,?)",
        (run_id or datetime.now().strftime("app-%Y%m%d-%H%M%S"), now_iso(),
         lead_id, lead_name, change_type, field, as_text(old), as_text(new),
         source_file))


# ----------------------------------------------------------------- leads ---

def get_lead(conn, lead_id):
    return one(conn, "SELECT * FROM leads WHERE lower(lead_id) = lower(?)",
               (lead_id,))


def all_leads(conn):
    return rows(conn, "SELECT * FROM leads ORDER BY"
                      " CASE lower(lead_score) WHEN 'very_hot' THEN 0"
                      " WHEN 'hot' THEN 1 ELSE 2 END,"
                      " conversation_end_date DESC, lead_id")


def upsert_lead(conn, values, run_id="", change_type="import",
                source_file="", protect_existing=True):
    """Insert or merge one lead row.

    A blank incoming value never clears something already known, which is what
    makes re-importing a partial export safe.
    """
    lead_id = as_text(values.get("lead_id")).lower()
    if not lead_id:
        raise ValueError("lead_id is required")
    existing = get_lead(conn, lead_id)
    changes = []
    if existing is None:
        payload = {c: "" for c in LEAD_COLUMNS}
        payload.update({k: as_text(v) for k, v in values.items()
                        if k in LEAD_COLUMNS})
        payload["lead_id"] = lead_id
        payload["created_at"] = now_iso()
        payload["updated_at"] = now_iso()
        columns = list(payload.keys())
        conn.execute("INSERT INTO leads (%s) VALUES (%s)"
                     % (",".join('"%s"' % c for c in columns),
                        ",".join("?" * len(columns))),
                     [payload[c] for c in columns])
        log_change(conn, lead_id, "*", "", "new lead", change_type, run_id,
                   payload.get("lead_name", ""), source_file)
        return "new", []

    sets, params = [], []
    for key, value in values.items():
        if key not in LEAD_COLUMNS or key == "lead_id":
            continue
        new = as_text(value)
        old = as_text(existing.get(key))
        if protect_existing and not new:
            continue
        if new == old:
            continue
        sets.append('"%s" = ?' % key)
        params.append(new)
        changes.append((key, old, new))
    if not sets:
        return "unchanged", []
    sets.append('"updated_at" = ?')
    params.append(now_iso())
    params.append(lead_id)
    conn.execute("UPDATE leads SET %s WHERE lower(lead_id) = lower(?)"
                 % ",".join(sets), params)
    for field, old, new in changes:
        log_change(conn, lead_id, field, old, new, change_type, run_id,
                   as_text(existing.get("lead_name")), source_file)
    return "updated", changes


def update_fields(conn, lead_id, values, change_type="manual edit"):
    """Human edit from the app. A blank here DOES clear, because it was typed."""
    lead = get_lead(conn, lead_id)
    if lead is None:
        raise ValueError("no lead %r" % lead_id)
    sets, params, changes = [], [], []
    for key, value in values.items():
        if key not in EDITABLE_FIELDS:
            continue
        new, old = as_text(value), as_text(lead.get(key))
        if new == old:
            continue
        sets.append('"%s" = ?' % key)
        params.append(new)
        changes.append((key, old, new))
    if not sets:
        return []
    sets.append('"updated_at" = ?')
    params.append(now_iso())
    params.append(lead_id)
    conn.execute("UPDATE leads SET %s WHERE lower(lead_id) = lower(?)"
                 % ",".join(sets), params)
    for field, old, new in changes:
        log_change(conn, lead_id, field, old, new, change_type,
                   lead_name=as_text(lead.get("lead_name")))
    conn.commit()
    return changes


# -------------------------------------------------------------- messages ---

def messages_for(conn, lead_id):
    return rows(conn, "SELECT * FROM messages WHERE lower(lead_id) = lower(?)"
                      " ORDER BY COALESCE(NULLIF(date,''),'9999'), time, id",
                (lead_id,))


def add_message(conn, lead_id, direction, text, lead_name="", when=None,
                date_source="app", source_file="live-chat"):
    when = when or datetime.now()
    conn.execute(
        "INSERT INTO messages (lead_id, lead_name, date, time, date_source,"
        " direction, text, source_file, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (lead_id, lead_name, when.date().isoformat(), when.strftime("%H:%M"),
         date_source, direction, as_text(text), source_file, now_iso()))


# ----------------------------------------------------------------- reels ---

REEL_RE = re.compile(
    r"https?://(?:www\.)?instagram\.com/(reel|reels|p|tv|share)/([A-Za-z0-9_\-]+)",
    re.IGNORECASE)


def parse_reel_links(blob):
    """Pull every Instagram link out of a pasted blob.

    People paste one per line, several separated by spaces, or a wall of text
    copied out of a DM. All three have to work, so this scans rather than splits.
    """
    found, seen = [], set()
    text = as_text(blob)
    for match in REEL_RE.finditer(text):
        kind = match.group(1).lower()
        code = match.group(2)
        kind = {"reels": "reel", "p": "post", "tv": "igtv",
                "share": "share"}.get(kind, kind)
        url = "https://www.instagram.com/%s/%s/" % (
            "reel" if kind in ("reel", "share") else
            {"post": "p", "igtv": "tv"}.get(kind, "reel"), code)
        if url.lower() in seen:
            continue
        seen.add(url.lower())
        found.append({"url": url, "shortcode": code, "kind": kind})
    if not found:
        # Anything else that looks like a bare URL still gets kept: a lead may
        # paste a shortened or a non-instagram listing link.
        for raw in re.findall(r"https?://\S+", text):
            url = raw.rstrip(".,;)")
            if url.lower() in seen:
                continue
            seen.add(url.lower())
            found.append({"url": url, "shortcode": "", "kind": "link"})
    return found


def reels_for(conn, lead_id):
    return rows(conn, "SELECT * FROM reels WHERE lower(lead_id) = lower(?)"
                      " ORDER BY id", (lead_id,))


def add_reels(conn, lead_id, blob, property_id="", note=""):
    lead = get_lead(conn, lead_id)
    parsed = parse_reel_links(blob)
    added = 0
    for item in parsed:
        try:
            conn.execute(
                "INSERT INTO reels (lead_id, url, shortcode, kind, property_id,"
                " note, added_at) VALUES (?,?,?,?,?,?,?)",
                (lead_id, item["url"], item["shortcode"], item["kind"],
                 as_text(property_id), as_text(note), now_iso()))
            added += 1
            log_change(conn, lead_id, "reel", "", item["url"], "reel added",
                       lead_name=as_text((lead or {}).get("lead_name")))
        except sqlite3.IntegrityError:
            if property_id or note:
                conn.execute(
                    "UPDATE reels SET property_id = COALESCE(NULLIF(?,''),"
                    " property_id), note = COALESCE(NULLIF(?,''), note)"
                    " WHERE lead_id = ? AND url = ?",
                    (as_text(property_id), as_text(note), lead_id, item["url"]))
    # Keep the legacy reel_links column in step so anything still reading the
    # old shape (the CRM push, the Excel export) does not go blind.
    urls = [r["url"] for r in reels_for(conn, lead_id)]
    conn.execute("UPDATE leads SET reel_links = ?, updated_at = ?"
                 " WHERE lower(lead_id) = lower(?)",
                 ("; ".join(urls), now_iso(), lead_id))
    conn.commit()
    return added, reels_for(conn, lead_id)


def update_reel(conn, reel_id, property_id=None, note=None, delete=False):
    reel = one(conn, "SELECT * FROM reels WHERE id = ?", (reel_id,))
    if reel is None:
        raise ValueError("no reel %s" % reel_id)
    if delete:
        conn.execute("DELETE FROM reels WHERE id = ?", (reel_id,))
        log_change(conn, reel["lead_id"], "reel", reel["url"], "", "reel removed")
    else:
        if property_id is not None:
            conn.execute("UPDATE reels SET property_id = ? WHERE id = ?",
                         (as_text(property_id), reel_id))
            log_change(conn, reel["lead_id"], "reel.property_id",
                       reel["property_id"], property_id, "reel tagged")
        if note is not None:
            conn.execute("UPDATE reels SET note = ? WHERE id = ?",
                         (as_text(note), reel_id))
    urls = [r["url"] for r in reels_for(conn, reel["lead_id"])]
    conn.execute("UPDATE leads SET reel_links = ? WHERE lower(lead_id) = lower(?)",
                 ("; ".join(urls), reel["lead_id"]))
    conn.commit()
    return reels_for(conn, reel["lead_id"])


# ----------------------------------------------------------------- tasks ---

def tasks_for(conn, lead_id=None, status=None):
    sql = "SELECT * FROM tasks WHERE 1=1"
    params = []
    if lead_id:
        sql += " AND lower(lead_id) = lower(?)"
        params.append(lead_id)
    if status:
        sql += " AND lower(status) = lower(?)"
        params.append(status)
    sql += (" ORDER BY CASE lower(status) WHEN 'open' THEN 0 WHEN 'in_progress'"
            " THEN 1 ELSE 2 END, CASE lower(priority) WHEN 'urgent' THEN 0"
            " WHEN 'high' THEN 1 ELSE 2 END, id DESC")
    return rows(conn, sql, params)


def create_task(conn, payload):
    lead_id = as_text(payload.get("lead_id"))
    lead = get_lead(conn, lead_id) if lead_id else None
    now = now_iso()
    fields = {
        "lead_id": lead_id,
        "lead_name": as_text(payload.get("lead_name")) or
                     as_text((lead or {}).get("lead_name")),
        "assignee": as_text(payload.get("assignee")) or "Sameer",
        "title": as_text(payload.get("title")),
        "detail": as_text(payload.get("detail")),
        "property_id": as_text(payload.get("property_id")),
        "deal_type": as_text(payload.get("deal_type")),
        "property_type": as_text(payload.get("property_type")),
        "locality": as_text(payload.get("locality")),
        "city": as_text(payload.get("city")),
        "budget": as_text(payload.get("budget")),
        "units": as_text(payload.get("units")),
        "possession": as_text(payload.get("possession")),
        "reel_urls": as_text(payload.get("reel_urls")),
        "priority": as_text(payload.get("priority")) or "normal",
        "status": as_text(payload.get("status")) or "open",
        "source": as_text(payload.get("source")) or "app",
        "created_at": now, "updated_at": now,
    }
    if not fields["title"]:
        fields["title"] = ("Source %s %s in %s" % (
            fields["property_type"] or "property",
            fields["deal_type"] or "",
            fields["locality"] or "the requested area")).replace("  ", " ").strip()
    columns = list(fields.keys())
    cursor = conn.execute(
        "INSERT INTO tasks (%s) VALUES (%s)"
        % (",".join(columns), ",".join("?" * len(columns))),
        [fields[c] for c in columns])
    task_id = cursor.lastrowid

    # Mirror onto the lead row so the old sourcing columns stay meaningful.
    if lead_id and lead is not None:
        summary = fields["title"] + ((" -- " + fields["detail"])
                                     if fields["detail"] else "")
        conn.execute(
            "UPDATE leads SET sourcing_action_for_sameer = ?,"
            " sourcing_status = 'open', sourcing_raised_on ="
            " COALESCE(NULLIF(sourcing_raised_on,''), ?), updated_at = ?"
            " WHERE lower(lead_id) = lower(?)",
            (summary, today_iso(), now, lead_id))
        log_change(conn, lead_id, "sourcing_action_for_sameer",
                   as_text(lead.get("sourcing_action_for_sameer")), summary,
                   "assigned to %s" % fields["assignee"],
                   lead_name=fields["lead_name"])
    conn.commit()
    return one(conn, "SELECT * FROM tasks WHERE id = ?", (task_id,))


def set_task_status(conn, task_id, status):
    status = as_text(status).lower()
    if status not in ("open", "in_progress", "done", "dropped"):
        raise ValueError("status must be open, in_progress, done or dropped")
    task = one(conn, "SELECT * FROM tasks WHERE id = ?", (task_id,))
    if task is None:
        raise ValueError("no task %s" % task_id)
    conn.execute("UPDATE tasks SET status = ?, updated_at = ?, closed_at = ?"
                 " WHERE id = ?",
                 (status, now_iso(),
                  now_iso() if status in ("done", "dropped") else "", task_id))
    if task["lead_id"]:
        open_left = one(conn, "SELECT COUNT(*) n FROM tasks WHERE lower(lead_id)"
                              " = lower(?) AND status IN ('open','in_progress')",
                        (task["lead_id"],))["n"]
        conn.execute("UPDATE leads SET sourcing_status = ? WHERE lower(lead_id)"
                     " = lower(?)",
                     ("open" if open_left else status, task["lead_id"]))
        log_change(conn, task["lead_id"], "sourcing_status", task["status"],
                   status, "task status", lead_name=task["lead_name"])
    conn.commit()
    return one(conn, "SELECT * FROM tasks WHERE id = ?", (task_id,))


# --------------------------------------------------------------- answers ---

def answers_for(conn, lead_id, property_id=None):
    sql = "SELECT * FROM answers WHERE lower(lead_id) = lower(?)"
    params = [lead_id]
    if property_id:
        sql += " AND property_id = ?"
        params.append(property_id)
    return rows(conn, sql + " ORDER BY id DESC LIMIT 40", params)


def save_answer(conn, payload):
    conn.execute(
        "INSERT INTO answers (lead_id, property_id, question, answer, dm_reply,"
        " facts_json, reel_urls, source, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (as_text(payload.get("lead_id")), as_text(payload.get("property_id")),
         as_text(payload.get("question")), as_text(payload.get("answer")),
         as_text(payload.get("dm_reply")),
         json.dumps(payload.get("facts") or [], ensure_ascii=False),
         as_text(payload.get("reel_urls")), as_text(payload.get("source")),
         now_iso()))
    conn.commit()


# ------------------------------------------------------------- analytics ---

def daily_activity(conn, limit=60):
    return rows(conn,
                "SELECT date,"
                " COUNT(*) AS messages,"
                " SUM(CASE WHEN direction='lead' THEN 1 ELSE 0 END) AS lead_messages,"
                " SUM(CASE WHEN direction='business' THEN 1 ELSE 0 END) AS our_messages,"
                " SUM(CASE WHEN direction NOT IN ('lead','business') THEN 1 ELSE 0 END)"
                "   AS unattributed,"
                " COUNT(DISTINCT lead_id) AS leads"
                " FROM messages WHERE date <> '' GROUP BY date"
                " ORDER BY date DESC LIMIT ?", (limit,))


def weekly_activity(conn, limit=20):
    return rows(conn,
                "SELECT strftime('%Y-W%W', date) AS week,"
                " MIN(date) AS week_start, MAX(date) AS week_end,"
                " COUNT(*) AS messages, COUNT(DISTINCT lead_id) AS leads"
                " FROM messages WHERE date <> '' GROUP BY week"
                " ORDER BY week DESC LIMIT ?", (limit,))


def stats(conn):
    def count(table):
        return conn.execute("SELECT COUNT(*) FROM %s" % table).fetchone()[0]
    return {t: count(t) for t in
            ("leads", "messages", "changelog", "runs", "reels", "tasks", "answers")}


# ------------------------------------------------------------- computed ----

def compute_requirement_complete(lead):
    needed = ("deal_type", "property_type", "locality", "budget")
    return "yes" if all(as_text(lead.get(f)) for f in needed) else "no"


def compute_closability(lead):
    missing = []
    if not as_text(lead.get("mobile_number")):
        missing.append("mobile number")
    if compute_requirement_complete(lead) != "yes":
        gaps = [f.replace("_", " ") for f in
                ("deal_type", "property_type", "locality", "budget")
                if not as_text(lead.get(f))]
        missing.append("requirement (" + ", ".join(gaps) + ")")
    if not as_text(lead.get("meeting_schedule")):
        missing.append("a scheduled meeting")
    if missing:
        return "no", "still missing: " + ", ".join(missing)
    return "yes", "number on record, requirement complete, meeting scheduled"


def refresh_computed(conn, lead_id):
    lead = get_lead(conn, lead_id)
    if lead is None:
        return
    complete = compute_requirement_complete(lead)
    closable, reason = compute_closability(lead)
    count = one(conn, "SELECT COUNT(*) n FROM messages WHERE lower(lead_id)"
                      " = lower(?)", (lead_id,))["n"]
    last = one(conn, "SELECT MAX(date) d FROM messages WHERE lower(lead_id)"
                     " = lower(?) AND date <> ''", (lead_id,))["d"] or ""
    quiet = ""
    if last:
        try:
            quiet = str((date.today() - date.fromisoformat(last)).days)
        except ValueError:
            quiet = ""
    conn.execute(
        "UPDATE leads SET requirement_complete = ?, dm_can_be_closed = ?,"
        " close_reason = ?, message_count = ?, conversation_end_date ="
        " COALESCE(NULLIF(?,''), conversation_end_date),"
        " days_since_last_message = ?, updated_at = ?"
        " WHERE lower(lead_id) = lower(?)",
        (complete, closable, reason, count, last, quiet, now_iso(), lead_id))
    conn.commit()


def main():
    conn = init()
    if "--stats" in sys.argv:
        print("database: %s" % DB_PATH)
        for table, count in stats(conn).items():
            print("  %-10s %d" % (table, count))
    else:
        print("initialised %s" % DB_PATH)
    return 0


if __name__ == "__main__":
    sys.exit(main())
