#!/usr/bin/env python3
"""
upsert_leads_excel.py -- Stage 3 of the HP Instagram lead automation.

Merges one parsed export plus its analyst output into the master workbook,
which is the single source of truth. For every lead it decides insert vs
update by lead_id (the Instagram handle), never destroys an existing value,
and records every field-level change in an append-only Changelog sheet.

Usage:
    python scripts/upsert_leads_excel.py --parsed parsed/<x>.parsed.json \
                                         --analysis analysis/<x>.analysis.json \
                                         [--workbook master/hp-insta-leads.xlsx] \
                                         [--dry-run]

Exit codes: 0 ok, 1 bad input, 2 validation failure, 3 workbook locked.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, date

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_WORKBOOK = os.path.join(ROOT, "master", "hp-insta-leads.xlsx")
CONFIG_PATH = os.path.join(ROOT, "config", "business-phrases.json")


def load_business_numbers():
    """Our own team numbers. They are never a lead's mobile, even if an earlier run stored one."""
    try:
        with open(CONFIG_PATH, encoding="utf-8") as fh:
            numbers = json.load(fh).get("business_phone_numbers", [])
    except (OSError, ValueError):
        return set()
    return {"".join(ch for ch in str(n) if ch.isdigit())[-10:] for n in numbers}


BUSINESS_NUMBERS = load_business_numbers()

SHEET_LEADS = "Leads"
SHEET_DAILY = "Daily Activity"
SHEET_WEEKLY = "Weekly Activity"
SHEET_CHANGELOG = "Changelog"
SHEET_MESSAGES = "Messages"
SHEET_RUNS = "Run Log"
SHEET_OVERVIEW = "Overview"

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

# Written only by scripts/push_leads_to_crm.py. The upsert carries them through
# untouched so a lead is never sent to the CRM twice.
CRM_PUSH_FIELDS = ["pushed_to_crm", "pushed_to_crm_at", "crm_lead_id"]

CHANGELOG_COLUMNS = [
    "run_id", "run_timestamp", "lead_id", "lead_name", "change_type",
    "field", "old_value", "new_value", "source_file",
]

MESSAGE_COLUMNS = [
    "lead_id", "lead_name", "date", "time", "date_source",
    "direction", "text", "source_file",
]

RUN_COLUMNS = [
    "run_id", "run_timestamp", "source_file", "anchor_date", "leads_in_file",
    "new_leads", "updated_leads", "unchanged_leads", "messages_added",
]

# Analyst-owned fields. A blank incoming value never wipes an existing one.
ANALYST_FIELDS = [
    "lead_type", "lead_score", "deal_type", "property_type", "locality", "city",
    "building_name", "budget", "units_required",
    "possession_timeline", "summary", "next_action", "action_channel",
    "suggested_reply", "meeting_schedule", "call_requested", "meeting_datetime",
    "needs_review", "notes",
]

# Owned by the live-chat runner and by whoever works the queue in Excel.
# Never written by an export upsert, only carried forward.
SOURCING_FIELDS = [
    "sourcing_action_for_sameer", "sourcing_status", "sourcing_raised_on",
]

# Protected when the row carries manual_override = yes.
LOCKED_FIELDS = [
    "lead_type", "lead_score", "summary", "next_action", "suggested_reply",
    "meeting_schedule", "meeting_datetime", "call_requested", "notes", "budget",
    "locality", "city", "building_name", "units_required",
]

VALID_LEAD_TYPE = {"buyer", "seller", "tenant", "landlord", "not_a_lead", "unknown"}
VALID_SCORE = {"very_hot", "hot", "cold"}
VALID_CHANNEL = {"dm", "call", "whatsapp", "meeting", "none"}
VALID_WHATSAPP = {"yes", "no", "not_mentioned"}
VALID_YES_NO = {"yes", "no"}
# ISO 8601 local time without seconds or zone, e.g. 2026-09-06T16:00.
MEETING_DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$")

HEADER_FILL = PatternFill("solid", fgColor="2563EB")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
SCORE_FILL = {
    "very_hot": PatternFill("solid", fgColor="FECACA"),
    "hot": PatternFill("solid", fgColor="FED7AA"),
    "cold": PatternFill("solid", fgColor="E5E7EB"),
}
WIDE_COLUMNS = {
    "summary": 70, "suggested_reply": 60, "next_action": 45, "notes": 32,
    "sourcing_action_for_sameer": 52, "building_name": 26,
    "close_reason": 34, "instagram_link": 38, "reel_links": 38, "lead_id": 24,
    "lead_name": 22, "source_files": 26, "text": 70,
}


def fail(message, code=2):
    print("ERROR: %s" % message, file=sys.stderr)
    sys.exit(code)


def as_text(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        # Cell values Excel has coerced to a datetime; keep minutes for
        # meeting_datetime and pushed_to_crm_at, dates only for everything else.
        if value.hour or value.minute or value.second:
            return value.strftime("%Y-%m-%dT%H:%M")
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    return str(value).strip()


def changelog_entry(run_id, run_timestamp, lead_id, lead_name, change_type,
                    field, old_value, new_value, source_file):
    """The one shape every Changelog row has. Shared with push_leads_to_crm.py."""
    return {
        "run_id": run_id, "run_timestamp": run_timestamp,
        "lead_id": lead_id, "lead_name": lead_name,
        "change_type": change_type, "field": field,
        "old_value": as_text(old_value), "new_value": as_text(new_value),
        "source_file": source_file,
    }


def validate_analysis(analysis, parsed):
    """Fail loudly rather than write half-understood rows into the source of truth."""
    parsed_ids = {lead["lead_id"] for lead in parsed["leads"]}
    seen, problems = set(), []
    for entry in analysis.get("leads", []):
        lead_id = as_text(entry.get("lead_id")).lower()
        if not lead_id:
            problems.append("an analysis entry has no lead_id")
            continue
        if lead_id in seen:
            problems.append("%s appears twice in the analysis" % lead_id)
        seen.add(lead_id)
        if lead_id not in parsed_ids:
            problems.append("%s is not in the parsed export" % lead_id)
        checks = (
            ("lead_type", VALID_LEAD_TYPE), ("lead_score", VALID_SCORE),
            ("action_channel", VALID_CHANNEL), ("whatsapp_available", VALID_WHATSAPP),
            ("call_requested", VALID_YES_NO), ("needs_review", VALID_YES_NO),
        )
        for field, allowed in checks:
            value = as_text(entry.get(field)).lower()
            if value and value not in allowed:
                problems.append("%s has %s=%r, expected one of %s"
                                % (lead_id, field, value, sorted(allowed)))
        meeting_dt = as_text(entry.get("meeting_datetime"))
        if meeting_dt and not MEETING_DATETIME_RE.match(meeting_dt):
            problems.append("%s has meeting_datetime=%r, expected YYYY-MM-DDTHH:MM"
                            % (lead_id, meeting_dt))
        if not as_text(entry.get("summary")):
            problems.append("%s has an empty summary" % lead_id)
    missing = parsed_ids - seen
    if missing:
        problems.append("no analysis for: %s" % ", ".join(sorted(missing)))
    if problems:
        for problem in problems:
            print("  - %s" % problem, file=sys.stderr)
        fail("analysis failed validation (%d problems)" % len(problems))


def merge_list(old_value, new_items, separator="; "):
    existing = [part.strip() for part in as_text(old_value).split(separator.strip())
                if part.strip()]
    for item in new_items:
        item = as_text(item)
        if item and item not in existing:
            existing.append(item)
    return separator.join(existing)


def compute_requirement_complete(row):
    needed = ("deal_type", "property_type", "locality", "budget")
    return "yes" if all(as_text(row.get(field)) for field in needed) else "no"


def compute_closability(row):
    """The DM can be closed only with a number, a full requirement and a meeting."""
    missing = []
    if not as_text(row.get("mobile_number")):
        missing.append("mobile number")
    if row.get("requirement_complete") != "yes":
        needed = ("deal_type", "property_type", "locality", "budget")
        gaps = [f for f in needed if not as_text(row.get(f))]
        missing.append("requirement (" + ", ".join(gaps) + ")")
    meeting = as_text(row.get("meeting_schedule")) or as_text(row.get("meeting_datetime"))
    if not meeting and as_text(row.get("action_channel")) != "meeting":
        missing.append("personal meeting not scheduled")
    if missing:
        return "no", "waiting on: " + "; ".join(missing)
    return "yes", "mobile + full requirement + meeting scheduled"


def days_since(iso_date, today):
    if not iso_date:
        return ""
    try:
        return (today - date.fromisoformat(iso_date)).days
    except ValueError:
        return ""


def build_incoming(parsed, analysis, run_id, today):
    """One dict per lead, combining deterministic parse data with analyst judgement."""
    by_id = {as_text(e.get("lead_id")).lower(): e for e in analysis["leads"]}
    source = os.path.basename(parsed["source_file"])
    rows = []
    for lead in parsed["leads"]:
        entry = by_id.get(lead["lead_id"], {})
        phones = list(lead["phones_detected"])
        for extra in str(entry.get("mobile_number", "")).replace(",", ";").split(";"):
            extra = "".join(ch for ch in extra if ch.isdigit())
            if len(extra) == 10 and extra not in phones:
                phones.append(extra)
        phones = [n for n in phones if n not in BUSINESS_NUMBERS]

        whatsapp = as_text(entry.get("whatsapp_available")).lower()
        if not whatsapp:
            whatsapp = "yes" if lead["whatsapp_mentioned_in_chat"] else "not_mentioned"

        row = {
            "lead_id": lead["lead_id"],
            "lead_name": lead["lead_name"],
            "instagram_link": lead["instagram_link"],
            "mobile_number": "; ".join(phones),
            "whatsapp_available": whatsapp,
            "conversation_start_date": lead["conversation_start_date"] or "",
            "conversation_end_date": lead["conversation_end_date"] or "",
            "message_count": lead["message_count"],
            "reel_links": "; ".join(lead["reel_links"]),
            "manual_override": "",
            "first_seen_run": run_id,
            "last_updated_run": run_id,
            "source_files": source,
        }
        for field in CRM_PUSH_FIELDS:
            row[field] = ""
        for field in ANALYST_FIELDS:
            row[field] = as_text(entry.get(field))
        row["lead_type"] = row["lead_type"].lower() or "unknown"
        row["lead_score"] = row["lead_score"].lower() or "cold"
        row["action_channel"] = row["action_channel"].lower() or "dm"
        row["needs_review"] = row["needs_review"].lower() or "no"
        # Left blank rather than defaulted to "no" so an analysis file that omits
        # the field can never flip an earlier "yes" back on an existing row.
        row["call_requested"] = row["call_requested"].lower()
        row["requirement_complete"] = compute_requirement_complete(row)
        row["dm_can_be_closed"], row["close_reason"] = compute_closability(row)
        row["days_since_last_message"] = days_since(row["conversation_end_date"], today)
        rows.append((row, lead))
    return rows


def read_sheet(workbook, name, columns):
    if name not in workbook.sheetnames:
        return []
    sheet = workbook[name]
    header = [as_text(c.value) for c in sheet[1]] if sheet.max_row else []
    if not header:
        return []
    records = []
    for raw in sheet.iter_rows(min_row=2, values_only=True):
        if all(v in (None, "") for v in raw):
            continue
        record = {header[i]: raw[i] for i in range(min(len(header), len(raw)))}
        records.append({col: record.get(col, "") for col in columns})
    return records


def style_sheet(sheet, columns, freeze="A2", autofilter=True):
    for index, name in enumerate(columns, start=1):
        cell = sheet.cell(row=1, column=index)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", horizontal="left")
        width = WIDE_COLUMNS.get(name, max(12, min(28, len(name) + 6)))
        sheet.column_dimensions[get_column_letter(index)].width = width
    sheet.freeze_panes = freeze
    if autofilter and sheet.max_row >= 1:
        sheet.auto_filter.ref = "A1:%s%d" % (
            get_column_letter(len(columns)), max(sheet.max_row, 1))
    sheet.row_dimensions[1].height = 24


def write_table(workbook, name, columns, records, wrap_columns=()):
    if name in workbook.sheetnames:
        del workbook[name]
    sheet = workbook.create_sheet(name)
    sheet.append(columns)
    for record in records:
        sheet.append([record.get(col, "") for col in columns])
    style_sheet(sheet, columns)
    wrap_indexes = [columns.index(c) + 1 for c in wrap_columns if c in columns]
    score_index = columns.index("lead_score") + 1 if "lead_score" in columns else None
    for row_index in range(2, sheet.max_row + 1):
        for col_index in wrap_indexes:
            sheet.cell(row=row_index, column=col_index).alignment = Alignment(
                wrap_text=True, vertical="top")
        if score_index:
            cell = sheet.cell(row=row_index, column=score_index)
            fill = SCORE_FILL.get(as_text(cell.value))
            if fill:
                cell.fill = fill
    return sheet


def build_activity(messages, leads):
    """Datewise and weekwise rollups, recomputed from the full message history."""
    first_message_date = {}
    for record in messages:
        day = as_text(record.get("date"))
        if not day:
            continue
        lead_id = as_text(record.get("lead_id"))
        if lead_id not in first_message_date or day < first_message_date[lead_id]:
            first_message_date[lead_id] = day

    daily = {}
    for record in messages:
        day = as_text(record.get("date"))
        if not day:
            continue
        bucket = daily.setdefault(day, {
            "date": day, "conversations_active": set(), "messages": 0,
            "from_lead": 0, "from_us": 0, "unattributed": 0,
            "new_conversations": 0,
        })
        bucket["conversations_active"].add(as_text(record.get("lead_id")))
        bucket["messages"] += 1
        direction = as_text(record.get("direction"))
        if direction == "lead":
            bucket["from_lead"] += 1
        elif direction == "business":
            bucket["from_us"] += 1
        else:
            bucket["unattributed"] += 1

    for lead_id, day in first_message_date.items():
        if day in daily:
            daily[day]["new_conversations"] += 1

    daily_rows = []
    for day in sorted(daily):
        bucket = daily[day]
        bucket["conversations_active"] = len(bucket["conversations_active"])
        daily_rows.append(bucket)

    weekly = {}
    for bucket in daily_rows:
        day = date.fromisoformat(bucket["date"])
        year, week, _ = day.isocalendar()
        key = "%d-W%02d" % (year, week)
        start = day.fromordinal(day.toordinal() - day.weekday())
        entry = weekly.setdefault(key, {
            "iso_week": key,
            "week_start": start.isoformat(),
            "week_end": date.fromordinal(start.toordinal() + 6).isoformat(),
            "days_with_activity": 0, "conversations_active": 0, "messages": 0,
            "from_lead": 0, "from_us": 0, "unattributed": 0,
            "new_conversations": 0,
        })
        entry["days_with_activity"] += 1
        entry["conversations_active"] += bucket["conversations_active"]
        entry["messages"] += bucket["messages"]
        entry["from_lead"] += bucket["from_lead"]
        entry["from_us"] += bucket["from_us"]
        entry["unattributed"] += bucket["unattributed"]
        entry["new_conversations"] += bucket["new_conversations"]

    weekly_rows = [weekly[k] for k in sorted(weekly)]
    return daily_rows, weekly_rows


def build_overview(leads, daily_rows, run_id, stats, workbook_path):
    def count(field, value):
        return sum(1 for lead in leads if as_text(lead.get(field)).lower() == value)

    dates = [as_text(l.get("conversation_end_date")) for l in leads
             if as_text(l.get("conversation_end_date"))]
    starts = [as_text(l.get("conversation_start_date")) for l in leads
              if as_text(l.get("conversation_start_date"))]

    rows = [
        ("RUN", "Last run id", run_id),
        ("RUN", "Workbook", os.path.basename(workbook_path)),
        ("RUN", "Leads in this run", stats["in_file"]),
        ("RUN", "New leads added", stats["new"]),
        ("RUN", "Existing leads updated", stats["updated"]),
        ("RUN", "Existing leads unchanged", stats["unchanged"]),
        ("PIPELINE", "Total leads tracked", len(leads)),
        ("PIPELINE", "Conversation window",
         "%s to %s" % (min(starts) if starts else "n/a", max(dates) if dates else "n/a")),
        ("PIPELINE", "Days with activity", len(daily_rows)),
        ("SCORE", "very_hot", count("lead_score", "very_hot")),
        ("SCORE", "hot", count("lead_score", "hot")),
        ("SCORE", "cold", count("lead_score", "cold")),
    ]
    for value in sorted(VALID_LEAD_TYPE):
        rows.append(("TYPE", value, count("lead_type", value)))
    deal_types = sorted({as_text(l.get("deal_type")).lower() for l in leads})
    for value in deal_types:
        rows.append(("DEAL", value or "(not stated)", count("deal_type", value)))
    for value in sorted(VALID_CHANNEL):
        rows.append(("NEXT ACTION", value, count("action_channel", value)))
    rows += [
        ("READINESS", "Mobile number captured",
         sum(1 for l in leads if as_text(l.get("mobile_number")))),
        ("READINESS", "WhatsApp confirmed", count("whatsapp_available", "yes")),
        ("READINESS", "Requirement complete", count("requirement_complete", "yes")),
        ("READINESS", "Meeting scheduled",
         sum(1 for l in leads if as_text(l.get("meeting_schedule")))),
        ("READINESS", "Meeting date/time fixed",
         sum(1 for l in leads if as_text(l.get("meeting_datetime")))),
        ("READINESS", "Call requested by lead", count("call_requested", "yes")),
        ("READINESS", "DM can be closed", count("dm_can_be_closed", "yes")),
        ("READINESS", "Sourcing tasks open", count("sourcing_status", "open")),
        ("READINESS", "Sourcing tasks done", count("sourcing_status", "done")),
        ("READINESS", "Pushed to CRM", count("pushed_to_crm", "yes")),
        ("READINESS", "Flagged needs_review", count("needs_review", "yes")),
        ("READINESS", "Rows locked by manual_override", count("manual_override", "yes")),
    ]
    return [{"section": s, "metric": m, "value": v} for s, m, v in rows]


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--parsed", required=True)
    parser.add_argument("--analysis", required=True)
    parser.add_argument("--workbook", default=DEFAULT_WORKBOOK)
    parser.add_argument("--dry-run", action="store_true",
                        help="report the upsert plan without writing the workbook")
    args = parser.parse_args()

    for path in (args.parsed, args.analysis):
        if not os.path.isfile(path):
            fail("no such file: %s" % path, 1)

    with open(args.parsed, encoding="utf-8") as fh:
        parsed = json.load(fh)
    with open(args.analysis, encoding="utf-8") as fh:
        analysis = json.load(fh)

    validate_analysis(analysis, parsed)

    now = datetime.now()
    today = now.date()
    run_id = now.strftime("run-%Y%m%d-%H%M%S")
    source = os.path.basename(parsed["source_file"])

    if os.path.isfile(args.workbook):
        workbook = load_workbook(args.workbook)
        existing_leads = read_sheet(workbook, SHEET_LEADS, LEAD_COLUMNS)
        changelog = read_sheet(workbook, SHEET_CHANGELOG, CHANGELOG_COLUMNS)
        messages = read_sheet(workbook, SHEET_MESSAGES, MESSAGE_COLUMNS)
        runs = read_sheet(workbook, SHEET_RUNS, RUN_COLUMNS)
    else:
        workbook = Workbook()
        workbook.remove(workbook.active)
        existing_leads, changelog, messages, runs = [], [], [], []

    by_id = {as_text(row["lead_id"]).lower(): row for row in existing_leads}
    incoming = build_incoming(parsed, analysis, run_id, today)

    stats = {"in_file": len(incoming), "new": 0, "updated": 0, "unchanged": 0}
    new_changes = []

    for row, parsed_lead in incoming:
        lead_id = row["lead_id"]
        current = by_id.get(lead_id)

        if current is None:
            row["call_requested"] = row["call_requested"] or "no"
            by_id[lead_id] = row
            existing_leads.append(row)
            stats["new"] += 1
            new_changes.append(changelog_entry(
                run_id, now.isoformat(timespec="seconds"), lead_id, row["lead_name"],
                "new", "(row created)", "",
                "%s / %s" % (row["lead_score"], row["lead_type"]), source))
            continue

        locked = as_text(current.get("manual_override")).lower() == "yes"
        changes = []

        merged = {
            "mobile_number": "; ".join(
                n for n in merge_list(current.get("mobile_number"),
                                      row["mobile_number"].split("; ")).split("; ")
                if n and n not in BUSINESS_NUMBERS),
            "reel_links": merge_list(current.get("reel_links"),
                                     row["reel_links"].split("; ")),
            "source_files": merge_list(current.get("source_files"), [source]),
        }
        starts = [d for d in (as_text(current.get("conversation_start_date")),
                              row["conversation_start_date"]) if d]
        ends = [d for d in (as_text(current.get("conversation_end_date")),
                            row["conversation_end_date"]) if d]
        merged["conversation_start_date"] = min(starts) if starts else ""
        merged["conversation_end_date"] = max(ends) if ends else ""
        merged["message_count"] = max(int(current.get("message_count") or 0),
                                      row["message_count"])

        for field in ANALYST_FIELDS + ["lead_name", "whatsapp_available"]:
            incoming_value = as_text(row.get(field))
            if not incoming_value:
                continue                      # never blank out what we already know
            if locked and field in LOCKED_FIELDS:
                continue                      # human edit wins
            merged[field] = incoming_value

        for field, value in merged.items():
            old = as_text(current.get(field))
            new = as_text(value)
            if old != new:
                changes.append((field, old, new))
                current[field] = value

        current["requirement_complete"] = compute_requirement_complete(current)
        current["dm_can_be_closed"], current["close_reason"] = compute_closability(current)
        current["days_since_last_message"] = days_since(
            as_text(current.get("conversation_end_date")), today)
        if not as_text(current.get("first_seen_run")):
            current["first_seen_run"] = run_id
        current["instagram_link"] = row["instagram_link"]

        if changes:
            current["last_updated_run"] = run_id
            stats["updated"] += 1
            for field, old, new in changes:
                new_changes.append(changelog_entry(
                    run_id, now.isoformat(timespec="seconds"), lead_id,
                    current.get("lead_name", ""), "update", field, old, new, source))
        else:
            stats["unchanged"] += 1

    # Counted per occurrence, not per text: a lead really can send "Okay" three
    # times in the minute one date separator covers, and all three belong in the
    # sheet. Re-running the same file still adds nothing, because the nth copy
    # matches the nth copy already stored.
    seen_messages = {}
    for m in messages:
        key = (as_text(m.get("lead_id")), as_text(m.get("date")),
               as_text(m.get("time")), as_text(m.get("text")))
        seen_messages[key] = seen_messages.get(key, 0) + 1
    added_messages = 0
    for _, parsed_lead in incoming:
        occurrences = {}
        for message in parsed_lead["messages"]:
            key = (parsed_lead["lead_id"], as_text(message["date"]),
                   as_text(message["time"]), message["text"])
            occurrences[key] = occurrences.get(key, 0) + 1
            if occurrences[key] <= seen_messages.get(key, 0):
                continue
            messages.append({
                "lead_id": parsed_lead["lead_id"],
                "lead_name": parsed_lead["lead_name"],
                "date": as_text(message["date"]),
                "time": as_text(message["time"]),
                "date_source": message["date_source"],
                "direction": message["direction"],
                "text": message["text"],
                "source_file": source,
            })
            added_messages += 1

    changelog.extend(new_changes)
    runs.append({
        "run_id": run_id, "run_timestamp": now.isoformat(timespec="seconds"),
        "source_file": source, "anchor_date": parsed.get("anchor_date", ""),
        "leads_in_file": stats["in_file"], "new_leads": stats["new"],
        "updated_leads": stats["updated"], "unchanged_leads": stats["unchanged"],
        "messages_added": added_messages,
    })

    print("Run %s on %s" % (run_id, source))
    print("  new %d | updated %d | unchanged %d | messages added %d"
          % (stats["new"], stats["updated"], stats["unchanged"], added_messages))
    for change in new_changes[:40]:
        print("  %-24s %-22s %r -> %r" % (change["lead_id"], change["field"],
                                          change["old_value"][:40],
                                          change["new_value"][:40]))
    if len(new_changes) > 40:
        print("  ... %d more changes" % (len(new_changes) - 40))

    if args.dry_run:
        print("Dry run: workbook not written.")
        return 0

    messages.sort(key=lambda m: (as_text(m.get("date")) or "9999",
                                 as_text(m.get("time")) or "", m.get("lead_id", "")))
    # Hottest first, and within a score band the most recently active on top.
    # Two stable passes keep the two directions straight.
    existing_leads.sort(
        key=lambda r: as_text(r.get("conversation_end_date")) or "0000-00-00",
        reverse=True)
    existing_leads.sort(
        key=lambda r: {"very_hot": 0, "hot": 1, "cold": 2}.get(
            as_text(r.get("lead_score")), 3))

    daily_rows, weekly_rows = build_activity(messages, existing_leads)
    overview = build_overview(existing_leads, daily_rows, run_id, stats, args.workbook)

    write_table(workbook, SHEET_OVERVIEW, ["section", "metric", "value"], overview)
    write_table(workbook, SHEET_LEADS, LEAD_COLUMNS, existing_leads,
                wrap_columns=("summary", "suggested_reply", "next_action",
                              "close_reason", "notes",
                              "sourcing_action_for_sameer"))
    write_table(workbook, SHEET_DAILY,
                ["date", "conversations_active", "messages", "new_conversations",
                 "from_lead", "from_us", "unattributed"], daily_rows)
    write_table(workbook, SHEET_WEEKLY,
                ["iso_week", "week_start", "week_end", "days_with_activity",
                 "conversations_active", "messages", "new_conversations",
                 "from_lead", "from_us", "unattributed"], weekly_rows)
    write_table(workbook, SHEET_CHANGELOG, CHANGELOG_COLUMNS, changelog)
    write_table(workbook, SHEET_MESSAGES, MESSAGE_COLUMNS, messages,
                wrap_columns=("text",))
    write_table(workbook, SHEET_RUNS, RUN_COLUMNS, runs)
    workbook._sheets.sort(key=lambda s: [
        SHEET_OVERVIEW, SHEET_LEADS, SHEET_DAILY, SHEET_WEEKLY,
        SHEET_CHANGELOG, SHEET_MESSAGES, SHEET_RUNS].index(s.title))

    os.makedirs(os.path.dirname(args.workbook), exist_ok=True)
    try:
        workbook.save(args.workbook)
    except PermissionError:
        fail("workbook is open in Excel, close it and re-run: %s" % args.workbook, 3)

    print("Saved %s" % args.workbook)
    print("  %d leads | %d messages | %d changelog entries | %d runs"
          % (len(existing_leads), len(messages), len(changelog), len(runs)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
