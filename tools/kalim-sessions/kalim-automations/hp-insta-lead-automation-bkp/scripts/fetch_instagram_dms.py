"""
Fetch Instagram DMs from instagram.com/direct in a real, logged-in Chrome.

Read-only. It opens the inbox, reads the thread list, opens the threads that
changed since the last successful run and reads each message with its sender
straight from the page. It never types, never sends, never reacts and never
presses Accept or Delete on a message request.

Which Chrome (config "browser_mode"):
  extension  (default) the Chrome you already use and are logged in to, through
             the "HP Insta Lead Reader" extension in chrome-extension/. The run
             opens one minimised window, reads, and closes it.
  cdp        a separate Chrome profile driven over the DevTools port. Needs its
             own login once:  python scripts/fetch_instagram_dms.py --login --browser cdp

Normal use is through run_pipeline.py. Direct use:

    python scripts/fetch_instagram_dms.py --out runs/x/fetched.json            # incremental
    python scripts/fetch_instagram_dms.py --out ... --backfill-days 30          # first load
    python scripts/fetch_instagram_dms.py --out ... --max-threads 1 --tabs primary   # smoke test

Exit codes: 0 ok, 4 not logged in / wrong account, 5 browser problem, 6 page
layout not recognised (Instagram changed its markup, nothing was guessed),
7 extension not connected (Chrome closed or extension not loaded).
"""

import argparse
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timedelta

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(HERE)
CONFIG_PATH = os.path.join(ROOT, "config", "fetch-config.json")
STATE_PATH = os.path.join(ROOT, "state", "fetch-state.json")

WEEKDAYS = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1)}
from chrome_bridge import BridgeError, ExtensionNotConnected, make_driver  # noqa: E402

TAB_LABEL = {"primary": "Primary", "general": "General", "requests": "Requests"}


def log(msg):
    print("[fetch %s] %s" % (datetime.now().strftime("%H:%M:%S"), msg), flush=True)


def load_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return default


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


# ---------------------------------------------------------------- time labels

def age_hours(label):
    """Instagram's list label ('9 hours ago', 'a week ago') to an upper-bound-ish hour count."""
    label = (label or "").strip().lower()
    if not label or label == "just now":
        return 0.0
    m = re.match(r"^(an?|\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$", label)
    if not m:
        return None
    n = 1 if m.group(1) in ("a", "an") else int(m.group(1))
    unit = {"second": 1 / 3600, "minute": 1 / 60, "hour": 1, "day": 24,
            "week": 168, "month": 720, "year": 8760}[m.group(2)]
    return n * unit


def resolve_timestamp(label, now):
    """Thread separator label to (date, time, date_source)."""
    if not label:
        return None, None, "before_first_timestamp"
    m = re.match(r"^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}), (\d{1,2}):(\d{2})$", label)
    if m and m.group(2) in MONTHS:
        d = datetime(int(m.group(3)), MONTHS[m.group(2)], int(m.group(1)))
        return d.date().isoformat(), "%02d:%s" % (int(m.group(4)), m.group(5)), "absolute"
    m = re.match(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}):(\d{2})$", label)
    if m:
        # Instagram labels today with a bare time, so a weekday equal to today's is a week back.
        delta = (now.weekday() - WEEKDAYS[m.group(1)]) % 7 or 7
        d = (now - timedelta(days=delta)).date()
        return d.isoformat(), "%02d:%s" % (int(m.group(2)), m.group(3)), "relative_weekday"
    m = re.match(r"^(Yesterday|Today),? (?:at )?(\d{1,2}):(\d{2})$", label, re.I)
    if m:
        d = now.date() - timedelta(days=1 if m.group(1).lower() == "yesterday" else 0)
        return d.isoformat(), "%02d:%s" % (int(m.group(2)), m.group(3)), "relative_day"
    m = re.match(r"^(\d{1,2}):(\d{2})$", label)
    if m:
        return now.date().isoformat(), "%02d:%s" % (int(m.group(1)), m.group(2)), "time_only_today"
    return None, None, "unrecognised_label"


# ---------------------------------------------------------------- pacing

def pause(cfg, kind="thread"):
    lo, hi = cfg["pacing_seconds"][kind]
    time.sleep(random.uniform(lo, hi))


# ---------------------------------------------------------------- page helpers

def wait_for(drv, selectors, timeout_ms, step_ms=700):
    end = time.time() + timeout_ms / 1000.0
    while True:
        if drv.call("hasAny", selectors):
            return True
        if time.time() >= end:
            return False
        drv.sleep(step_ms)


def logged_in(drv):
    wait_for(drv, ['[aria-label="Thread list"]', 'input[name="username"]'], 25000)
    return bool(drv.call("hasAny", ['[aria-label="Thread list"]']))


def open_tab(drv, tab, cfg):
    url = ("https://www.instagram.com/direct/requests/" if tab == "requests"
           else "https://www.instagram.com/direct/inbox/")
    drv.goto(url)
    if not logged_in(drv):
        return False
    if tab != "requests":
        drv.sleep(2500)
        drv.call("clickTab", TAB_LABEL[tab])
    drv.sleep(3000)
    return True


def find_and_click(drv, tab, row, cfg):
    """The list stays beside the open thread, so the next row is usually one scroll away."""
    for attempt in range(2):
        for _ in range(cfg["max_list_scrolls"]):
            if drv.call("clickRow", [row["name"], row["preview"]]):
                return True
            if not drv.call("scrollList"):
                break
            drv.sleep(1200)
        if attempt == 0:
            open_tab(drv, tab, cfg)      # back to the top of the list and search again
    return False


def load_history(drv, cutoff_date, max_scrolls, now):
    """Scroll the message pane up until the thread start, the cutoff date, or the cap."""
    result = drv.call("extractThread")
    for _ in range(max_scrolls):
        if not result.get("ok") or result.get("reachedStart"):
            break
        dated = [resolve_timestamp(m["timestamp_label"], now)[0] for m in result["messages"]]
        dated = [d for d in dated if d]
        if dated and cutoff_date and min(dated) < cutoff_date:
            break
        moved = drv.call("scrollHistory")
        drv.sleep(1800)
        again = drv.call("extractThread")
        grew = len(again.get("messages", [])) > len(result.get("messages", []))
        result = again
        if not moved and not grew:
            break
    return result


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", help="where to write fetched JSON")
    ap.add_argument("--login", action="store_true",
                    help="open the Instagram inbox and wait until it shows as logged in")
    ap.add_argument("--browser", choices=["extension", "cdp"], default=None,
                    help="override browser_mode from config")
    ap.add_argument("--backfill-days", type=int, default=None,
                    help="ignore state and fetch every thread active in the last N days")
    ap.add_argument("--max-threads", type=int, default=None)
    ap.add_argument("--tabs", default=None, help="comma list: primary,general,requests")
    ap.add_argument("--wait-minutes", type=int, default=20, help="with --login: how long to wait")
    ap.add_argument("--keep-browser", action="store_true", help="cdp: leave Chrome open afterwards")
    args = ap.parse_args()

    cfg = load_json(CONFIG_PATH)
    state = load_json(STATE_PATH, {}) or {}
    try:
        with make_driver(cfg, log, mode=args.browser, keep_browser=args.keep_browser) as drv:
            if args.login:
                return wait_for_login(drv, cfg, args)
            return fetch(drv, cfg, state, args)
    except ExtensionNotConnected as exc:
        log(str(exc))
        return 7
    except BridgeError as exc:
        log("browser problem: %s" % exc)
        return 5


def wait_for_login(drv, cfg, args):
    drv.open("https://www.instagram.com/direct/inbox/")
    log("Log in to Instagram as @%s in that Chrome if it is not already. Waiting up to %d minutes."
        % (cfg["our_account"], args.wait_minutes))
    deadline = time.time() + args.wait_minutes * 60
    while time.time() < deadline:
        if drv.call("hasAny", ['[aria-label="Thread list"]']):
            listing = drv.call("listRows")
            log("logged in as @%s, inbox visible." % (listing.get("account") or "?"))
            return 0
        drv.sleep(5000)
    log("timed out waiting for login")
    return 4


def fetch(drv, cfg, state, args):
    now = datetime.now()
    backfill_days = args.backfill_days
    last_success = state.get("last_success_started_at")
    if backfill_days is None and not last_success:
        backfill_days = cfg["first_run_backfill_days"]
    if backfill_days is not None:
        window_hours = backfill_days * 24.0
        since_hours = window_hours
        mode = "backfill_%dd" % backfill_days
    else:
        since_hours = (now - datetime.fromisoformat(last_success)).total_seconds() / 3600 + cfg["incremental_slack_hours"]
        window_hours = max(since_hours, 24.0)
        mode = "incremental"
    max_threads = args.max_threads or (cfg["max_threads_backfill"] if backfill_days else cfg["max_threads_per_run"])
    tabs = (args.tabs or ",".join(cfg["tabs"])).split(",")
    history_cutoff = (now - timedelta(days=cfg["history_days_per_thread"])).date().isoformat()
    known_threads = state.get("threads", {})
    row_index = state.get("row_index", {})
    ignore = {h.lower() for h in cfg.get("ignore_handles", [])}

    log("mode %s | since %.1fh | tabs %s | cap %d threads" % (mode, since_hours, tabs, max_threads))
    fetched, skipped, opened = [], [], 0
    drv.open("https://www.instagram.com/direct/inbox/")

    for tab in tabs:
        if opened >= max_threads:
            break
        if not open_tab(drv, tab, cfg):
            log("not logged in to Instagram in this Chrome. Log in as @%s and run again." % cfg["our_account"])
            return 4
        listing = drv.call("listRows")
        if listing["account"] and listing["account"].lower() != cfg["our_account"].lower() and tab != "requests":
            log("logged-in account is @%s, expected @%s. Stopping." % (listing["account"], cfg["our_account"]))
            return 4
        if not listing["rows"]:
            log("%s: no thread rows recognised" % tab)
            if tab == "primary":
                return 6
            continue

        seen_rows, candidates = set(), []
        quiet_known, stop = 0, False
        for _ in range(cfg["max_list_scrolls"]):
            for row in listing["rows"]:
                key = "%s|%s|%s" % (tab, row["name"], row["preview"])
                if key in seen_rows:
                    continue
                seen_rows.add(key)
                age = age_hours(row["ageLabel"])
                if age is None:
                    log("%s: unrecognised age label %r on %r, opening to be safe" % (tab, row["ageLabel"], row["name"]))
                    age = 0.0
                if age > window_hours + 1e-9 and (backfill_days or age > 24 * 30):
                    stop = True
                    break
                idx = row_index.get("%s|%s" % (tab, row["name"]))
                known_same = bool(idx and known_threads.get(idx, {}).get("preview") == row["preview"])
                if backfill_days or age <= since_hours or not known_same:
                    candidates.append(dict(row, tab=tab, age_hours=age))
                    quiet_known = 0
                else:
                    quiet_known += 1
                    if quiet_known >= cfg["stop_after_unchanged_rows"]:
                        stop = True
                        break
            if stop or listing["atEnd"] or len(candidates) >= max_threads * 2:
                break
            if not drv.call("scrollList"):
                break
            drv.sleep(1500)
            listing = drv.call("listRows")

        log("%s: %d rows read, %d to open" % (tab, len(seen_rows), len(candidates)))

        for row in candidates:
            if opened >= max_threads:
                break
            if row["unread"] and not cfg["open_unread_threads"] and tab != "requests":
                skipped.append({"tab": tab, "name": row["name"], "reason": "unread",
                                "signals": row["unreadSignals"]})
                continue
            pause(cfg, "thread")
            if not find_and_click(drv, tab, row, cfg):
                skipped.append({"tab": tab, "name": row["name"], "reason": "row not found on click"})
                continue
            wait_for(drv, ['[aria-label^="React to message from"]', 'a[aria-label^="Open the profile page of"]'], 20000)
            drv.sleep(2500)
            opened += 1
            result = load_history(drv, history_cutoff, cfg["max_history_scrolls"], now)
            url = result.get("url") or drv.url()
            m = re.search(r"/direct/t/(\d+)", url or "")
            thread_id = m.group(1) if m else None
            handle = (result.get("threadHandle") or "").strip()
            if not result.get("ok") or not thread_id or not handle:
                skipped.append({"tab": tab, "name": row["name"],
                                "reason": result.get("reason") or "no handle/thread id", "url": url})
                continue
            if handle.lower() in ignore:
                skipped.append({"tab": tab, "name": row["name"], "reason": "ignored handle @%s" % handle})
                row_index["%s|%s" % (tab, row["name"])] = thread_id
                known_threads[thread_id] = {"handle": handle, "name": row["name"], "tab": tab,
                                            "preview": row["preview"], "ignored": True}
                continue

            msgs = []
            for msg in result["messages"]:
                d, t, src = resolve_timestamp(msg["timestamp_label"], now)
                sender = msg["sender"]
                if sender.lower() == cfg["our_account"].lower():
                    direction = "business"
                elif sender.lower() == handle.lower():
                    direction = "lead"
                else:
                    direction = "unknown"
                msgs.append({"date": d, "time": t, "date_source": src, "direction": direction,
                             "direction_basis": "instagram sender label", "sender": sender,
                             "text": msg["text"], "reply_context": msg.get("reply_context", "")})
            others = sorted({m["sender"] for m in msgs if m["direction"] == "unknown"})
            fetched.append({
                "thread_id": thread_id, "tab": tab, "handle": handle, "display_name": row["name"],
                "list_preview": row["preview"], "list_age_label": row["ageLabel"],
                "message_request": bool(result.get("requestBanner")) or tab == "requests",
                "reached_thread_start": bool(result.get("reachedStart")),
                "other_participants": others,
                "messages": msgs,
            })
            log("  @%s (%s): %d messages%s" % (handle, tab, len(msgs), ", group/other senders" if others else ""))

            if opened % cfg["long_break_every"] == 0:
                log("  short break")
                pause(cfg, "long_break")

    out = {
        "fetched_at": now.isoformat(timespec="seconds"),
        "mode": mode,
        "account": cfg["our_account"],
        "browser_mode": args.browser or cfg.get("browser_mode", "extension"),
        "tabs": tabs,
        "threads": fetched,
        "skipped": skipped,
        "row_index_updates": {"%s|%s" % (t["tab"], t["display_name"]): t["thread_id"] for t in fetched},
        "ignored_updates": {k: v for k, v in known_threads.items() if v.get("ignored")},
    }
    if args.out:
        write_json(args.out, out)
    log("done: %d threads fetched, %d skipped%s" % (
        len(fetched), len(skipped), (" -> " + args.out) if args.out else ""))
    for s in skipped:
        log("  skipped %s/%s: %s" % (s["tab"], s["name"], s["reason"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
