#!/usr/bin/env python3
"""
lead_desk_server.py -- local runner behind the Instagram Lead Desk dashboard.

Serves lead-dashboard.html and provides the endpoints the static page cannot
do on its own:

  GET  /api/health              what is configured and which model is in use
  POST /api/chat/reply          lead's pasted message -> requirement, property
                                matches, drafted Hinglish reply, meeting ask
  POST /api/chat/save           write that exchange back into the workbook
  POST /api/sourcing/status     mark a sourcing task done or dropped
  GET  /api/properties/search   property lookup on its own

Credentials come from a .env file beside this folder's README and never reach
the browser. Run with no .env and the page still works, minus the live parts.

Usage:
    python scripts/lead_desk_server.py [--port 8931] [--no-browser]
    python scripts/lead_desk_server.py --list-models
"""

import argparse
import json
import os
import re
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime, date
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from upsert_leads_excel import (  # noqa: E402  (path set above)
    as_text, merge_list, compute_requirement_complete, compute_closability,
    read_sheet, write_table, LEAD_COLUMNS, CHANGELOG_COLUMNS, MESSAGE_COLUMNS,
    SHEET_LEADS, SHEET_CHANGELOG, SHEET_MESSAGES,
)
from openpyxl import load_workbook  # noqa: E402
from property_search import (  # noqa: E402
    match_properties, crm_mode, fetch_inventory, http_json as _http_json, money,
)

# LEAD_WORKBOOK lets you point the runner at a copy, which is handy when the
# real one is open in Excel and therefore locked against writes.
WORKBOOK = os.environ.get("LEAD_WORKBOOK") or os.path.join(
    ROOT, "master", "hp-insta-leads.xlsx")
ENV_PATH = os.path.join(ROOT, ".env")
MOCK_PROPERTIES = os.path.join(ROOT, "config", "mock-properties.json")
GEMINI_HOST = "https://generativelanguage.googleapis.com/v1beta"

_workbook_lock = threading.Lock()


# =========================================================== configuration ==

def load_env():
    """Minimal .env reader. No dependency, no export syntax, no interpolation."""
    config = {}
    if os.path.isfile(ENV_PATH):
        with open(ENV_PATH, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                config[key.strip()] = value.strip().strip('"').strip("'")
    for key in ("GEMINI_API_KEY", "GEMINI_MODEL", "CRM_API_DOMAIN_NAME",
                "CRM_API_BASE_PATH", "CRM_AUTH_TOKEN",
                "CRM_INTERNAL_API_KEY", "CRM_PUBLIC_API_KEY", "CRM_TENANT_ID",
                "CRM_TENANT_HEADER", "CRM_PROPERTY_SEARCH_PATH",
                "USE_MOCK_PROPERTIES", "PORT"):
        if os.environ.get(key):
            config[key] = os.environ[key]
    return config


CONFIG = load_env()
_model_cache = {"name": None, "resolved": False, "note": ""}


# ================================================================== Gemini ==

def http_json(url, payload=None, headers=None, method=None, timeout=60):
    """One place for every outbound call, so failures read the same way."""
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method or
                                     ("POST" if data else "GET"))
    request.add_header("Content-Type", "application/json")
    request.add_header("Accept", "application/json")
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", "replace")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:600]
        raise RuntimeError("HTTP %s from %s: %s"
                           % (err.code, urllib.parse.urlsplit(url).netloc, detail))
    except urllib.error.URLError as err:
        raise RuntimeError("could not reach %s: %s"
                           % (urllib.parse.urlsplit(url).netloc, err.reason))


def score_model(name):
    """Rank a Gemini model for this job: short Hinglish replies and JSON extraction.

    Cheapest capable tier wins, which is Flash. Version counts more than family,
    so a newer Flash beats an older Pro. Preview builds lose to stable ones.
    """
    lower = name.lower()
    for banned in ("embedding", "aqa", "image", "tts", "audio", "live",
                   "vision", "learnlm", "gemma", "imagen", "veo"):
        if banned in lower:
            return -1
    version = 0.0
    match = re.search(r"gemini-(\d+(?:\.\d+)?)", lower)
    if match:
        version = float(match.group(1))
    score = version * 10
    if "flash" in lower:
        score += 100
    elif "pro" in lower:
        score += 60
    else:
        return -1
    if "lite" in lower:
        score -= 8          # cheaper still, but weaker at Hinglish nuance
    if "preview" in lower or "-exp" in lower or "experimental" in lower:
        score -= 4
    return score


def resolve_model(force=False):
    """Ask the key which models it can actually use rather than hardcoding an id."""
    if _model_cache["resolved"] and not force:
        return _model_cache["name"], _model_cache["note"]

    key = CONFIG.get("GEMINI_API_KEY", "")
    pinned = CONFIG.get("GEMINI_MODEL", "").strip()
    if pinned:
        _model_cache.update({"name": pinned, "resolved": True,
                             "note": "pinned in .env"})
        return pinned, _model_cache["note"]
    if not key:
        _model_cache.update({"name": None, "resolved": True,
                             "note": "no GEMINI_API_KEY set"})
        return None, _model_cache["note"]

    try:
        payload = http_json("%s/models?key=%s&pageSize=200"
                            % (GEMINI_HOST, urllib.parse.quote(key)), timeout=20)
    except RuntimeError as err:
        _model_cache.update({"name": "gemini-2.5-flash", "resolved": True,
                             "note": "model list unavailable (%s), using fallback"
                                     % str(err)[:120]})
        return _model_cache["name"], _model_cache["note"]

    candidates = []
    for model in payload.get("models", []):
        name = model.get("name", "").replace("models/", "")
        if "generateContent" not in model.get("supportedGenerationMethods", []):
            continue
        rank = score_model(name)
        if rank > 0:
            candidates.append((rank, name))
    if not candidates:
        _model_cache.update({"name": "gemini-2.5-flash", "resolved": True,
                             "note": "no suitable model in the list, using fallback"})
        return _model_cache["name"], _model_cache["note"]

    candidates.sort(reverse=True)
    chosen = candidates[0][1]
    _model_cache.update({"name": chosen, "resolved": True,
                         "note": "chosen from %d models your key can use"
                                 % len(candidates)})
    return chosen, _model_cache["note"]


def gemini(system_text, user_text, schema, temperature=0.4):
    key = CONFIG.get("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set in .env")
    model, _ = resolve_model()
    url = "%s/models/%s:generateContent?key=%s" % (
        GEMINI_HOST, model, urllib.parse.quote(key))
    payload = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }
    response = http_json(url, payload)
    candidates = response.get("candidates") or []
    if not candidates:
        blocked = response.get("promptFeedback", {}).get("blockReason")
        raise RuntimeError("Gemini returned nothing" +
                           (" (blocked: %s)" % blocked if blocked else ""))
    parts = candidates[0].get("content", {}).get("parts") or []
    text = "".join(part.get("text", "") for part in parts)
    try:
        return json.loads(text)
    except ValueError:
        raise RuntimeError("Gemini did not return valid JSON: %s" % text[:300])


# ============================================================ AI reasoning ==

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "deal_type": {"type": "string"},
        "property_type": {"type": "string"},
        "locality": {"type": "string"},
        "city": {"type": "string"},
        "building_name": {"type": "string"},
        "budget": {"type": "string"},
        "units_required": {"type": "string"},
        "possession_timeline": {"type": "string"},
        "mobile_number": {"type": "string"},
        "whatsapp_available": {"type": "string"},
        "lead_score": {"type": "string"},
        "lead_type": {"type": "string"},
        "meeting_schedule": {"type": "string"},
        "intent_summary": {"type": "string"},
        "ready_for_meeting": {"type": "boolean"},
        "missing_for_meeting": {"type": "string"},
    },
    "required": ["intent_summary", "ready_for_meeting"],
}

COMPOSE_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "goal_this_turn": {"type": "string"},
        "meeting_proposal": {"type": "string"},
        "next_action": {"type": "string"},
        "sourcing_action_for_sameer": {"type": "string"},
        "confidence_note": {"type": "string"},
    },
    "required": ["reply", "goal_this_turn", "next_action"],
}

EXTRACT_SYSTEM = """You read one Instagram DM thread for a Mumbai real estate agency \
and pull out the lead's requirement. Output JSON only.

Rules:
- Record only what the lead actually said. Never invent a budget, locality, city, \
building name or number.
- Leave a field as an empty string when the conversation has not said it.
- Keep budget as the lead phrased it ("40k to 42k", "5 to 10 lakh deposit"), because \
the unit carries meaning. Never convert it.
- locality stays exactly what the lead said (often already an area, e.g. "Kurla \
West"). city is only the city name if it was actually said (do not assume Mumbai). \
building_name is only an actual society/project/building name, not a vague phrase.
- units_required is how many properties/units they want, as stated (e.g. "2"). Leave \
it empty when only one was implied or nothing was said.
- deal_type is one of: rent, buy, heavy_deposit, or empty.
- lead_type is one of: buyer, seller, tenant, landlord, not_a_lead, unknown. \
Someone looking to rent is a tenant. A heavy deposit enquiry is a tenant.
- lead_score is one of: very_hot, hot, cold. very_hot needs a phone number with a \
real requirement, or a fixed meeting. hot is a clear requirement and recent \
activity but no number. cold is vague, stale or declined.
- ready_for_meeting is true only when you know enough to propose a specific site \
visit or office meeting: a locality and either a configuration or a budget.
- missing_for_meeting names what is still needed, in a few words."""

COMPOSE_SYSTEM = """You write the next Instagram DM for a Mumbai real estate agency, \
continuing a live conversation. Output JSON only.

Your goal, in priority order:
1. Get the lead to a scheduled meeting: a site visit for a specific property, or an \
office visit. That is the outcome that matters.
2. Put a real property in front of them. Matching inventory is supplied to you. \
Name the society or area and the actual rent, price or deposit. Never invent a \
property, a price or an availability, and never imply a property exists when the \
matches list is empty.
3. Close the remaining gaps in their requirement, asking at most one question per \
message.

How to write the reply:
- Hinglish, roughly 70 percent English and 30 percent romanized Hindi, the way the \
team already writes. Warm but brief, it has to read well on a phone.
- Two to four short sentences. No greeting boilerplate when the thread is already \
running. Reference the specific thing they just said.
- Always move toward a time. Offer a concrete choice of two slots rather than \
asking an open question, because a choice gets answered and an open question does not.
- If you have their number, say you will call or WhatsApp. If you do not, ask for it \
once, after giving them something of value.
- If nothing matches their requirement, be honest that nothing is available right \
now, say you are looking, and still try to hold the relationship with a date to \
revert. Do not pad it with a fake option.

Also fill sourcing_action_for_sameer: when no property matched, write one instruction \
for Sameer to source it, naming configuration, locality, deal type and budget. Leave \
it empty when a match was found."""


def build_thread_text(messages, limit=40):
    lines = []
    for message in messages[-limit:]:
        who = {"lead": "LEAD", "business": "US"}.get(
            as_text(message.get("direction")), "UNKNOWN SENDER")
        stamp = as_text(message.get("date"))
        time_part = as_text(message.get("time"))
        lines.append("[%s %s] %s: %s" % (stamp or "no date", time_part, who,
                                         as_text(message.get("text"))))
    return "\n".join(lines) or "(no earlier messages)"


def lead_context(lead):
    fields = ["lead_name", "lead_type", "lead_score", "deal_type", "property_type",
              "locality", "city", "building_name", "budget", "units_required",
              "possession_timeline", "mobile_number",
              "whatsapp_available", "meeting_schedule", "summary"]
    return "\n".join("%s: %s" % (key, as_text(lead.get(key)) or "(not captured)")
                     for key in fields)


# ================================================================= workbook ==

def read_workbook():
    if not os.path.isfile(WORKBOOK):
        return None
    return load_workbook(WORKBOOK)


def get_lead(lead_id):
    workbook = read_workbook()
    if workbook is None:
        return None, [], None
    leads = read_sheet(workbook, SHEET_LEADS, LEAD_COLUMNS)
    messages = read_sheet(workbook, SHEET_MESSAGES, MESSAGE_COLUMNS)
    lead = next((row for row in leads
                 if as_text(row.get("lead_id")).lower() == lead_id.lower()), None)
    thread = [m for m in messages
              if as_text(m.get("lead_id")).lower() == lead_id.lower()]
    return lead, thread, workbook


def save_exchange(lead_id, lead_message, our_reply, extracted, sourcing_action,
                  next_action, meeting):
    """Append the live exchange and merge what it taught us into the lead row.

    Same merge discipline as the export upsert: a blank never clears a known
    value, phone numbers accumulate, and every change lands in the Changelog.
    """
    with _workbook_lock:
        workbook = read_workbook()
        if workbook is None:
            raise RuntimeError("no workbook at %s, run the upsert first" % WORKBOOK)

        leads = read_sheet(workbook, SHEET_LEADS, LEAD_COLUMNS)
        messages = read_sheet(workbook, SHEET_MESSAGES, MESSAGE_COLUMNS)
        changelog = read_sheet(workbook, SHEET_CHANGELOG, CHANGELOG_COLUMNS)

        lead = next((row for row in leads
                     if as_text(row.get("lead_id")).lower() == lead_id.lower()), None)
        if lead is None:
            raise RuntimeError("no lead %r in the workbook" % lead_id)

        now = datetime.now()
        run_id = now.strftime("chat-%Y%m%d-%H%M%S")
        today = now.date()
        stamp_date = today.isoformat()
        stamp_time = now.strftime("%H:%M")
        changes = []

        def apply(field, value, allow_overwrite=True):
            value = as_text(value)
            if not value:
                return
            old = as_text(lead.get(field))
            if old and not allow_overwrite:
                return
            if old == value:
                return
            changes.append((field, old, value))
            lead[field] = value

        for field in ("deal_type", "property_type", "locality", "city",
                      "building_name", "budget", "units_required",
                      "possession_timeline", "lead_type", "lead_score",
                      "whatsapp_available", "meeting_schedule"):
            apply(field, extracted.get(field))

        number = re.sub(r"\D", "", as_text(extracted.get("mobile_number")))
        if len(number) >= 10:
            merged = merge_list(lead.get("mobile_number"), [number[-10:]])
            if merged != as_text(lead.get("mobile_number")):
                changes.append(("mobile_number", as_text(lead.get("mobile_number")),
                                merged))
                lead["mobile_number"] = merged

        apply("meeting_schedule", meeting)
        apply("next_action", next_action)
        apply("suggested_reply", our_reply)

        if sourcing_action:
            apply("sourcing_action_for_sameer", sourcing_action)
            if as_text(lead.get("sourcing_status")).lower() not in ("done", "dropped"):
                apply("sourcing_status", "open")
                apply("sourcing_raised_on", stamp_date)

        for field, value in (("conversation_end_date", stamp_date),
                             ("last_updated_run", run_id)):
            if as_text(lead.get(field)) != value:
                changes.append((field, as_text(lead.get(field)), value))
                lead[field] = value
        if not as_text(lead.get("conversation_start_date")):
            lead["conversation_start_date"] = stamp_date

        new_messages = []
        if as_text(lead_message):
            new_messages.append(("lead", as_text(lead_message)))
        if as_text(our_reply):
            new_messages.append(("business", as_text(our_reply)))
        for direction, text in new_messages:
            messages.append({
                "lead_id": lead_id, "lead_name": as_text(lead.get("lead_name")),
                "date": stamp_date, "time": stamp_time,
                "date_source": "live_chat", "direction": direction,
                "text": text, "source_file": "live-chat",
            })

        lead["message_count"] = int(as_text(lead.get("message_count")) or 0) + \
            len(new_messages)
        lead["requirement_complete"] = compute_requirement_complete(lead)
        lead["dm_can_be_closed"], lead["close_reason"] = compute_closability(lead)
        try:
            lead["days_since_last_message"] = (
                today - date.fromisoformat(lead["conversation_end_date"])).days
        except (ValueError, TypeError):
            pass
        lead["source_files"] = merge_list(lead.get("source_files"), ["live-chat"])

        for field, old, new in changes:
            changelog.append({
                "run_id": run_id, "run_timestamp": now.isoformat(timespec="seconds"),
                "lead_id": lead_id, "lead_name": as_text(lead.get("lead_name")),
                "change_type": "live chat", "field": field,
                "old_value": old, "new_value": new, "source_file": "live-chat",
            })

        messages.sort(key=lambda m: (as_text(m.get("date")) or "9999",
                                     as_text(m.get("time")) or "",
                                     as_text(m.get("lead_id"))))
        write_table(workbook, SHEET_LEADS, LEAD_COLUMNS, leads,
                    wrap_columns=("summary", "suggested_reply", "next_action",
                                  "close_reason", "notes",
                                  "sourcing_action_for_sameer"))
        write_table(workbook, SHEET_CHANGELOG, CHANGELOG_COLUMNS, changelog)
        write_table(workbook, SHEET_MESSAGES, MESSAGE_COLUMNS, messages,
                    wrap_columns=("text",))
        try:
            workbook.save(WORKBOOK)
        except PermissionError:
            raise RuntimeError("the workbook is open in Excel. Close it and retry.")
        return {"run_id": run_id, "changes": len(changes),
                "messages_added": len(new_messages),
                "fields": [c[0] for c in changes]}


def set_sourcing_status(lead_id, status):
    if status not in ("open", "done", "dropped", ""):
        raise RuntimeError("status must be open, done, dropped or empty")
    with _workbook_lock:
        workbook = read_workbook()
        if workbook is None:
            raise RuntimeError("no workbook yet")
        leads = read_sheet(workbook, SHEET_LEADS, LEAD_COLUMNS)
        changelog = read_sheet(workbook, SHEET_CHANGELOG, CHANGELOG_COLUMNS)
        lead = next((row for row in leads
                     if as_text(row.get("lead_id")).lower() == lead_id.lower()), None)
        if lead is None:
            raise RuntimeError("no lead %r" % lead_id)
        now = datetime.now()
        old = as_text(lead.get("sourcing_status"))
        lead["sourcing_status"] = status
        changelog.append({
            "run_id": now.strftime("chat-%Y%m%d-%H%M%S"),
            "run_timestamp": now.isoformat(timespec="seconds"),
            "lead_id": lead_id, "lead_name": as_text(lead.get("lead_name")),
            "change_type": "live chat", "field": "sourcing_status",
            "old_value": old, "new_value": status, "source_file": "live-chat",
        })
        write_table(workbook, SHEET_LEADS, LEAD_COLUMNS, leads,
                    wrap_columns=("summary", "suggested_reply", "next_action",
                                  "close_reason", "notes",
                                  "sourcing_action_for_sameer"))
        write_table(workbook, SHEET_CHANGELOG, CHANGELOG_COLUMNS, changelog)
        try:
            workbook.save(WORKBOOK)
        except PermissionError:
            raise RuntimeError("the workbook is open in Excel. Close it and retry.")
        return {"lead_id": lead_id, "sourcing_status": status}


# ================================================================ handlers ==

def handle_reply(body):
    lead_id = as_text(body.get("lead_id"))
    new_message = as_text(body.get("message"))
    if not lead_id:
        raise RuntimeError("lead_id is required")

    lead, thread, _ = get_lead(lead_id)
    if lead is None:
        raise RuntimeError("no lead %r in the workbook" % lead_id)

    thread_text = build_thread_text(thread)
    extracted = gemini(
        EXTRACT_SYSTEM,
        "What the sheet already holds for this lead:\n%s\n\n"
        "The conversation so far:\n%s\n\n"
        "The lead has just replied:\n%s\n\n"
        "Update the requirement from everything above."
        % (lead_context(lead), thread_text, new_message or "(nothing new)"),
        EXTRACT_SCHEMA, temperature=0.1)

    requirement = {
        "deal_type": extracted.get("deal_type") or lead.get("deal_type"),
        "property_type": extracted.get("property_type") or lead.get("property_type"),
        "locality": extracted.get("locality") or lead.get("locality"),
        "budget": extracted.get("budget") or lead.get("budget"),
    }
    try:
        matches, source, pool, search_notes = match_properties(CONFIG, requirement)
        search_error = ""
    except RuntimeError as err:
        matches, source, pool = [], "unavailable", 0
        search_notes, search_error = [], str(err)

    if matches:
        inventory_text = "\n".join(
            "- %s | %s %s | %s | rent %s | price %s | deposit %s (matched on %s)"
            % (prop["title"] or prop["id"], prop["config"], prop["society"],
               prop["locality"], money(prop["rent"]) or "-",
               money(prop["price"]) or "-", money(prop["deposit"]) or "-",
               prop["matched_on"])
            for prop in matches)
    else:
        inventory_text = ("NO MATCHING PROPERTY. Nothing in inventory fits this "
                          "requirement right now." +
                          (" (property lookup failed: %s)" % search_error
                           if search_error else ""))

    composed = gemini(
        COMPOSE_SYSTEM,
        "Lead record:\n%s\n\nConversation so far:\n%s\n\n"
        "The lead has just replied:\n%s\n\n"
        "Requirement as now understood:\n%s\n\n"
        "Matching inventory:\n%s\n\n"
        "Write the next DM."
        % (lead_context(lead), thread_text, new_message or "(nothing new)",
           json.dumps(requirement, ensure_ascii=False), inventory_text),
        COMPOSE_SCHEMA, temperature=0.5)

    sourcing = as_text(composed.get("sourcing_action_for_sameer"))
    if not matches and not sourcing:
        sourcing = ("Source %s %s in %s, budget %s, for @%s." % (
            requirement.get("property_type") or "property",
            requirement.get("deal_type") or "",
            requirement.get("locality") or "the requested area",
            requirement.get("budget") or "not stated", lead_id)).replace("  ", " ")

    model, model_note = resolve_model()
    return {
        "lead_id": lead_id,
        "reply": composed.get("reply", ""),
        "goal_this_turn": composed.get("goal_this_turn", ""),
        "meeting_proposal": composed.get("meeting_proposal", ""),
        "next_action": composed.get("next_action", ""),
        "sourcing_action_for_sameer": sourcing if not matches else "",
        "confidence_note": composed.get("confidence_note", ""),
        "extracted": extracted,
        "requirement": requirement,
        "matches": matches,
        "match_source": source,
        "inventory_size": pool,
        "search_notes": search_notes,
        "search_error": search_error,
        "model": model,
        "model_note": model_note,
    }


def handle_health():
    model, note = resolve_model()
    mode, base = crm_mode(CONFIG)
    inventory_error = ""
    notes = []
    try:
        rows, source, notes = fetch_inventory(CONFIG, {}, 1)
        inventory = len(rows)
    except RuntimeError as err:
        rows, source, inventory, inventory_error = [], "unavailable", 0, str(err)
    return {
        "ok": True,
        "gemini_configured": bool(CONFIG.get("GEMINI_API_KEY")),
        "model": model,
        "model_note": note,
        "crm_mode": mode,
        "crm_configured": mode != "mock",
        "crm_base": base if base else "",
        "inventory_source": source,
        "inventory_size": inventory,
        "inventory_notes": notes,
        "inventory_error": inventory_error,
        "workbook_present": os.path.isfile(WORKBOOK),
        "env_file_present": os.path.isfile(ENV_PATH),
    }


ROUTES = {
    ("GET", "/api/health"): lambda body, query: handle_health(),
    ("POST", "/api/chat/reply"): lambda body, query: handle_reply(body),
    ("POST", "/api/chat/save"): lambda body, query: save_exchange(
        as_text(body.get("lead_id")), body.get("lead_message"), body.get("reply"),
        body.get("extracted") or {}, as_text(body.get("sourcing_action_for_sameer")),
        as_text(body.get("next_action")), as_text(body.get("meeting_proposal"))),
    ("POST", "/api/sourcing/status"): lambda body, query: set_sourcing_status(
        as_text(body.get("lead_id")), as_text(body.get("status")).lower()),
    ("GET", "/api/properties/search"): lambda body, query: (
        lambda matches, source, pool, notes: {
            "matches": matches, "source": source, "inventory_size": pool,
            "notes": notes,
        })(*match_properties(CONFIG, {
            "locality": (query.get("locality") or [""])[0],
            "property_type": (query.get("property_type") or [""])[0],
            "deal_type": (query.get("deal_type") or [""])[0],
            "budget": (query.get("budget") or [""])[0],
        })),
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            sys.stderr.write("  %s %s\n" % (self.command, self.path))

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def dispatch(self, method):
        parsed = urllib.parse.urlsplit(self.path)
        route = ROUTES.get((method, parsed.path))
        if route is None:
            return False
        body = {}
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
            except ValueError:
                self.send_json({"error": "request body was not valid JSON"}, 400)
                return True
        try:
            self.send_json(route(body, urllib.parse.parse_qs(parsed.query)))
        except RuntimeError as err:
            self.send_json({"error": str(err)}, 400)
        except Exception as err:                       # noqa: BLE001
            self.send_json({"error": "%s: %s" % (type(err).__name__, err)}, 500)
        return True

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/":
            self.path = "/lead-dashboard.html"
        elif self.dispatch("GET"):
            return
        if parsed.path.startswith("/api/"):
            self.send_json({"error": "no such endpoint"}, 404)
            return
        super().do_GET()

    def do_POST(self):
        if not self.dispatch("POST"):
            self.send_json({"error": "no such endpoint"}, 404)


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int,
                        default=int(CONFIG.get("PORT") or 8931))
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--list-models", action="store_true",
                        help="print the Gemini models your key can use, then exit")
    args = parser.parse_args()

    if args.list_models:
        key = CONFIG.get("GEMINI_API_KEY", "")
        if not key:
            print("GEMINI_API_KEY is not set in .env", file=sys.stderr)
            return 1
        payload = http_json("%s/models?key=%s&pageSize=200"
                            % (GEMINI_HOST, urllib.parse.quote(key)))
        rows = []
        for model in payload.get("models", []):
            name = model.get("name", "").replace("models/", "")
            if "generateContent" in model.get("supportedGenerationMethods", []):
                rows.append((score_model(name), name))
        for rank, name in sorted(rows, reverse=True):
            print("%7.1f  %s" % (rank, name))
        chosen, note = resolve_model()
        print("\nwould use: %s (%s)" % (chosen, note))
        return 0

    health = handle_health()
    print("Instagram Lead Desk runner")
    print("  workbook   : %s" % ("found" if health["workbook_present"] else
                                 "MISSING, run the upsert first"))
    print("  .env       : %s" % ("found" if health["env_file_present"] else
                                 "not found, copy .env.sample to .env"))
    print("  Gemini     : %s%s" % (
        health["model"] or "not configured",
        " (%s)" % health["model_note"] if health["model_note"] else ""))
    print("  properties : %s, %d in pool%s" % (
        health["inventory_source"], health["inventory_size"],
        "  ERROR: " + health["inventory_error"] if health["inventory_error"] else ""))

    url = "http://127.0.0.1:%d/" % args.port
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print("\n  serving %s   (ctrl+c to stop)\n" % url)
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
