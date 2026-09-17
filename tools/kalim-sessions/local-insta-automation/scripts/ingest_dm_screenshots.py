"""
Turn a batch of DM screenshot transcripts into the fetched.json that
build_parsed_from_fetch.py already consumes.

A batch folder is what the local screenshot utility produces: one DM-NNN folder
per conversation, each holding a stitched combined.png. An agent reads those
images and writes one transcript JSON per conversation into
<batch>/_processed/transcripts/. This script turns that folder into a single
fetched.json, so screenshots join the pipeline at exactly the same place the
browser fetch does and inherit its message dedup and workbook merge.

Reels are the reason this stage exists. Instagram's DM reel card shows only the
author handle and a thumbnail - never a URL - so a screenshot can never tell us
which reel a lead was asking about. Every reel found is written to
<batch>/_processed/reel-links.json with an empty "url". Fill those in, re-run,
and the URL is planted in the shared-reel message so the parser picks it up into
the lead's reel_links and the analyst can match it to a property.

    python scripts/ingest_dm_screenshots.py --batch screenshots-dm/18-09-2026-9pm
    python scripts/build_parsed_from_fetch.py --fetched <batch>/_processed/fetched.json --out parsed/<batch>.parsed.json
"""

import argparse
import datetime
import json
import os
import re
import sys

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

ABS_STAMP = re.compile(r"^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$")
DATE_ONLY = re.compile(r"^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})$")
TIME_ONLY = re.compile(r"^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$")
WEEKDAY_TIME = re.compile(r"^[A-Za-z]{3,9}\.?\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$")
MONTHS = {m.lower(): i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def month_number(word):
    return MONTHS.get(word[:3].lower())


def to_24h(hour, meridiem):
    if not meridiem:
        return hour
    meridiem = meridiem.lower()
    if meridiem == "am":
        return 0 if hour == 12 else hour
    return hour if hour == 12 else hour + 12


def read_stamp(raw):
    """A transcript timestamp -> (date or None, time or None). Unparsed -> (None, None)."""
    if not raw:
        return None, None
    text = str(raw).strip()
    m = ABS_STAMP.match(text)
    if m:
        day, mon, year, hour, minute, mer = m.groups()
        number = month_number(mon)
        if number:
            return "%s-%02d-%02d" % (year, number, int(day)), "%02d:%s" % (to_24h(int(hour), mer), minute)
    m = DATE_ONLY.match(text)
    if m:
        day, mon, year = m.groups()
        number = month_number(mon)
        if number:
            return "%s-%02d-%02d" % (year, number, int(day)), None
    m = TIME_ONLY.match(text) or WEEKDAY_TIME.match(text)
    if m:
        hour, minute, mer = m.groups()
        return None, "%02d:%s" % (to_24h(int(hour), mer), minute)
    return None, None


def reel_key(folder, seq):
    return "%s#%d" % (folder, seq)


def describe_reel(ref, message):
    """The text we stand in for a shared reel card, which carries no text of its own."""
    author = (ref or {}).get("author_handle") or ""
    author = author.split("(")[0].strip().strip("'").strip('"')
    caption = (ref or {}).get("caption_or_text") or ""
    bits = ["shared a reel"]
    if author:
        bits.append("by %s" % (author if author.startswith("@") else "@" + author))
    if caption:
        bits.append("captioned %s" % caption)
    return "[%s]" % " ".join(bits)


def attachment_text(message):
    kind = message.get("attachment")
    detail = (message.get("attachment_detail") or "").strip()
    if kind in ("reel", "post"):
        return None  # handled by describe_reel so the wording stays stable
    label = {"image": "sent a photo", "video": "sent a video", "voice": "sent a voice note",
             "story_reply": "replied to a story", "link": "shared a link"}.get(kind)
    if not label:
        return None
    return "[%s]" % label if not detail else "[%s: %s]" % (label, detail[:160])


def load_reel_links(path):
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        stored = json.load(fh)
    return {entry["reel_id"]: entry for entry in stored.get("reels", []) if entry.get("reel_id")}


def build_thread(transcript, known_links, wanted):
    folder = transcript["source_folder"]
    handle = transcript.get("handle")
    if not handle:
        raise ValueError("%s has no instagram handle - the chat header was not captured" % folder)
    refs = {ref.get("message_seq"): ref for ref in transcript.get("reel_references", [])}

    messages = []
    current_date, current_time = None, None
    for message in transcript["messages"]:
        for raw in (message.get("day_marker"), message.get("timestamp")):
            date, time = read_stamp(raw)
            if date:
                current_date, current_time = date, time or current_time
            elif time:
                current_time = time

        text = (message.get("text") or "").strip()
        seq = message.get("seq")
        if message.get("attachment") in ("reel", "post"):
            ref = refs.get(seq)
            key = reel_key(folder, seq)
            stand_in = describe_reel(ref, message)
            link = (known_links.get(key) or {}).get("url") or (ref or {}).get("url")
            if link:
                stand_in = "%s %s" % (stand_in, link)
            else:
                wanted.append({
                    "reel_id": key,
                    "conversation": folder,
                    "lead_handle": handle,
                    "lead_name": transcript.get("thread_title"),
                    "shared_by": (ref or {}).get("by") or message.get("sender"),
                    "seen_on": current_date,
                    "author_handle_on_card": (ref or {}).get("author_handle"),
                    "caption_on_card": (ref or {}).get("caption_or_text"),
                    "thumbnail": (message.get("attachment_detail") or "")[:240],
                    "our_property_guess": (ref or {}).get("our_property_guess"),
                    "url": "",
                    "property_id": "",
                })
            text = "%s %s" % (stand_in, text) if text else stand_in
        else:
            extra = attachment_text(message)
            if extra:
                text = "%s %s" % (extra, text) if text else extra
        if not text:
            continue

        messages.append({
            "date": current_date,
            "time": current_time,
            "date_source": "absolute" if current_date else "before_first_timestamp",
            "direction": "business" if message.get("sender") == "us" else "lead",
            "direction_basis": "screenshot bubble alignment",
            "sender": message.get("sender"),
            "text": text,
            "reply_context": None,
        })

    return {
        "thread_id": "screenshot:%s:%s" % (transcript.get("batch") or "batch", folder),
        "tab": "primary",
        "handle": handle,
        "display_name": transcript.get("thread_title") or handle,
        "list_preview": messages[-1]["text"][:120] if messages else "",
        "list_age_label": "",
        "message_request": False,
        "reached_thread_start": True,
        "other_participants": [],
        "messages": messages,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--batch", required=True, help="a screenshots-dm/<batch> folder")
    ap.add_argument("--out", help="default <batch>/_processed/fetched.json")
    ap.add_argument("--account", default="", help="the Instagram account these DMs belong to")
    args = ap.parse_args()

    batch = os.path.abspath(args.batch)
    processed = os.path.join(batch, "_processed")
    transcript_dir = os.path.join(processed, "transcripts")
    if not os.path.isdir(transcript_dir):
        print("No transcripts in %s - run the transcription step first." % transcript_dir, file=sys.stderr)
        return 1

    links_path = os.path.join(processed, "reel-links.json")
    known_links = load_reel_links(links_path)

    threads, wanted, problems = [], [], []
    for name in sorted(os.listdir(transcript_dir)):
        if not name.lower().endswith(".json"):
            continue
        with open(os.path.join(transcript_dir, name), encoding="utf-8") as fh:
            transcript = json.load(fh)
        try:
            threads.append(build_thread(transcript, known_links, wanted))
        except ValueError as exc:
            problems.append(str(exc))

    out_path = os.path.abspath(args.out or os.path.join(processed, "fetched.json"))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    fetched = {
        "fetched_at": datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "mode": "screenshot_transcription",
        "account": args.account,
        "browser_mode": "none",
        "tabs": ["primary"],
        "batch": os.path.basename(batch),
        "threads": threads,
        "skipped": problems,
        "row_index_updates": [],
        "ignored_updates": [],
    }
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(fetched, fh, ensure_ascii=False, indent=2)

    # Reels keep their answers between runs: anything already filled in is preserved.
    merged = list(known_links.values())
    have = {entry["reel_id"] for entry in merged}
    merged.extend(entry for entry in wanted if entry["reel_id"] not in have)
    merged.sort(key=lambda e: e["reel_id"])
    with open(links_path, "w", encoding="utf-8") as fh:
        json.dump({"batch": os.path.basename(batch),
                   "note": "Paste the reel URL into each empty url, then re-run this script. "
                           "property_id is optional and links the reel to a CRM property.",
                   "reels": merged}, fh, ensure_ascii=False, indent=2)

    total = sum(len(t["messages"]) for t in threads)
    missing = [e for e in merged if not e.get("url")]
    print("Threads %d, messages %d -> %s" % (len(threads), total, out_path))
    print("Reels seen %d, still without a link %d -> %s" % (len(merged), len(missing), links_path))
    for problem in problems:
        print("  skipped: %s" % problem)
    return 0


if __name__ == "__main__":
    sys.exit(main())
