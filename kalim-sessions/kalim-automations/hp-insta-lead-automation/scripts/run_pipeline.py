"""
End-to-end Instagram lead run. This is what the Windows scheduled task calls.

    fetch changed threads from instagram.com   (fetch_instagram_dms.py, in your own Chrome
                                               through chrome-extension/)
      -> build parsed leads, merged with history (build_parsed_from_fetch.py)
      -> insta-lead-analyst agent via `claude -p`, in batches
      -> upsert into master/hp-insta-leads.xlsx  (upsert_leads_excel.py)
      -> rebuild lead-dashboard-data.js           (build_dashboard_data.py)
      -> advance state/fetch-state.json

State only moves forward after the workbook write succeeds. If Excel has the
workbook open, the run is parked as pending with its parsed and analysis files
and the next run applies it first, in order, without fetching or analysing it
again.

    python scripts/run_pipeline.py                     # normal scheduled run
    python scripts/run_pipeline.py --backfill-days 30  # full reload of the last 30 days
    python scripts/run_pipeline.py --max-threads 1 --tabs primary   # smoke test
    python scripts/run_pipeline.py --skip-fetch --fetched runs/<id>/fetched.json  # re-run from a saved fetch

Every run writes runs/<run_id>/ (fetched, parsed, analysis, pipeline.log) and
appends one line to logs/runs.jsonl.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(ROOT, "..", "..", ".."))
CONFIG_PATH = os.path.join(ROOT, "config", "fetch-config.json")
STATE_PATH = os.path.join(ROOT, "state", "fetch-state.json")
LOCK_PATH = os.path.join(ROOT, "state", "pipeline.lock")
RUNS_DIR = os.path.join(ROOT, "runs")
RUNS_LOG = os.path.join(ROOT, "logs", "runs.jsonl")
WORKBOOK = os.path.join(ROOT, "master", "hp-insta-leads.xlsx")
PY = sys.executable

LOG_FH = None


def log(msg):
    line = "[pipeline %s] %s" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line, flush=True)
    if LOG_FH:
        LOG_FH.write(line + "\n")
        LOG_FH.flush()


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


def run(cmd, cwd=ROOT, timeout=None):
    """Run a child process, stream its output into the run log, return exit code."""
    log("$ " + " ".join('"%s"' % c if " " in c else c for c in cmd))
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            env=env, text=True, encoding="utf-8", errors="replace")
    start = time.time()
    try:
        for line in proc.stdout:
            line = line.rstrip()
            if "DeprecationWarning" in line or "trace-deprecation" in line:
                continue
            print("    " + line, flush=True)
            if LOG_FH:
                LOG_FH.write("    " + line + "\n")
            if timeout and time.time() - start > timeout:
                proc.kill()
                log("killed after %ds" % timeout)
                return 124
        return proc.wait(timeout=60)
    except subprocess.TimeoutExpired:
        proc.kill()
        return 124


# ---------------------------------------------------------------- lock

def acquire_lock():
    os.makedirs(os.path.dirname(LOCK_PATH), exist_ok=True)
    if os.path.exists(LOCK_PATH):
        age = time.time() - os.path.getmtime(LOCK_PATH)
        if age < 3 * 3600:
            print("another pipeline run holds the lock (%.0f min old): %s" % (age / 60, LOCK_PATH))
            return False
        os.remove(LOCK_PATH)
    with open(LOCK_PATH, "w") as fh:
        fh.write("%d %s" % (os.getpid(), datetime.now().isoformat()))
    return True


def release_lock():
    try:
        os.remove(LOCK_PATH)
    except FileNotFoundError:
        pass


# ---------------------------------------------------------------- analysis

def claude_exe():
    found = shutil.which("claude")
    if found:
        return found
    guess = os.path.join(os.path.expanduser("~"), ".local", "bin", "claude.exe")
    return guess if os.path.isfile(guess) else None


def analyse_batch(parsed_path, out_path, cfg, lead_ids):
    exe = claude_exe()
    if not exe:
        log("claude CLI not found on PATH or in ~/.local/bin")
        return False
    rel_in = os.path.relpath(parsed_path, REPO).replace("\\", "/")
    rel_out = os.path.relpath(out_path, REPO).replace("\\", "/")
    prompt = (
        "Scheduled run of the Instagram lead automation. Today is %s.\n"
        "Read %s and write the analysis JSON for every lead in it to %s, following your "
        "agent definition exactly. The file has %d leads: %s.\n"
        "These messages were read from Instagram web with Instagram's own sender label, so "
        "`direction` is reliable: `business` is our account @%s, `lead` is the other person. "
        "Do not second-guess direction. A number inside a `business` message is ours, never the lead's. "
        "`message_request: true` means the thread is still an unaccepted message request. "
        "Write only that one file. Keep your final reply to three lines."
        % (datetime.now().strftime("%Y-%m-%d"), rel_in, rel_out, len(lead_ids),
           ", ".join(lead_ids), cfg["our_account"]))
    cmd = [exe, "-p", prompt, "--agent", "insta-lead-analyst",
           "--allowedTools", "Read", "Write", "Glob", "Grep",
           "--permission-mode", "acceptEdits", "--output-format", "text"]
    if cfg.get("analysis_model"):
        cmd += ["--model", cfg["analysis_model"]]
    code = run(cmd, cwd=REPO, timeout=cfg["analysis_timeout_seconds"])
    if code != 0:
        log("analyst exited %d" % code)
    return os.path.isfile(out_path)


def analyse(parsed, run_dir, cfg):
    leads = parsed["leads"]
    size = max(1, int(cfg["analysis_batch_size"]))
    merged = {"source_file": parsed["source_file"], "analysed_at": datetime.now().strftime("%Y-%m-%d"),
              "analyst": "insta-lead-analyst", "leads": []}
    for i in range(0, len(leads), size):
        chunk = leads[i:i + size]
        n = i // size + 1
        want = [l["lead_id"] for l in chunk]
        got = {}
        for attempt in (1, 2):
            pending = [l for l in chunk if l["lead_id"] not in got]
            if not pending:
                break
            part = dict(parsed, leads=pending, lead_count=len(pending))
            p_in = os.path.join(run_dir, "batches", "batch-%02d-try%d.parsed.json" % (n, attempt))
            p_out = os.path.join(run_dir, "batches", "batch-%02d-try%d.analysis.json" % (n, attempt))
            write_json(p_in, part)
            log("analysing batch %d (%d leads, attempt %d)" % (n, len(pending), attempt))
            if analyse_batch(p_in, p_out, cfg, [l["lead_id"] for l in pending]):
                try:
                    data = load_json(p_out)
                    for entry in data.get("leads", []):
                        lid = str(entry.get("lead_id", "")).lower()
                        if lid in want and lid not in got:
                            got[lid] = entry
                except (ValueError, AttributeError) as exc:
                    log("batch %d attempt %d wrote unreadable JSON: %s" % (n, attempt, exc))
        missing = [lid for lid in want if lid not in got]
        if missing:
            log("analysis missing for: %s" % ", ".join(missing))
            return None
        merged["leads"].extend(got[lid] for lid in want)
    return merged


# ---------------------------------------------------------------- state

def apply_state(state, fetched, fetch_started):
    threads = state.setdefault("threads", {})
    row_index = state.setdefault("row_index", {})
    for t in fetched["threads"]:
        threads[t["thread_id"]] = {
            "handle": t["handle"], "name": t["display_name"], "tab": t["tab"],
            "preview": t["list_preview"], "last_fetched_at": fetched["fetched_at"],
            "message_count_seen": len(t["messages"]),
        }
    row_index.update(fetched.get("row_index_updates", {}))
    for tid, rec in fetched.get("ignored_updates", {}).items():
        threads[tid] = rec
        row_index["%s|%s" % (rec["tab"], rec["name"])] = tid
    prev = state.get("last_success_started_at")
    if not prev or fetch_started > prev:
        state["last_success_started_at"] = fetch_started


def upsert_and_dashboard(parsed_path, analysis_path, workbook=WORKBOOK):
    code = run([PY, os.path.join(HERE, "upsert_leads_excel.py"),
                "--parsed", parsed_path, "--analysis", analysis_path, "--workbook", workbook])
    if code != 0:
        return code
    if os.path.abspath(workbook) == os.path.abspath(WORKBOOK):
        run([PY, os.path.join(HERE, "build_dashboard_data.py")])
    return 0


def apply_pending(state):
    """Apply parked runs oldest first. Returns False if one is still blocked."""
    pending = state.get("pending_runs", [])
    while pending:
        item = pending[0]
        log("applying parked run %s" % item["run_id"])
        if item.get("parsed") and item.get("analysis"):
            code = upsert_and_dashboard(item["parsed"], item["analysis"])
            if code == 3:
                log("workbook still open in Excel, run %s stays parked" % item["run_id"])
                return False
            if code != 0:
                log("parked run %s failed with exit %d, dropping it (its threads will be refetched)" % (item["run_id"], code))
                pending.pop(0)
                write_json(STATE_PATH, state)
                continue
        apply_state(state, load_json(item["fetched"]), item["fetch_started"])
        pending.pop(0)
        write_json(STATE_PATH, state)
    return True


# ---------------------------------------------------------------- main

def main():
    global LOG_FH
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--backfill-days", type=int)
    ap.add_argument("--max-threads", type=int)
    ap.add_argument("--tabs")
    ap.add_argument("--skip-fetch", action="store_true")
    ap.add_argument("--fetched", help="with --skip-fetch: reuse this fetched.json")
    ap.add_argument("--no-state", action="store_true", help="do not advance fetch state (tests)")
    ap.add_argument("--workbook", default=WORKBOOK,
                    help="write a different workbook (tests); the dashboard is only rebuilt for the master")
    args = ap.parse_args()

    cfg = load_json(CONFIG_PATH)
    if not acquire_lock():
        return 9
    run_id = datetime.now().strftime("run-%Y%m%d-%H%M%S")
    run_dir = os.path.join(RUNS_DIR, run_id)
    os.makedirs(run_dir, exist_ok=True)
    LOG_FH = open(os.path.join(run_dir, "pipeline.log"), "a", encoding="utf-8")
    summary = {"run_id": run_id, "started_at": datetime.now().isoformat(timespec="seconds"),
               "status": "started"}
    try:
        state = load_json(STATE_PATH, {}) or {}
        if not args.no_state and not apply_pending(state):
            summary["status"] = "blocked_excel_open"
            return 3

        fetched_path = os.path.join(run_dir, "fetched.json")
        fetch_started = datetime.now().isoformat(timespec="seconds")
        if args.skip_fetch:
            shutil.copyfile(args.fetched, fetched_path)
            fetch_started = load_json(fetched_path)["fetched_at"]
        else:
            cmd = [PY, os.path.join(HERE, "fetch_instagram_dms.py"), "--out", fetched_path]
            if args.backfill_days is not None:
                cmd += ["--backfill-days", str(args.backfill_days)]
            if args.max_threads:
                cmd += ["--max-threads", str(args.max_threads)]
            if args.tabs:
                cmd += ["--tabs", args.tabs]
            code = run(cmd)
            if code != 0:
                summary["status"] = "fetch_failed_exit_%d" % code
                hint = {
                    4: ": Instagram is logged out (or on another account) in Chrome. Log in as the business account; the next run catches up",
                    5: ": browser problem, see the fetch lines above",
                    6: ": Instagram's page layout was not recognised, fix scripts/dom_*.js",
                    7: ": Chrome is closed or the HP Insta Lead Reader extension is not loaded/enabled; the next run catches up",
                }.get(code, "")
                log("fetch failed with exit %d%s" % (code, hint))
                return code

        fetched = load_json(fetched_path)
        summary.update(mode=fetched["mode"], threads_fetched=len(fetched["threads"]),
                       skipped=len(fetched["skipped"]))
        if not fetched["threads"]:
            log("no changed threads")
            if not args.no_state:
                apply_state(state, fetched, fetch_started)
                write_json(STATE_PATH, state)
            summary["status"] = "ok_nothing_new"
            return 0

        parsed_path = os.path.join(run_dir, "parsed.json")
        code = run([PY, os.path.join(HERE, "build_parsed_from_fetch.py"),
                    "--fetched", fetched_path, "--out", parsed_path, "--workbook", args.workbook])
        if code != 0:
            summary["status"] = "build_failed"
            return code
        parsed = load_json(parsed_path)

        analysis = analyse(parsed, run_dir, cfg)
        if analysis is None:
            summary["status"] = "analysis_incomplete"
            return 2
        analysis_path = os.path.join(run_dir, "analysis.json")
        write_json(analysis_path, analysis)
        scores = {}
        for a in analysis["leads"]:
            scores[a.get("lead_score")] = scores.get(a.get("lead_score"), 0) + 1
        summary["scores"] = scores

        code = upsert_and_dashboard(parsed_path, analysis_path, args.workbook)
        if code == 3:
            log("workbook is open in Excel. Parking this run; the next run applies it first.")
            if not args.no_state:
                state.setdefault("pending_runs", []).append({
                    "run_id": run_id, "fetched": fetched_path, "parsed": parsed_path,
                    "analysis": analysis_path, "fetch_started": fetch_started})
                write_json(STATE_PATH, state)
            summary["status"] = "parked_excel_open"
            return 3
        if code != 0:
            summary["status"] = "upsert_failed_exit_%d" % code
            return code

        if not args.no_state:
            apply_state(state, fetched, fetch_started)
            state["last_run_id"] = run_id
            write_json(STATE_PATH, state)
        summary["status"] = "ok"
        hot = [a for a in analysis["leads"] if a.get("lead_score") == "very_hot"]
        for a in hot:
            log("very_hot @%s: %s" % (a["lead_id"], a.get("next_action", "")[:140]))
        return 0
    except Exception as exc:  # the scheduled task has no console, so record it
        summary["status"] = "crashed: %s" % exc
        log("crashed: %r" % exc)
        raise
    finally:
        summary["finished_at"] = datetime.now().isoformat(timespec="seconds")
        os.makedirs(os.path.dirname(RUNS_LOG), exist_ok=True)
        with open(RUNS_LOG, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(summary, ensure_ascii=False) + "\n")
        log("status: %s" % summary["status"])
        if LOG_FH:
            LOG_FH.close()
        release_lock()


if __name__ == "__main__":
    sys.exit(main())
