#!/usr/bin/env python3
"""
push_leads_to_crm.py -- Stage 4 of the HP Instagram lead automation.

Sends the leads that are ready for a phone call from the master workbook to
the CRM's internal adapter intake (POST /api/internal/adapters/leads) with a
`followUp` hint, so the follow-up agent can place the site-visit confirmation
call. The workbook stays the source of truth: a pushed row is marked
`pushed_to_crm = yes` with the CRM lead id and every change lands in the
Changelog sheet, so nothing is ever sent twice.

A row is pushed when all of these hold:
  - mobile_number holds at least one valid 10-digit Indian mobile
  - action_channel is call or meeting, OR dm_can_be_closed is yes,
    OR call_requested is yes
  - lead_type is buyer, tenant, seller or landlord (landlord goes as seller,
    the CRM has no owner lead type on this endpoint; not_a_lead and unknown
    are skipped)
  - pushed_to_crm is not already yes

Usage:
    python scripts/push_leads_to_crm.py [--config config/crm-push.json]
                                        [--workbook master/hp-insta-leads.xlsx]
                                        [--dry-run] [--limit N]

Exit codes: 0 ok, 2 config missing or incomplete, 3 workbook open/locked,
            4 HTTP failure after retry.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime

from openpyxl import load_workbook
from openpyxl.styles import Alignment

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from parse_dm_export import normalise_phone  # noqa: E402
from upsert_leads_excel import (  # noqa: E402
    CHANGELOG_COLUMNS, CRM_PUSH_FIELDS, HEADER_FILL, HEADER_FONT,
    SHEET_CHANGELOG, SHEET_LEADS, as_text, changelog_entry,
)

DEFAULT_WORKBOOK = os.path.join(ROOT, "master", "hp-insta-leads.xlsx")
DEFAULT_CONFIG = os.path.join(ROOT, "config", "crm-push.json")

ENDPOINT_PATH = "/api/internal/adapters/leads"
BATCH_SIZE = 50
TIMEOUT_SECONDS = 20
NOTE_MAX_CHARS = 500
SOURCE_LABEL = "push_leads_to_crm"

REQUIRED_CONFIG = ("crm_base_url", "tenant_id", "adapter_api_key")
DEFAULT_ADAPTER = "insta-excel"

LEAD_TYPE_MAP = {
    "buyer": "buyer",
    "tenant": "tenant",
    "seller": "seller",
    # The adapter endpoint accepts buyer/tenant/seller only. A landlord is the
    # supply side of a rental, which the CRM files under seller; the note on
    # the followUp hint says so, so the agent is not misled on the call.
    "landlord": "seller",
}
READY_CHANNELS = {"call", "meeting"}

# "80L-1Cr", "<50L", "1Cr+", "25L_50L", "50k-60k": a bracket the CRM can
# parse into a rupee floor. Anything wordier is passed as plain budget text.
BUDGET_BRACKET_RE = re.compile(
    r"^<?\s*[\d.]+\s*(l|lakhs?|lacs?|cr|crores?|k)?\s*"
    r"(?:(?:-|to|_)\s*[\d.]+\s*(l|lakhs?|lacs?|cr|crores?|k)?|\+)?$",
    re.IGNORECASE,
)


def fail(message, code):
    print("ERROR: %s" % message, file=sys.stderr)
    sys.exit(code)


# ---------------------------------------------------------------- config ----

def load_config(path):
    if not os.path.isfile(path):
        fail("no config at %s (copy config/crm-push.sample.json and fill it in)"
             % path, 2)
    with open(path, encoding="utf-8") as fh:
        config = json.load(fh)
    missing = [key for key in REQUIRED_CONFIG if not as_text(config.get(key))]
    if missing:
        fail("config %s is missing: %s" % (path, ", ".join(missing)), 2)
    config["crm_base_url"] = as_text(config["crm_base_url"]).rstrip("/")
    config["adapter_name"] = as_text(config.get("adapter_name")) or DEFAULT_ADAPTER
    config["dry_run"] = bool(config.get("dry_run", False))
    return config


# ------------------------------------------------------------- selection ----

def split_numbers(raw):
    """Every valid 10-digit Indian mobile in a `; ` or `,` separated cell.

    Splits on separators only, not on spaces, so a hand-typed
    "+91 98765 43210" survives; normalise_phone strips the rest.
    """
    numbers = []
    for part in re.split(r"[;,]+", as_text(raw)):
        part = part.strip()
        number = normalise_phone(part) if part else None
        if number and number not in numbers:
            numbers.append(number)
    return numbers


def format_phone(number):
    """+91XXXXXXXXXX, the E.164 form the CRM stores and the dialer needs."""
    return "+91" + number


def mask_phone(phone):
    digits = re.sub(r"\D", "", phone)
    return "+91******" + digits[-4:] if len(digits) >= 4 else "***"


def is_ready(row):
    """The row-level rule: has a phone-worthy signal and a callable number."""
    if as_text(row.get("pushed_to_crm")).lower() == "yes":
        return False, "already pushed"
    lead_type = as_text(row.get("lead_type")).lower()
    if lead_type not in LEAD_TYPE_MAP:
        return False, "lead_type %s" % (lead_type or "(blank)")
    if not split_numbers(row.get("mobile_number")):
        return False, "no valid mobile"
    channel = as_text(row.get("action_channel")).lower()
    closable = as_text(row.get("dm_can_be_closed")).lower() == "yes"
    call_requested = as_text(row.get("call_requested")).lower() == "yes"
    if channel in READY_CHANNELS or closable or call_requested:
        return True, ""
    return False, "no call signal (channel=%s, closable=no, call_requested=no)" % (
        channel or "(blank)")


def select_rows(rows):
    """Rows to push, plus one (lead_id, reason) per row left behind."""
    selected, skipped = [], []
    for row in rows:
        ready, reason = is_ready(row)
        if ready:
            selected.append(row)
        else:
            skipped.append((as_text(row.get("lead_id")), reason))
    return selected, skipped


# --------------------------------------------------------------- payload ----

def join_parts(*parts):
    seen, out = set(), []
    for part in parts:
        text = as_text(part)
        if text and text.lower() not in seen:
            seen.add(text.lower())
            out.append(text)
    return ", ".join(out)


def looks_like_bracket(budget):
    return bool(BUDGET_BRACKET_RE.match(as_text(budget)))


def build_payload(row, adapter_name=DEFAULT_ADAPTER):
    lead_id = as_text(row.get("lead_id")).lower()
    source_type = as_text(row.get("lead_type")).lower()
    lead_type = LEAD_TYPE_MAP[source_type]
    numbers = split_numbers(row.get("mobile_number"))
    locality = as_text(row.get("locality"))
    building = as_text(row.get("building_name"))
    property_type = as_text(row.get("property_type"))

    payload = {
        "name": as_text(row.get("lead_name")) or lead_id,
        "phone": format_phone(numbers[0]),
        "leadType": lead_type,
        "source": "Instagram",
        "sourceAdapter": adapter_name,
        "externalRef": {
            "igUsername": lead_id,
            "conversationRef": as_text(row.get("instagram_link")),
        },
        "dedupeKey": "%s:%s" % (adapter_name, lead_id),
        "createdBy": "Insta Excel Pipeline",
    }

    budget = as_text(row.get("budget"))
    if budget:
        payload["budgetBracket" if looks_like_bracket(budget) else "budget"] = budget

    area = join_parts(locality, building)
    if area:
        payload["preferredArea"] = area

    note = as_text(row.get("summary"))
    if source_type == "landlord":
        note = "Landlord (offering property on rent), filed as seller. " + note
    if len(note) > NOTE_MAX_CHARS:
        note = note[:NOTE_MAX_CHARS - 1].rstrip() + "…"

    follow_up = {"type": "site_visit_confirmation"}
    meeting = as_text(row.get("meeting_schedule")) or as_text(row.get("meeting_datetime"))
    if meeting:
        follow_up["meetingSchedule"] = meeting
    meeting_dt = as_text(row.get("meeting_datetime"))
    if meeting_dt:
        follow_up["meetingDatetime"] = meeting_dt
    hint = join_parts(property_type, locality, building)
    if hint:
        follow_up["propertyHint"] = hint
    if note:
        follow_up["note"] = note
    payload["followUp"] = follow_up
    return payload


# ------------------------------------------------------------------ HTTP ----

def post_batch(config, leads, opener=None):
    """One POST with one retry. Returns the parsed results list or raises."""
    url = config["crm_base_url"] + ENDPOINT_PATH
    body = json.dumps({"leads": leads}).encode("utf-8")
    headers = {
        "content-type": "application/json",
        "x-api-key": config["adapter_api_key"],
        "x-tenant-id": config["tenant_id"],
        "x-adapter": config["adapter_name"],
    }
    open_url = opener or urllib.request.urlopen
    last_error = None
    for attempt in (1, 2):
        request = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with open_url(request, timeout=TIMEOUT_SECONDS) as response:
                raw = response.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            results = data.get("results")
            if not isinstance(results, list):
                raise ValueError("response has no results array: %s" % raw[:200])
            return results
        except urllib.error.HTTPError as err:
            detail = ""
            try:
                detail = err.read().decode("utf-8")[:300]
            except Exception:  # noqa: BLE001 - diagnostics only
                pass
            last_error = "HTTP %s %s" % (err.code, detail)
            # 4xx is a caller problem; retrying the same body will not fix it.
            if 400 <= err.code < 500:
                break
        except (urllib.error.URLError, TimeoutError, ValueError, OSError) as err:
            last_error = str(err)
        print("  attempt %d failed: %s" % (attempt, last_error), file=sys.stderr)
    raise RuntimeError(last_error or "unknown HTTP failure")


def outcome_for(result):
    """(pushed?, crm_lead_id, label) for one per-item result from the CRM."""
    lead_id = as_text(result.get("leadId"))
    if result.get("reason") == "error":
        return False, "", "error (will retry next run)"
    if result.get("skipped"):
        return False, "", "skipped: %s" % (result.get("reason") or "unknown")
    if result.get("created"):
        return True, lead_id, "created"
    if result.get("updated"):
        return True, lead_id, "updated existing lead"
    if result.get("duplicate"):
        # The CRM already consumed this dedupeKey in an earlier run whose
        # result never reached the workbook. It will never accept it again.
        return True, lead_id, "already ingested earlier"
    if lead_id:
        return True, lead_id, result.get("reason") or "matched existing lead"
    return False, "", "unrecognised response %r" % (result,)


# -------------------------------------------------------------- workbook ----

def open_workbook(path):
    if not os.path.isfile(path):
        fail("no workbook at %s, run the upsert first" % path, 3)
    try:
        # Opening for append proves nobody else holds the file before we spend
        # time on HTTP calls that cannot be rolled back.
        with open(path, "ab"):
            pass
    except PermissionError:
        fail("workbook is open in Excel, close it and re-run: %s" % path, 3)
    return load_workbook(path)


def header_map(sheet):
    return {as_text(cell.value): cell.column for cell in sheet[1] if as_text(cell.value)}


def ensure_columns(sheet, columns, names):
    """Append any missing header cells, styled like the rest of the header."""
    for name in names:
        if name in columns:
            continue
        index = sheet.max_column + 1 if columns else 1
        cell = sheet.cell(row=1, column=index, value=name)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", horizontal="left")
        sheet.column_dimensions[cell.column_letter].width = max(12, len(name) + 6)
        columns[name] = index
    return columns


def read_lead_rows(sheet):
    """(row_number, dict) for every non-empty row under the header."""
    columns = header_map(sheet)
    rows = []
    for row_number in range(2, sheet.max_row + 1):
        record = {name: sheet.cell(row=row_number, column=index).value
                  for name, index in columns.items()}
        if all(v in (None, "") for v in record.values()):
            continue
        rows.append((row_number, record))
    return rows


def changelog_sheet(workbook):
    if SHEET_CHANGELOG in workbook.sheetnames:
        return workbook[SHEET_CHANGELOG]
    sheet = workbook.create_sheet(SHEET_CHANGELOG)
    sheet.append(CHANGELOG_COLUMNS)
    return sheet


def mark_pushed(sheet, columns, row_number, row, crm_lead_id, run_id, now):
    """Set the three push columns on one row; return the Changelog entries."""
    updates = {
        "pushed_to_crm": "yes",
        "pushed_to_crm_at": now.isoformat(timespec="seconds"),
        "crm_lead_id": crm_lead_id,
    }
    entries = []
    for field, new in updates.items():
        old = as_text(row.get(field))
        if old == new:
            continue
        sheet.cell(row=row_number, column=columns[field], value=new)
        row[field] = new
        entries.append(changelog_entry(
            run_id, now.isoformat(timespec="seconds"), as_text(row.get("lead_id")),
            as_text(row.get("lead_name")), "crm_push", field, old, new, SOURCE_LABEL))
    return entries


# ------------------------------------------------------------------ main ----

def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("--workbook", default=DEFAULT_WORKBOOK)
    parser.add_argument("--dry-run", action="store_true",
                        help="print the payloads, post nothing, write nothing")
    parser.add_argument("--limit", type=int, default=0,
                        help="push at most N leads this run (0 = all)")
    args = parser.parse_args(argv)

    config = load_config(args.config)
    dry_run = args.dry_run or config["dry_run"]

    workbook = open_workbook(args.workbook)
    if SHEET_LEADS not in workbook.sheetnames:
        fail("workbook has no %s sheet" % SHEET_LEADS, 3)
    sheet = workbook[SHEET_LEADS]
    columns = header_map(sheet)
    rows = read_lead_rows(sheet)

    selected, skipped = select_rows([row for _, row in rows])
    row_numbers = {id(row): number for number, row in rows}
    if args.limit > 0:
        selected = selected[:args.limit]

    now = datetime.now()
    run_id = now.strftime("push-%Y%m%d-%H%M%S")
    print("Run %s: %d leads in workbook, %d ready to push, %d left behind"
          % (run_id, len(rows), len(selected), len(skipped)))

    if not selected:
        print("Nothing to push.")
        return 0

    payloads = [(row, build_payload(row, config["adapter_name"])) for row in selected]

    if dry_run:
        for row, payload in payloads:
            print("  %-24s %-14s %-7s %s" % (
                payload["dedupeKey"], mask_phone(payload["phone"]),
                payload["leadType"], payload["followUp"].get("meetingSchedule", "")))
        print(json.dumps([p for _, p in payloads], indent=2, ensure_ascii=False))
        print("Dry run: nothing posted, workbook not written.")
        return 0

    ensure_columns(sheet, columns, CRM_PUSH_FIELDS)
    log_sheet = changelog_sheet(workbook)

    pushed = held = 0
    new_changes = []
    for start in range(0, len(payloads), BATCH_SIZE):
        batch = payloads[start:start + BATCH_SIZE]
        try:
            results = post_batch(config, [p for _, p in batch])
        except RuntimeError as err:
            # Save what earlier batches achieved before giving up.
            if new_changes:
                save(workbook, args.workbook)
            fail("batch %d failed after retry: %s (%d leads marked so far)"
                 % (start // BATCH_SIZE + 1, err, pushed), 4)

        by_key = {as_text(r.get("dedupeKey")): r for r in results if isinstance(r, dict)}
        for row, payload in batch:
            result = by_key.get(payload["dedupeKey"], {})
            ok, crm_lead_id, label = outcome_for(result)
            print("  %-24s %-14s %s%s" % (
                payload["dedupeKey"], mask_phone(payload["phone"]), label,
                (" " + crm_lead_id) if crm_lead_id else ""))
            if ok:
                pushed += 1
                new_changes.extend(mark_pushed(
                    sheet, columns, row_numbers[id(row)], row, crm_lead_id, run_id, now))
            else:
                held += 1

    for entry in new_changes:
        log_sheet.append([entry.get(col, "") for col in CHANGELOG_COLUMNS])

    save(workbook, args.workbook)
    print("Pushed %d | held back %d | %d changelog rows | saved %s"
          % (pushed, held, len(new_changes), args.workbook))
    return 0


def save(workbook, path):
    try:
        workbook.save(path)
    except PermissionError:
        fail("workbook is open in Excel, close it and re-run: %s" % path, 3)


if __name__ == "__main__":
    sys.exit(main())
