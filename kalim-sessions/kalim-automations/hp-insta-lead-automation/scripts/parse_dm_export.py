#!/usr/bin/env python3
"""
parse_dm_export.py -- Stage 1 of the HP Instagram lead automation.

Deterministically splits a raw Instagram DM .txt export into one record per
lead and extracts everything that does NOT need judgement: handle, display
name, timestamps, phone numbers, reel links, and message direction wherever
the export states it outright.

Everything requiring judgement (summary, score, reply draft) is left to the
insta-lead-analyst agent in stage 2.

Usage:
    python scripts/parse_dm_export.py <input.txt> [-o parsed/<name>.parsed.json]
                                      [--anchor-date YYYY-MM-DD]

Exit codes: 0 ok, 1 bad input, 2 nothing parsed.
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONFIG_PATH = os.path.join(ROOT, "config", "business-phrases.json")

SEPARATOR_RE = re.compile(r"^\s*-{3,}\s*$")
HANDLE_RE = re.compile(r"^(?P<handle>[A-Za-z0-9._]{1,40})\s*[·]\s*Instagram\s*$")
ABS_TS_RE = re.compile(r"^\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),\s*(\d{1,2}):(\d{2})\s*$")
REL_TS_RE = re.compile(r"^\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})\s*$", re.I)
TIME_ONLY_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})\s*$")
URL_RE = re.compile(r"https?://\S+")

NOISE_LINES = {
    "user-profile-picture",
    "phone number",
    "seen",
    "new messages",
    "message unavailable",
}

MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1)}
WEEKDAYS = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}


def load_config():
    with open(CONFIG_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def clean(text):
    """Strip bidi / zero-width format characters Instagram embeds in names."""
    return "".join(ch for ch in text if unicodedata.category(ch) != "Cf").strip()


def resolve_anchor(path, override):
    if override:
        return datetime.strptime(override, "%Y-%m-%d").date(), "explicit argument"
    try:
        mtime = date.fromtimestamp(os.path.getmtime(path))
        if date(2015, 1, 1) <= mtime <= date.today() + timedelta(days=1):
            return mtime, "input file modified date"
    except OSError:
        pass
    return date.today(), "today (file mtime unusable)"


def resolve_relative(weekday_label, anchor):
    """Map a trailing-7-day weekday label onto the 7 calendar days ending at anchor."""
    target = WEEKDAYS[weekday_label[:3].title()]
    delta = (anchor.weekday() - target) % 7
    return anchor - timedelta(days=delta)


def normalise_phone(raw):
    """Return a 10-digit Indian mobile number, or None."""
    digits = re.sub(r"\D", "", raw)
    for prefix in ("91", "091", "0"):
        if len(digits) == 10 + len(prefix) and digits.startswith(prefix):
            digits = digits[len(prefix):]
            break
    if len(digits) == 10 and digits[0] in "6789":
        return digits
    return None


def looks_like_phone_line(line):
    stripped = re.sub(r"[\s\-()+]", "", line)
    return stripped.isdigit() and 10 <= len(stripped) <= 13


def split_blocks(raw_lines):
    blocks, current = [], []
    for line in raw_lines:
        if SEPARATOR_RE.match(line):
            if current:
                blocks.append(current)
            current = []
        else:
            current.append(line.rstrip("\n"))
    if current:
        blocks.append(current)
    return blocks


def parse_block(lines, anchor, cfg, warnings):
    """Turn one raw block into a lead record, or None when it carries no handle."""
    handle_idx, handle = None, None
    for idx, line in enumerate(lines):
        match = HANDLE_RE.match(clean(line))
        if match:
            handle_idx, handle = idx, match.group("handle")
            break
    if handle is None:
        body = [clean(l) for l in lines if clean(l)]
        if body:
            warnings.append(
                "block skipped, no '<handle> . Instagram' line: "
                + " | ".join(body[:2])[:120])
        return None

    name = ""
    for idx in range(handle_idx - 1, -1, -1):
        candidate = clean(lines[idx])
        if candidate and candidate.lower() not in NOISE_LINES:
            name = candidate
            break

    business_phrases = [p.lower() for p in cfg["business_phrases"]]
    biz_markers = [re.compile(p, re.I) for p in cfg["business_marker_patterns"]]
    lead_markers = [re.compile(p, re.I) for p in cfg["lead_marker_patterns"]]
    wa_phrases = [p.lower() for p in cfg["whatsapp_phrases"]]
    our_numbers = {normalise_phone(n) for n in cfg.get("business_phone_numbers", [])}
    our_numbers.discard(None)

    messages, phones, links = [], [], []
    current_dt = None
    pending_direction = None
    whatsapp_mentioned = False
    seen_marker = False
    after_phone_card = False

    for raw in lines[handle_idx + 1:]:
        line = clean(raw)
        if not line:
            continue
        low = line.lower()

        # Hovering a number in Instagram web opens a card ("Phone number",
        # the number reformatted as 0XXXXX XXXXX, WhatsApp buttons). Copying
        # the thread pastes that card in. It is UI, not a message.
        if after_phone_card:
            after_phone_card = False
            if looks_like_phone_line(line):
                continue
        if low == "phone number":
            after_phone_card = True
            continue
        if low in ("whatsapp message", "whatsapp call"):
            continue

        match = ABS_TS_RE.match(line)
        if match:
            day, mon, year, hour, minute = match.groups()
            if mon.title() in MONTHS:
                current_dt = (
                    date(int(year), MONTHS[mon.title()], int(day)).isoformat(),
                    "%02d:%s" % (int(hour), minute),
                    "absolute")
            continue

        match = REL_TS_RE.match(line)
        if match:
            weekday, hour, minute = match.groups()
            current_dt = (
                resolve_relative(weekday, anchor).isoformat(),
                "%02d:%s" % (int(hour), minute),
                "relative_weekday")
            continue

        match = TIME_ONLY_RE.match(line)
        if match and not looks_like_phone_line(line):
            hour, minute = match.groups()
            current_dt = (anchor.isoformat(),
                          "%02d:%s" % (int(hour), minute),
                          "time_only_assumed_anchor")
            continue

        if low == "seen":
            seen_marker = True
            continue
        if low in NOISE_LINES:
            continue

        if any(p.search(line) for p in biz_markers):
            pending_direction = "business"
            continue
        if any(p.search(line) for p in lead_markers):
            pending_direction = "lead"
            continue

        for url in URL_RE.findall(line):
            if url not in links:
                links.append(url)
        if URL_RE.fullmatch(line):
            continue

        if any(p in low for p in wa_phrases):
            whatsapp_mentioned = True

        shared_a_number = False
        mentions_our_number = False
        if looks_like_phone_line(line):
            candidates = [line]
        else:
            candidates = re.findall(r"\+?\d[\d\s\-()]{8,14}\d", line)
        for candidate in candidates:
            number = normalise_phone(candidate)
            if number is None:
                continue
            if number in our_numbers:
                # Our own contact number, e.g. "Call on 95941...". Never the lead's.
                mentions_our_number = True
                continue
            if looks_like_phone_line(line):
                shared_a_number = True
            if number not in phones:
                phones.append(number)

        if pending_direction:
            direction, basis = pending_direction, "instagram reply marker"
            pending_direction = None
        elif any(p in low for p in business_phrases):
            direction, basis = "business", "matched business phrase config"
        elif mentions_our_number:
            direction, basis = "business", "contains a number from business_phone_numbers"
        elif shared_a_number:
            # A bare number that is not one of ours is the lead sharing theirs.
            direction, basis = "lead", "message is a shared mobile number"
        else:
            direction, basis = "unknown", "not stated in the export"

        messages.append({
            "date": current_dt[0] if current_dt else None,
            "time": current_dt[1] if current_dt else None,
            "date_source": current_dt[2] if current_dt else "before_first_timestamp",
            "direction": direction,
            "direction_basis": basis,
            "text": line,
        })

    # Every thread in this inbox is inbound: the lead opens it against one of our
    # reels or listings. So an unattributed first message is the lead's.
    if messages and messages[0]["direction"] == "unknown":
        messages[0]["direction"] = "lead"
        messages[0]["direction_basis"] = "first message of an inbound thread"

    dated = [m for m in messages if m["date"]]
    return {
        "lead_id": handle.lower(),
        "lead_name": name,
        "instagram_handle": handle,
        "instagram_link": "https://www.instagram.com/%s/" % handle,
        "phones_detected": phones,
        "whatsapp_mentioned_in_chat": whatsapp_mentioned,
        "reel_links": links,
        "seen_marker": seen_marker,
        "conversation_start_date": min(m["date"] for m in dated) if dated else None,
        "conversation_end_date": max(m["date"] for m in dated) if dated else None,
        "message_count": len(messages),
        "undated_message_count": len(messages) - len(dated),
        "messages": messages,
    }


def merge_duplicate(existing, extra):
    """One handle appearing in two blocks of a single export: fold them together."""
    existing["messages"].extend(extra["messages"])
    existing["message_count"] = len(existing["messages"])
    existing["undated_message_count"] = sum(
        1 for m in existing["messages"] if not m["date"])
    for key in ("phones_detected", "reel_links"):
        for item in extra[key]:
            if item not in existing[key]:
                existing[key].append(item)
    existing["whatsapp_mentioned_in_chat"] = (
        existing["whatsapp_mentioned_in_chat"] or extra["whatsapp_mentioned_in_chat"])
    existing["seen_marker"] = existing["seen_marker"] or extra["seen_marker"]
    if not existing["lead_name"]:
        existing["lead_name"] = extra["lead_name"]
    dated = [m["date"] for m in existing["messages"] if m["date"]]
    existing["conversation_start_date"] = min(dated) if dated else None
    existing["conversation_end_date"] = max(dated) if dated else None
    existing["duplicate_blocks_merged"] = existing.get("duplicate_blocks_merged", 1) + 1
    return existing


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", help="raw Instagram DM .txt export")
    parser.add_argument("-o", "--output", help="output JSON path")
    parser.add_argument("--anchor-date",
                        help="YYYY-MM-DD anchor for relative weekday labels")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        print("ERROR: no such file: %s" % args.input, file=sys.stderr)
        return 1

    cfg = load_config()
    anchor, anchor_basis = resolve_anchor(args.input, args.anchor_date)

    with open(args.input, encoding="utf-8") as fh:
        raw_lines = fh.readlines()

    warnings, leads, order = [], {}, []
    for block in split_blocks(raw_lines):
        record = parse_block(block, anchor, cfg, warnings)
        if record is None:
            continue
        if record["lead_id"] in leads:
            merge_duplicate(leads[record["lead_id"]], record)
        else:
            leads[record["lead_id"]] = record
            order.append(record["lead_id"])

    if not leads:
        print("ERROR: no lead blocks parsed - check separator and handle lines.",
              file=sys.stderr)
        return 2

    payload = {
        "source_file": os.path.abspath(args.input),
        "parsed_at": datetime.now().isoformat(timespec="seconds"),
        "anchor_date": anchor.isoformat(),
        "anchor_basis": anchor_basis,
        "lead_count": len(leads),
        "warnings": warnings,
        "leads": [leads[k] for k in order],
    }

    out = args.output or os.path.join(
        ROOT, "parsed",
        os.path.splitext(os.path.basename(args.input))[0] + ".parsed.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)

    unknown = sum(1 for lead in payload["leads"] for m in lead["messages"]
                  if m["direction"] == "unknown")
    total = sum(lead["message_count"] for lead in payload["leads"])
    print("Parsed %d leads, %d messages -> %s" % (len(leads), total, out))
    print("Anchor date %s (%s)" % (anchor.isoformat(), anchor_basis))
    print("Direction stated by export: %d/%d; %d left for the analyst to infer"
          % (total - unknown, total, unknown))
    for warning in warnings:
        print("WARNING: %s" % warning)
    return 0


if __name__ == "__main__":
    sys.exit(main())
