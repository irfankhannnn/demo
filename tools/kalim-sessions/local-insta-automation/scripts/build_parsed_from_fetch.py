"""
Turn a fetched.json (from fetch_instagram_dms.py) into the parsed-lead format
that the insta-lead-analyst agent and upsert_leads_excel.py already consume.

Differences from the text-export parser, all in favour of accuracy:

- Direction comes from Instagram's own sender label on every message, so
  `direction_basis` is "instagram sender label" instead of a guess.
- Phone numbers are taken only from messages the lead sent. A number our team
  typed ("Call on 95941...") is never the lead's.
- For each lead, the messages already in the workbook's Messages sheet are
  merged in, so the analyst always reads the whole known conversation even
  when this run only scrolled back a little.

    python scripts/build_parsed_from_fetch.py --fetched runs/<id>/fetched.json --out runs/<id>/parsed.json
"""

import argparse
import json
import os
import re
import sys

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from parse_dm_export import normalise_phone, looks_like_phone_line  # noqa: E402

DEFAULT_WORKBOOK = os.path.join(ROOT, "master", "hp-insta-leads.xlsx")
PHRASES_PATH = os.path.join(ROOT, "config", "business-phrases.json")
PHONE_CANDIDATE = re.compile(r"\+?\d[\d\s\-()]{8,14}\d")
CARD = re.compile(r"^Phone number\n(.+)$")


def workbook_history(path):
    """lead_id -> list of message dicts already stored in the workbook."""
    if not os.path.isfile(path):
        return {}
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True)
    if "Messages" not in wb.sheetnames:
        return {}
    rows = list(wb["Messages"].iter_rows(values_only=True))
    if not rows:
        return {}
    header = [str(h) for h in rows[0]]
    history = {}
    for row in rows[1:]:
        rec = dict(zip(header, row))
        lead = str(rec.get("lead_id") or "")
        if not lead:
            continue
        history.setdefault(lead, []).append({
            "date": str(rec.get("date") or "") or None,
            "time": str(rec.get("time") or "") or None,
            "date_source": str(rec.get("date_source") or ""),
            "direction": str(rec.get("direction") or "unknown"),
            "direction_basis": "stored in workbook",
            "text": str(rec.get("text") or ""),
        })
    return history


def phones_in(text):
    if looks_like_phone_line(text):
        candidates = [text]
    else:
        candidates = PHONE_CANDIDATE.findall(text)
    out = []
    for c in candidates:
        n = normalise_phone(c)
        if n and n not in out:
            out.append(n)
    return out


def clean_messages(messages):
    """Drop Instagram's auto-rendered phone cards that repeat the previous bubble's number."""
    out = []
    for msg in messages:
        m = CARD.match(msg["text"])
        if m:
            number = normalise_phone(m.group(1))
            prev = next((p for p in reversed(out) if p.get("sender") == msg.get("sender")), None)
            if number and prev and number in phones_in(prev["text"]):
                continue
            msg = dict(msg, text="[contact card] %s" % m.group(1))
        out.append(msg)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fetched", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workbook", default=DEFAULT_WORKBOOK)
    args = ap.parse_args()

    with open(args.fetched, encoding="utf-8") as fh:
        fetched = json.load(fh)
    with open(PHRASES_PATH, encoding="utf-8") as fh:
        phrases = json.load(fh)
    ours = {normalise_phone(n) for n in phrases.get("business_phone_numbers", [])} - {None}
    wa_phrases = [p.lower() for p in phrases["whatsapp_phrases"]]
    history = workbook_history(args.workbook)

    by_lead = {}
    for thread in fetched["threads"]:
        lead_id = thread["handle"].lower()
        rec = by_lead.setdefault(lead_id, {"thread": thread, "messages": []})
        rec["messages"].extend(clean_messages(thread["messages"]))

    leads = []
    for lead_id, rec in by_lead.items():
        thread = rec["thread"]
        fresh = rec["messages"]
        # Messages before the first separator on the rendered page have no date.
        # They are kept for the analyst's reading but never stored undated when
        # the same text exists dated in the workbook.
        # A thread really can carry the same words twice at the same shown minute:
        # three separate "Okay" replies under one date separator. So text counts as
        # already seen once per occurrence - the first "Okay" in the workbook matches
        # the first in this run, the second the second, and a genuine third is kept.
        merged, seen = [], set()
        for source in (history.get(lead_id, []), fresh):
            occurrences = {}
            for msg in source:
                key = (msg["date"] or "", msg["time"] or "", msg["text"])
                occurrences[key] = occurrences.get(key, 0) + 1
                if key + (occurrences[key],) in seen:
                    continue
                seen.add(key + (occurrences[key],))
                merged.append(msg)
        merged.sort(key=lambda m: ((m["date"] or "0000"), (m["time"] or "")))

        phones, links = [], []
        for msg in merged:
            if msg["direction"] == "lead":
                for n in phones_in(msg["text"]):
                    if n not in ours and n not in phones:
                        phones.append(n)
            for url in re.findall(r"https?://\S+", msg["text"]):
                url = url.rstrip("]")
                if re.search(r"/(reel|p)/", url) and url not in links:
                    links.append(url)

        whatsapp = any(any(p in m["text"].lower() for p in wa_phrases)
                       for m in merged if m["direction"] == "lead")
        dated = [m for m in merged if m["date"]]
        out_messages = [{k: m.get(k) for k in ("date", "time", "date_source", "direction", "direction_basis", "text")}
                        for m in merged]
        for m, src in zip(out_messages, merged):
            if src.get("reply_context"):
                m["reply_context"] = src["reply_context"]
        leads.append({
            "lead_id": lead_id,
            "lead_name": thread["display_name"],
            "instagram_handle": thread["handle"],
            "instagram_link": "https://www.instagram.com/%s/" % thread["handle"],
            "instagram_thread_id": thread["thread_id"],
            "inbox_tab": thread["tab"],
            "message_request": thread["message_request"],
            "other_participants": thread["other_participants"],
            "phones_detected": phones,
            "whatsapp_mentioned_in_chat": whatsapp,
            "reel_links": links,
            "seen_marker": False,
            "conversation_start_date": min(m["date"] for m in dated) if dated else None,
            "conversation_end_date": max(m["date"] for m in dated) if dated else None,
            "message_count": len(merged),
            "undated_message_count": len(merged) - len(dated),
            "messages": out_messages,
        })

    # A screenshot batch names itself; a browser run is named after its run folder.
    screenshots = fetched.get("mode") == "screenshot_transcription"
    run_name = fetched.get("batch") or os.path.basename(os.path.dirname(os.path.abspath(args.fetched))) or "fetch"
    parsed = {
        "source_file": ("screenshots-%s" if screenshots else "instagram-web-%s") % run_name,
        "source_kind": "instagram_dom_fetch",
        "source_mode": fetched.get("mode", "instagram_dom_fetch"),
        "fetched_at": fetched["fetched_at"],
        "anchor_date": fetched["fetched_at"][:10],
        "anchor_basis": "fetch time",
        "lead_count": len(leads),
        "leads": leads,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(parsed, fh, ensure_ascii=False, indent=2)
    total = sum(l["message_count"] for l in leads)
    print("Built %d leads, %d messages -> %s" % (len(leads), total, args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
