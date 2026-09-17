#!/usr/bin/env python3
"""
lead_desk_app.py -- the Instagram Lead Desk app server.

Serves lead-dashboard.html and everything behind it. The store is SQLite
(db/lead-desk.db), not Excel, so the page can write as well as read and two
people looking at it see the same thing.

Every action the app offers happens inline in the pipeline: copy a reply,
assign Sameer, paste reel links, ask a question about a property. There is no
modal anywhere, so each of those is one HTTP call that returns the new state of
the row.

    GET  /api/health
    GET  /api/bootstrap                everything the app needs on load
    GET  /api/leads/<id>               one lead: thread, reels, tasks, answers
    POST /api/leads/<id>/update        inline field edit
    POST /api/leads/<id>/reels         paste one or many Instagram links
    POST /api/leads/<id>/draft         AI: next DM, with live property matches
    POST /api/leads/<id>/save          write the exchange back
    POST /api/reels/<reel id>          tag a reel with a property, or remove it
    POST /api/tasks                    assign Sameer (or anyone)
    POST /api/tasks/<id>/status        open / in_progress / done / dropped
    GET  /api/properties/search        live inventory search
    GET  /api/properties/<id>          one property
    POST /api/properties/answer        reel links + property id -> the answer

Credentials live in .env beside the README and never reach the browser.

Usage:
    python scripts/lead_desk_app.py [--port 8931] [--no-browser]
"""

import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import lead_db as db  # noqa: E402

ENV_PATH = os.path.join(ROOT, ".env")
GEMINI_HOST = "https://generativelanguage.googleapis.com/v1beta"
# Stepped down to when the preferred model keeps answering 503.
FALLBACK_MODEL = "gemini-2.5-flash"
_write_lock = threading.RLock()


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
                "CRM_API_BASE_PATH", "CRM_AUTH_TOKEN", "CRM_INTERNAL_API_KEY",
                "CRM_PUBLIC_API_KEY", "CRM_TENANT_ID", "CRM_TENANT_HEADER",
                "CRM_PROPERTY_SEARCH_PATH", "USE_MOCK_PROPERTIES",
                "PROPERTY_API_BASE", "PROPERTY_API_KEY", "PORT"):
        if os.environ.get(key):
            config[key] = os.environ[key]
    return config


CONFIG = load_env()


def our_account():
    """The Instagram handle this desk belongs to, read from the run config.

    The page shows it in the corner, so it has to come from the same file the
    fetcher uses rather than be typed into the HTML.
    """
    path = os.path.join(ROOT, "config", "fetch-config.json")
    try:
        with open(path, encoding="utf-8") as handle:
            return str(json.load(handle).get("our_account") or "").strip()
    except (OSError, ValueError):
        return ""

# property_api is built alongside this file. If it is not there yet, or it fails
# to import, fall back to the original search module so the app still runs.
try:
    import property_api                                        # noqa: E402
    PROPERTY_BACKEND = "property_api"
except Exception:                                              # noqa: BLE001
    property_api = None
    PROPERTY_BACKEND = "property_search"

import property_search  # noqa: E402


def property_search_call(query_text="", requirement=None, limit=8):
    """One entry point for inventory, whichever module is available."""
    requirement = requirement or {}
    if property_api is not None:
        try:
            return property_api.search(CONFIG, query_text=query_text,
                                       requirement=requirement, limit=limit)
        except Exception as err:                               # noqa: BLE001
            return {"matches": [], "source": "unavailable", "pool": 0,
                    "notes": [], "error": str(err)}
    try:
        matches, source, pool, notes = property_search.match_properties(
            CONFIG, requirement, limit)
        return {"matches": matches, "source": source, "pool": pool,
                "notes": notes, "error": ""}
    except Exception as err:                                   # noqa: BLE001
        return {"matches": [], "source": "unavailable", "pool": 0,
                "notes": [], "error": str(err)}


def property_get(property_id):
    if property_api is not None:
        try:
            return property_api.get_property(CONFIG, property_id)
        except Exception as err:                               # noqa: BLE001
            return {"property": None, "source": "unavailable", "error": str(err)}
    # Without property_api the only way to reach one property is to search the
    # pool and pick it out by id.
    found = property_search_call(query_text=property_id, limit=50)
    for prop in found["matches"]:
        if prop.get("id") == property_id or prop.get("slug") == property_id:
            return {"property": prop, "source": found["source"], "error": ""}
    return {"property": None, "source": found["source"],
            "error": "property %s not found in the pool" % property_id}


def property_facts(prop):
    if property_api is not None and hasattr(property_api, "property_facts"):
        return property_api.property_facts(prop)
    pairs = [("Property id", prop.get("id")), ("Configuration", prop.get("config")),
             ("Society", prop.get("society")), ("Locality", prop.get("locality")),
             ("City", prop.get("city")),
             ("Rent", property_search.money(prop.get("rent"))),
             ("Price", property_search.money(prop.get("price"))),
             ("Deposit", property_search.money(prop.get("deposit"))),
             ("Carpet area", prop.get("carpet_area")),
             ("Furnishing", prop.get("furnishing")), ("Status", prop.get("status")),
             ("Available from", prop.get("available_from"))]
    return [{"label": label, "value": db.as_text(value)}
            for label, value in pairs if db.as_text(value)]


def describe_property(prop):
    if property_api is not None and hasattr(property_api, "describe_for_prompt"):
        return property_api.describe_for_prompt(prop)
    return "; ".join("%s: %s" % (f["label"], f["value"])
                     for f in property_facts(prop))


# ================================================================== Gemini ==

_model_cache = {"name": None, "resolved": False, "note": ""}


def http_json(url, payload=None, headers=None, method=None, timeout=60):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=data,
                                     method=method or ("POST" if data else "GET"))
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
    """Cheapest capable tier wins, which is Flash. Version beats family."""
    lower = name.lower()
    for banned in ("embedding", "aqa", "image", "tts", "audio", "live",
                   "vision", "learnlm", "gemma", "imagen", "veo"):
        if banned in lower:
            return -1
    match = re.search(r"gemini-(\d+(?:\.\d+)?)", lower)
    score = (float(match.group(1)) * 10) if match else 0.0
    if "flash" in lower:
        score += 100
    elif "pro" in lower:
        score += 60
    else:
        return -1
    if "lite" in lower:
        score -= 8
    if "preview" in lower or "-exp" in lower or "experimental" in lower:
        score -= 4
    return score


def resolve_model(force=False):
    if _model_cache["resolved"] and not force:
        return _model_cache["name"], _model_cache["note"]
    key = CONFIG.get("GEMINI_API_KEY", "")
    pinned = CONFIG.get("GEMINI_MODEL", "").strip()
    if pinned:
        _model_cache.update({"name": pinned, "resolved": True,
                             "note": "pinned in .env"})
    elif not key:
        _model_cache.update({"name": None, "resolved": True,
                             "note": "no GEMINI_API_KEY set"})
    else:
        try:
            payload = http_json("%s/models?key=%s&pageSize=200"
                                % (GEMINI_HOST, urllib.parse.quote(key)),
                                timeout=20)
            candidates = []
            for model in payload.get("models", []):
                name = model.get("name", "").replace("models/", "")
                if "generateContent" not in model.get("supportedGenerationMethods", []):
                    continue
                rank = score_model(name)
                if rank > 0:
                    candidates.append((rank, name))
            if candidates:
                candidates.sort(reverse=True)
                _model_cache.update({
                    "name": candidates[0][1], "resolved": True,
                    "note": "chosen from %d models your key can use" % len(candidates)})
            else:
                _model_cache.update({"name": "gemini-2.5-flash", "resolved": True,
                                     "note": "no suitable model listed, using fallback"})
        except RuntimeError as err:
            _model_cache.update({"name": "gemini-2.5-flash", "resolved": True,
                                 "note": "model list unavailable (%s)" % str(err)[:90]})
    return _model_cache["name"], _model_cache["note"]


def gemini(system_text, user_text, schema, temperature=0.4):
    key = CONFIG.get("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set in .env, so the AI parts are off")
    payload = {
        "systemInstruction": {"parts": [{"text": system_text}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {"temperature": temperature,
                             "responseMimeType": "application/json",
                             "responseSchema": schema},
    }

    # The newest Flash model is also the busiest, and a 503 there is routine
    # rather than an error worth showing someone mid-conversation. Retry it,
    # then step down a model, before giving up.
    model, _ = resolve_model()
    attempts = [(model, 0), (model, 2), (model, 5)]
    if FALLBACK_MODEL and FALLBACK_MODEL != model:
        attempts.append((FALLBACK_MODEL, 0))
    last = None
    for candidate, pause in attempts:
        if pause:
            time.sleep(pause)
        try:
            response = http_json(
                "%s/models/%s:generateContent?key=%s"
                % (GEMINI_HOST, candidate, urllib.parse.quote(key)), payload)
            break
        except RuntimeError as err:
            last = err
            text = str(err)
            if "503" not in text and "429" not in text and "UNAVAILABLE" not in text:
                raise
    else:
        raise RuntimeError("Gemini is busy right now (%s). Try again in a moment."
                           % str(last)[:160])

    candidates = response.get("candidates") or []
    if not candidates:
        blocked = response.get("promptFeedback", {}).get("blockReason")
        raise RuntimeError("Gemini returned nothing" +
                           (" (blocked: %s)" % blocked if blocked else ""))
    text = "".join(part.get("text", "")
                   for part in candidates[0].get("content", {}).get("parts") or [])
    try:
        return json.loads(text)
    except ValueError:
        raise RuntimeError("Gemini did not return valid JSON: %s" % text[:300])


# ============================================================== AI prompts ==

EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "deal_type": {"type": "string"}, "property_type": {"type": "string"},
        "locality": {"type": "string"}, "city": {"type": "string"},
        "building_name": {"type": "string"}, "budget": {"type": "string"},
        "units_required": {"type": "string"},
        "possession_timeline": {"type": "string"},
        "mobile_number": {"type": "string"},
        "whatsapp_available": {"type": "string"},
        "lead_score": {"type": "string"}, "lead_type": {"type": "string"},
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
        "reply": {"type": "string"}, "goal_this_turn": {"type": "string"},
        "meeting_proposal": {"type": "string"}, "next_action": {"type": "string"},
        "sourcing_action_for_sameer": {"type": "string"},
        "confidence_note": {"type": "string"},
    },
    "required": ["reply", "goal_this_turn", "next_action"],
}

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "dm_reply": {"type": "string"},
        "unknowns": {"type": "array", "items": {"type": "string"}},
        "follow_up_question": {"type": "string"},
    },
    "required": ["answer", "dm_reply"],
}

EXTRACT_SYSTEM = """You read one Instagram DM thread for a Mumbai real estate agency \
and pull out the lead's requirement. Output JSON only.

Rules:
- Record only what the lead actually said. Never invent a budget, locality, city, \
building name or number.
- Leave a field as an empty string when the conversation has not said it.
- Keep budget as the lead phrased it ("40k to 42k", "5 to 10 lakh deposit"), because \
the unit carries meaning. Never convert it.
- locality stays exactly what the lead said. city only if the city was actually named. \
building_name only for an actual society or project name.
- deal_type is one of: rent, buy, heavy_deposit, or empty.
- lead_type is one of: buyer, seller, tenant, landlord, not_a_lead, unknown. Someone \
looking to rent is a tenant. A heavy deposit enquiry is a tenant.
- lead_score is one of: very_hot, hot, cold.
- ready_for_meeting is true only when you know enough to propose a specific site visit: \
a locality and either a configuration or a budget."""

COMPOSE_SYSTEM = """You write the next Instagram DM for a Mumbai real estate agency, \
continuing a live conversation. Output JSON only.

Your goal, in priority order:
1. Get the lead to a scheduled meeting: a site visit for a specific property, or an \
office visit. That is the outcome that matters.
2. Put a real property in front of them. Matching inventory is supplied to you. Name \
the society or area and the actual rent, price or deposit. Never invent a property, a \
price or an availability, and never imply a property exists when the matches list is \
empty.
3. Close the remaining gaps in their requirement, asking at most one question per message.

How to write the reply:
- Hinglish, roughly 70 percent English and 30 percent romanized Hindi. Warm but brief, \
it has to read well on a phone.
- Two to four short sentences. No greeting boilerplate when the thread is already \
running. Reference the specific thing they just said.
- Always move toward a time. Offer a concrete choice of two slots rather than an open \
question, because a choice gets answered and an open question does not.
- If reels or posts they shared are listed, treat those as the listing the conversation \
is about and answer in that context.
- If nothing matches, be honest that nothing is available right now, say you are \
looking, and give a date to revert. Do not pad it with a fake option.

Also fill sourcing_action_for_sameer: when no property matched, write one instruction \
for Sameer to source it, naming configuration, locality, deal type and budget. Leave it \
empty when a match was found."""

ANSWER_SYSTEM = """You answer one question about one specific property for a Mumbai \
real estate agency. Output JSON only.

You are given the property's real record from inventory, the conversation, and any \
Instagram reels or posts the lead shared. The reels tell you which listing the lead is \
asking about; the property record is the only source of facts.

Rules:
- Answer only from the property record. If the record does not carry the answer, say so \
plainly and list it in unknowns. Never guess a rent, a floor, a deposit, an amenity or \
an availability date.
- answer is for the agent: two or three lines, plain English, the facts.
- dm_reply is what the agent can paste into Instagram right now: Hinglish, roughly 70 \
percent English and 30 percent romanized Hindi, two to four short sentences, quoting \
the real numbers from the record and ending with a nudge toward a visit slot.
- follow_up_question is the one thing worth asking the lead next, or empty."""


def build_thread_text(messages, limit=40):
    lines = []
    for message in messages[-limit:]:
        who = {"lead": "LEAD", "business": "US"}.get(
            db.as_text(message.get("direction")), "UNKNOWN SENDER")
        lines.append("[%s %s] %s: %s" % (
            db.as_text(message.get("date")) or "no date",
            db.as_text(message.get("time")), who, db.as_text(message.get("text"))))
    return "\n".join(lines) or "(no earlier messages)"


def lead_context(lead):
    fields = ["lead_name", "lead_type", "lead_score", "deal_type", "property_type",
              "locality", "city", "building_name", "budget", "units_required",
              "possession_timeline", "mobile_number", "whatsapp_available",
              "meeting_schedule", "summary"]
    return "\n".join("%s: %s" % (key, db.as_text(lead.get(key)) or "(not captured)")
                     for key in fields)


def reel_context(reels):
    if not reels:
        return "(none shared)"
    out = []
    for reel in reels:
        bits = [reel["url"]]
        if db.as_text(reel.get("property_id")):
            bits.append("tagged property %s" % reel["property_id"])
        if db.as_text(reel.get("note")):
            bits.append(reel["note"])
        out.append("- " + " | ".join(bits))
    return "\n".join(out)


# ================================================================ handlers ==

def conn():
    return db.init()


def lead_payload(connection, lead):
    lead_id = lead["lead_id"]
    lead = dict(lead)
    lead["reels"] = db.reels_for(connection, lead_id)
    lead["tasks"] = db.tasks_for(connection, lead_id)
    lead["open_tasks"] = len([t for t in lead["tasks"]
                              if t["status"] in ("open", "in_progress")])
    return lead


def handle_health():
    model, note = resolve_model()
    connection = conn()
    if property_api is not None and hasattr(property_api, "health"):
        try:
            inventory = property_api.health(CONFIG)
        except Exception as err:                               # noqa: BLE001
            inventory = {"mode": "unknown", "ok": False, "error": str(err),
                         "inventory_size": 0, "notes": [], "base": "",
                         "public_api": False}
    else:
        mode, base = property_search.crm_mode(CONFIG)
        try:
            found = property_search_call(requirement={}, limit=1)
            inventory = {"mode": mode, "base": base, "public_api": False,
                         "ok": not found["error"], "inventory_size": found["pool"],
                         "notes": found["notes"], "error": found["error"]}
        except Exception as err:                               # noqa: BLE001
            inventory = {"mode": mode, "base": base, "public_api": False,
                         "ok": False, "inventory_size": 0, "notes": [],
                         "error": str(err)}
    return {
        "ok": True,
        "account": our_account(),
        "gemini_configured": bool(CONFIG.get("GEMINI_API_KEY")),
        "model": model, "model_note": note,
        "env_file_present": os.path.isfile(ENV_PATH),
        "database": db.DB_PATH,
        "database_present": os.path.isfile(db.DB_PATH),
        "property_backend": PROPERTY_BACKEND,
        "inventory": inventory,
        "counts": db.stats(connection),
        "server_time": db.now_iso(),
    }


def handle_bootstrap():
    connection = conn()
    leads = [lead_payload(connection, lead) for lead in db.all_leads(connection)]
    return {
        "health": handle_health(),
        "leads": leads,
        "tasks": db.tasks_for(connection),
        "daily": db.daily_activity(connection),
        "weekly": db.weekly_activity(connection),
        "changelog": db.rows(connection, "SELECT * FROM changelog"
                                         " ORDER BY id DESC LIMIT 300"),
        "runs": db.rows(connection, "SELECT * FROM runs"
                                    " ORDER BY run_timestamp DESC LIMIT 50"),
        "meta": {row["key"]: row["value"]
                 for row in db.rows(connection, "SELECT * FROM meta")},
    }


def handle_lead(lead_id):
    connection = conn()
    lead = db.get_lead(connection, lead_id)
    if lead is None:
        raise RuntimeError("no lead %r" % lead_id)
    payload = lead_payload(connection, lead)
    payload["messages"] = db.messages_for(connection, lead_id)
    payload["answers"] = db.answers_for(connection, lead_id)
    payload["history"] = db.rows(
        connection, "SELECT * FROM changelog WHERE lower(lead_id) = lower(?)"
                    " ORDER BY id DESC LIMIT 60", (lead_id,))
    return payload


def handle_update(lead_id, body):
    with _write_lock:
        connection = conn()
        changes = db.update_fields(connection, lead_id, body.get("fields") or body)
        db.refresh_computed(connection, lead_id)
        return {"lead": lead_payload(connection, db.get_lead(connection, lead_id)),
                "changed": [c[0] for c in changes]}


def handle_add_reels(lead_id, body):
    with _write_lock:
        connection = conn()
        if db.get_lead(connection, lead_id) is None:
            raise RuntimeError("no lead %r" % lead_id)
        blob = db.as_text(body.get("links") or body.get("text"))
        if not blob:
            raise RuntimeError("paste at least one link")
        added, reels = db.add_reels(connection, lead_id, blob,
                                    db.as_text(body.get("property_id")),
                                    db.as_text(body.get("note")))
        if not added and not reels:
            raise RuntimeError("no Instagram or http link found in what you pasted")
        return {"added": added, "reels": reels, "lead_id": lead_id}


def handle_reel(reel_id, body):
    with _write_lock:
        connection = conn()
        return {"reels": db.update_reel(
            connection, int(reel_id),
            property_id=body.get("property_id"),
            note=body.get("note"),
            delete=bool(body.get("delete")))}


def handle_draft(lead_id, body):
    connection = conn()
    lead = db.get_lead(connection, lead_id)
    if lead is None:
        raise RuntimeError("no lead %r" % lead_id)
    thread = db.messages_for(connection, lead_id)
    reels = db.reels_for(connection, lead_id)
    new_message = db.as_text(body.get("message"))

    extracted = gemini(
        EXTRACT_SYSTEM,
        "What the record already holds for this lead:\n%s\n\nThe conversation so "
        "far:\n%s\n\nReels or posts the lead shared:\n%s\n\nThe lead has just "
        "replied:\n%s\n\nUpdate the requirement from everything above."
        % (lead_context(lead), build_thread_text(thread), reel_context(reels),
           new_message or "(nothing new)"),
        EXTRACT_SCHEMA, temperature=0.1)

    requirement = {
        "deal_type": extracted.get("deal_type") or lead.get("deal_type"),
        "property_type": extracted.get("property_type") or lead.get("property_type"),
        "locality": extracted.get("locality") or lead.get("locality"),
        "budget": extracted.get("budget") or lead.get("budget"),
    }
    tagged = [r["property_id"] for r in reels if db.as_text(r.get("property_id"))]
    found = property_search_call(
        query_text=db.as_text(body.get("query")), requirement=requirement, limit=6)
    matches = found["matches"]

    # A property the lead actually sent a reel about beats anything the search
    # ranked, so pull it to the front.
    for property_id in tagged:
        if any(m.get("id") == property_id for m in matches):
            matches.sort(key=lambda m: 0 if m.get("id") == property_id else 1)
            continue
        single = property_get(property_id)
        if single["property"]:
            single["property"]["matched_on"] = "reel the lead shared"
            single["property"].setdefault("match_score", 999)
            matches.insert(0, single["property"])

    if matches:
        inventory_text = "\n".join("- %s" % describe_property(p) for p in matches)
    else:
        inventory_text = ("NO MATCHING PROPERTY. Nothing in inventory fits this "
                          "requirement right now." +
                          (" (lookup failed: %s)" % found["error"]
                           if found["error"] else ""))

    composed = gemini(
        COMPOSE_SYSTEM,
        "Lead record:\n%s\n\nConversation so far:\n%s\n\nReels or posts the lead "
        "shared:\n%s\n\nThe lead has just replied:\n%s\n\nRequirement as now "
        "understood:\n%s\n\nMatching inventory:\n%s\n\nWrite the next DM."
        % (lead_context(lead), build_thread_text(thread), reel_context(reels),
           new_message or "(nothing new)",
           json.dumps(requirement, ensure_ascii=False), inventory_text),
        COMPOSE_SCHEMA, temperature=0.5)

    sourcing = db.as_text(composed.get("sourcing_action_for_sameer"))
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
        "sourcing_action_for_sameer": "" if matches else sourcing,
        "confidence_note": composed.get("confidence_note", ""),
        "extracted": extracted, "requirement": requirement,
        "matches": matches, "match_source": found["source"],
        "inventory_size": found["pool"], "search_notes": found["notes"],
        "search_error": found["error"], "model": model, "model_note": model_note,
    }


def handle_save(lead_id, body):
    """Write the live exchange back: the messages, what it taught us, the history."""
    with _write_lock:
        connection = conn()
        lead = db.get_lead(connection, lead_id)
        if lead is None:
            raise RuntimeError("no lead %r" % lead_id)

        now = datetime.now()
        run_id = now.strftime("chat-%Y%m%d-%H%M%S")
        extracted = body.get("extracted") or {}
        values = {}
        for field in ("deal_type", "property_type", "locality", "city",
                      "building_name", "budget", "units_required",
                      "possession_timeline", "lead_type", "lead_score",
                      "whatsapp_available", "meeting_schedule"):
            if db.as_text(extracted.get(field)):
                values[field] = extracted[field]

        number = re.sub(r"\D", "", db.as_text(extracted.get("mobile_number")))
        if len(number) >= 10:
            known = [n for n in re.split(r"[;,\s]+",
                                         db.as_text(lead.get("mobile_number"))) if n]
            if number[-10:] not in known:
                known.append(number[-10:])
            values["mobile_number"] = "; ".join(known)

        for field, value in (("meeting_schedule", body.get("meeting_proposal")),
                             ("next_action", body.get("next_action")),
                             ("suggested_reply", body.get("reply"))):
            if db.as_text(value):
                values[field] = value
        values["conversation_end_date"] = now.date().isoformat()
        values["last_updated_run"] = run_id
        if not db.as_text(lead.get("conversation_start_date")):
            values["conversation_start_date"] = now.date().isoformat()
        values["source_files"] = "; ".join(sorted(set(
            [s for s in re.split(r";\s*", db.as_text(lead.get("source_files"))) if s]
            + ["live-chat"])))

        _, changes = db.upsert_lead(connection, dict(values, lead_id=lead_id),
                                    run_id=run_id, change_type="live chat",
                                    source_file="live-chat")

        added = 0
        for direction, text in (("lead", body.get("lead_message")),
                                ("business", body.get("reply"))):
            if db.as_text(text):
                db.add_message(connection, lead_id, direction, text,
                               lead_name=db.as_text(lead.get("lead_name")),
                               when=now, date_source="live_chat")
                added += 1

        task = None
        if db.as_text(body.get("sourcing_action_for_sameer")):
            task = db.create_task(connection, {
                "lead_id": lead_id,
                "title": db.as_text(body.get("sourcing_action_for_sameer"))[:160],
                "detail": db.as_text(body.get("sourcing_action_for_sameer")),
                "deal_type": db.as_text(extracted.get("deal_type")),
                "property_type": db.as_text(extracted.get("property_type")),
                "locality": db.as_text(extracted.get("locality")),
                "budget": db.as_text(extracted.get("budget")),
                "source": "draft",
            })

        connection.commit()
        db.refresh_computed(connection, lead_id)
        return {"run_id": run_id, "changes": len(changes),
                "fields": [c[0] for c in changes], "messages_added": added,
                "task": task,
                "lead": lead_payload(connection, db.get_lead(connection, lead_id))}


def handle_create_task(body):
    with _write_lock:
        connection = conn()
        lead_id = db.as_text(body.get("lead_id"))
        if lead_id and db.get_lead(connection, lead_id) is None:
            raise RuntimeError("no lead %r" % lead_id)
        if not db.as_text(body.get("reel_urls")) and lead_id:
            body = dict(body, reel_urls="; ".join(
                r["url"] for r in db.reels_for(connection, lead_id)))
        task = db.create_task(connection, body)
        return {"task": task, "tasks": db.tasks_for(connection),
                "lead": lead_payload(connection, db.get_lead(connection, lead_id))
                if lead_id else None}


def handle_task_status(task_id, body):
    with _write_lock:
        connection = conn()
        task = db.set_task_status(connection, int(task_id),
                                  db.as_text(body.get("status")))
        lead = db.get_lead(connection, task["lead_id"]) if task["lead_id"] else None
        return {"task": task, "tasks": db.tasks_for(connection),
                "lead": lead_payload(connection, lead) if lead else None}


def handle_property_search(query):
    def first(name, default=""):
        return (query.get(name) or [default])[0]
    lead_id = first("lead_id")
    requirement = {"locality": first("locality"),
                   "property_type": first("property_type"),
                   "deal_type": first("deal_type"), "budget": first("budget")}
    if lead_id:
        connection = conn()
        lead = db.get_lead(connection, lead_id)
        if lead:
            for key in requirement:
                if not requirement[key]:
                    requirement[key] = db.as_text(lead.get(key))
    found = property_search_call(query_text=first("q"), requirement=requirement,
                                 limit=int(first("limit", "10") or 10))
    for prop in found["matches"]:
        prop["facts"] = property_facts(prop)
    found["requirement"] = requirement
    return found


def handle_property(property_id):
    found = property_get(property_id)
    if found["property"]:
        found["facts"] = property_facts(found["property"])
    return found


def handle_answer(body):
    """Reel links plus a property id, turned into the answer to paste back."""
    connection = conn()
    lead_id = db.as_text(body.get("lead_id"))
    property_id = db.as_text(body.get("property_id"))
    question = db.as_text(body.get("question")) or \
        "What should I tell the lead about this property?"
    if not property_id:
        raise RuntimeError("property_id is required")

    lead = db.get_lead(connection, lead_id) if lead_id else None
    reels = db.reels_for(connection, lead_id) if lead_id else []
    pasted = db.as_text(body.get("reel_links"))
    if pasted and lead_id:
        db.add_reels(connection, lead_id, pasted, property_id=property_id)
        reels = db.reels_for(connection, lead_id)
    elif pasted:
        reels = [{"url": r["url"], "property_id": property_id, "note": ""}
                 for r in db.parse_reel_links(pasted)]

    found = property_get(property_id)
    prop = found["property"]
    if prop is None:
        raise RuntimeError("could not load property %s: %s"
                           % (property_id, found["error"] or "not found"))
    facts = property_facts(prop)
    thread = db.messages_for(connection, lead_id) if lead_id else []

    result = gemini(
        ANSWER_SYSTEM,
        "The property record from inventory:\n%s\n\nEvery field we hold:\n%s\n\n"
        "Reels or posts the lead shared:\n%s\n\nLead record:\n%s\n\nConversation "
        "so far:\n%s\n\nThe question to answer:\n%s"
        % (describe_property(prop),
           json.dumps(facts, ensure_ascii=False, indent=1),
           reel_context(reels),
           lead_context(lead) if lead else "(no lead selected)",
           build_thread_text(thread, 20), question),
        ANSWER_SCHEMA, temperature=0.3)

    payload = {
        "lead_id": lead_id, "property_id": property_id, "question": question,
        "answer": result.get("answer", ""), "dm_reply": result.get("dm_reply", ""),
        "unknowns": result.get("unknowns") or [],
        "follow_up_question": result.get("follow_up_question", ""),
        "facts": facts, "property": prop, "source": found["source"],
        "reel_urls": "; ".join(r["url"] for r in reels),
    }
    if lead_id:
        db.save_answer(connection, payload)
    return payload


def handle_ingest_hint():
    """What the app should tell you about keeping the data fresh."""
    connection = conn()
    latest = db.one(connection, "SELECT MAX(run_timestamp) t FROM runs")
    return {"last_run": (latest or {}).get("t") or "",
            "counts": db.stats(connection)}


# ================================================================= routing ==

ROUTES = [
    ("GET", r"^/api/health$", lambda m, b, q: handle_health()),
    ("GET", r"^/api/bootstrap$", lambda m, b, q: handle_bootstrap()),
    ("GET", r"^/api/ingest/status$", lambda m, b, q: handle_ingest_hint()),
    ("GET", r"^/api/properties/search$", lambda m, b, q: handle_property_search(q)),
    ("POST", r"^/api/properties/answer$", lambda m, b, q: handle_answer(b)),
    ("GET", r"^/api/properties/(?P<pid>[^/]+)$",
     lambda m, b, q: handle_property(urllib.parse.unquote(m.group("pid")))),
    ("POST", r"^/api/leads/(?P<id>[^/]+)/update$",
     lambda m, b, q: handle_update(m.group("id"), b)),
    ("POST", r"^/api/leads/(?P<id>[^/]+)/reels$",
     lambda m, b, q: handle_add_reels(m.group("id"), b)),
    ("POST", r"^/api/leads/(?P<id>[^/]+)/draft$",
     lambda m, b, q: handle_draft(m.group("id"), b)),
    ("POST", r"^/api/leads/(?P<id>[^/]+)/save$",
     lambda m, b, q: handle_save(m.group("id"), b)),
    ("GET", r"^/api/leads/(?P<id>[^/]+)$",
     lambda m, b, q: handle_lead(m.group("id"))),
    ("POST", r"^/api/reels/(?P<rid>\d+)$",
     lambda m, b, q: handle_reel(m.group("rid"), b)),
    ("POST", r"^/api/tasks/(?P<tid>\d+)/status$",
     lambda m, b, q: handle_task_status(m.group("tid"), b)),
    ("POST", r"^/api/tasks$", lambda m, b, q: handle_create_task(b)),
]
COMPILED = [(method, re.compile(pattern), fn) for method, pattern, fn in ROUTES]


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
        if not parsed.path.startswith("/api/"):
            return False
        body = {}
        length = int(self.headers.get("Content-Length") or 0)
        if length:
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
            except ValueError:
                self.send_json({"error": "request body was not valid JSON"}, 400)
                return True
        query = urllib.parse.parse_qs(parsed.query)
        for route_method, pattern, fn in COMPILED:
            if route_method != method:
                continue
            match = pattern.match(parsed.path)
            if not match:
                continue
            try:
                self.send_json(fn(match, body, query))
            except (RuntimeError, ValueError) as err:
                self.send_json({"error": str(err)}, 400)
            except Exception as err:                           # noqa: BLE001
                self.send_json({"error": "%s: %s" % (type(err).__name__, err)}, 500)
            return True
        self.send_json({"error": "no such endpoint: %s" % parsed.path}, 404)
        return True

    def end_headers(self):
        # The page, its stylesheet and its script are edited while the server is
        # running. A 304 from the browser cache is never what you want here.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store, must-revalidate")
        SimpleHTTPRequestHandler.end_headers(self)

    def send_head(self):
        # Defeat the If-Modified-Since handling in the static file server, which
        # would otherwise answer 304 before end_headers ever runs.
        for header in ("If-Modified-Since", "If-None-Match"):
            while header in self.headers:
                del self.headers[header]
        return SimpleHTTPRequestHandler.send_head(self)

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/":
            self.path = "/lead-dashboard.html"
        elif self.dispatch("GET"):
            return
        super().do_GET()

    def do_POST(self):
        self.dispatch("POST")


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=int(CONFIG.get("PORT") or 8931))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    db.init()
    health = handle_health()
    print("Instagram Lead Desk")
    print("  database   : %s  (%s)" % (
        db.DB_PATH, ", ".join("%s %d" % kv for kv in health["counts"].items())))
    print("  .env       : %s" % ("found" if health["env_file_present"] else
                                 "not found, copy .env.sample to .env"))
    print("  Gemini     : %s%s" % (health["model"] or "not configured",
                                   " (%s)" % health["model_note"]
                                   if health["model_note"] else ""))
    inventory = health["inventory"]
    print("  properties : %s via %s, %d in pool%s" % (
        inventory.get("mode", "?"), health["property_backend"],
        inventory.get("inventory_size", 0),
        "  ERROR: " + inventory["error"] if inventory.get("error") else ""))
    if not health["counts"]["leads"]:
        print("\n  no leads yet. Run: python scripts/migrate_to_sqlite.py")

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
