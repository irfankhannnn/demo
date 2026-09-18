#!/usr/bin/env python3
"""
property_api.py -- the single inventory entry point the app server imports.

property_search.py already knows how to reach the CRM three different ways and
how to score whatever comes back. This module keeps all of that and adds the
three things the desk app needs on top: free-text search, fetching one property
by id, and a presentation layer (the facts a salesperson would read out, and a
description compact enough to paste into an LLM prompt).

It also puts one more path in front of property_search's three: PROPERTY_API_BASE,
the standalone search API in infra/. That API exists because the CRM's own
semantic endpoint wants either the service key or an hour-lived Cognito token,
and a desktop app can hold neither for long. With it deployed the app gets live
vector results from an api key alone. With it not deployed, or down, everything
falls through to the CRM paths and finally to config/mock-properties.json, so
the app never stops working.

Nothing here raises. Every function reports failure as a string in an "error"
field, because the caller is an HTTP handler and an unhandled CRM outage would
otherwise become a 500 on a page the user still needs for the rest of its work.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from property_search import (  # noqa: E402
    bhk_number, crm_base_url, crm_mode, headline_amount, http_json,
    load_mock_inventory, match_properties, money, normalise_property,
    parse_amounts, rows_from, text as _text, to_number,
)

# Words that carry no signal in a free-text property query. Locality and
# society names are the whole point of the query, so nothing that could be a
# place name is listed here.
STOPWORDS = {
    "the", "and", "for", "with", "any", "near", "some", "show", "find", "need",
    "want", "looking", "look", "please", "give", "have", "has", "available",
    "property", "properties", "flat", "flats", "house", "budget", "around",
    "under", "about", "there", "that", "this", "from", "into", "want", "wanted",
}


def _clean(value):
    return _text(value)


# ------------------------------------------------------------ the new API --

def api_base(config):
    """The standalone search API root, or "" when it was never deployed."""
    base = _clean((config or {}).get("PROPERTY_API_BASE"))
    if not base:
        return ""
    if "://" not in base:
        base = "https://" + base
    return base.rstrip("/")


def _api_headers(config):
    headers = {}
    key = _clean((config or {}).get("PROPERTY_API_KEY"))
    if key:
        headers["x-api-key"] = key
    return headers


def _filters_from(requirement):
    """Turn a lead requirement into the filter block the search API takes."""
    req = requirement or {}
    filters = {}
    locality = _clean(req.get("locality"))
    if locality:
        filters["locality"] = locality
    number = bhk_number(req.get("property_type"))
    if number:
        filters["bhk"] = number
    deal = _clean(req.get("deal_type")).lower()
    if deal:
        filters["dealType"] = deal
    low, high = parse_amounts(req.get("budget"))
    if low:
        # Leads state a budget as a round number they are willing to move off,
        # so a hard band drops the listing they would actually have taken. The
        # same widening property_search uses on the CRM filter path.
        filters["minPrice"] = int(low * 0.7)
        filters["maxPrice"] = int(high * 1.3)
    return filters


def _query_from(requirement):
    """A sentence describing the requirement, for the embedding to work on."""
    req = requirement or {}
    parts = [
        _clean(req.get("property_type")),
        _clean(req.get("deal_type")).replace("_", " "),
    ]
    locality = _clean(req.get("locality"))
    if locality:
        parts += ["in", locality]
    city = _clean(req.get("city"))
    if city and city.lower() not in locality.lower():
        parts.append(city)
    parts.append(_clean(req.get("budget")))
    return " ".join(p for p in parts if p.strip()).strip()


# -------------------------------------------------------------- decorating --

def _decorate(prop, score, why):
    """Add the four fields every caller of this module relies on.

    Kept byte-identical in meaning to what property_search.match_properties
    writes, so a result coming back from the new API and a result scored locally
    render the same way in the app.
    """
    deal = _clean(prop.get("deal")).lower()
    if deal.startswith("heavy") and prop.get("deposit"):
        amount, kind = to_number(prop["deposit"]), "deposit"
    else:
        amount, kind = headline_amount(prop)
    prop["match_score"] = int(round(score))
    prop["matched_on"] = why or "inventory"
    # A vector hit can legitimately carry no price: the index does not project
    # the nested pricing attributes. Say so rather than showing a blank, so
    # nobody quotes a rent that was never returned.
    prop["pricing_known"] = bool(amount)
    prop["headline"] = (("%s %s" % (money(amount), kind)).strip()
                        if amount else "price not returned by search")
    return prop


def _remote_score(raw_score, position):
    """Map whatever the API scored a row with onto the local 0-100 scale."""
    try:
        value = float(raw_score)
    except (TypeError, ValueError):
        value = 0.0
    if value <= 0:
        # No score at all: preserve the order the API returned rather than
        # collapsing everything to one number and re-sorting arbitrarily.
        return max(1, 100 - position)
    return value * 100 if value <= 1 else value


# ------------------------------------------------------------ local search --

def _tokens(query_text):
    words = [w for w in re.split(r"[^a-z0-9]+", _clean(query_text).lower()) if w]
    return [w for w in words if len(w) > 2 and w not in STOPWORDS]


def _keyword_score(prop, tokens, requirement):
    """Score one listing against free text. Returns (score, reasons)."""
    haystack = " ".join([prop.get("locality", ""), prop.get("society", ""),
                         prop.get("title", ""), prop.get("city", ""),
                         prop.get("property_type", ""),
                         prop.get("furnishing", "")]).lower()
    score, why = 0, []
    hits = [t for t in tokens if t in haystack]
    if hits:
        score += 20 * len(hits)
        why.append(", ".join(sorted(set(hits))[:4]))
    number = bhk_number(" ".join(tokens)) or bhk_number(
        (requirement or {}).get("property_type"))
    if number and number in _clean(prop.get("config")).lower():
        score += 25
        why.append("configuration")
    lowered = " ".join(tokens)
    deal = _clean(prop.get("deal")).lower() or (
        "rent" if prop.get("rent") else "buy" if prop.get("price") else "")
    if deal:
        if ("rent" in lowered or "rental" in lowered) and "rent" in deal:
            score += 15
            why.append("deal type")
        elif ("buy" in lowered or "sale" in lowered or "purchase" in lowered) \
                and deal in ("buy", "sale", "sell"):
            score += 15
            why.append("deal type")
    low, high = parse_amounts(lowered)
    if low:
        amount, _ = headline_amount(prop)
        if amount and low * 0.85 <= amount <= high * 1.15:
            score += 30
            why.append("budget")
    return score, ", ".join(why)


def _freetext_search(config, query_text, requirement, limit):
    """Free text against whatever inventory property_search can reach.

    match_properties only understands a structured requirement and it drops
    anything outside the stated locality, which is wrong for a typed query where
    the locality may not be the point. So the rows are fetched through the same
    path and scored here instead.
    """
    from property_search import fetch_inventory

    rows, source, notes = fetch_inventory(config, requirement or {}, limit)
    tokens = _tokens(query_text)
    scored = []
    for raw in rows:
        prop = normalise_property(raw)
        if prop is None:
            continue
        if _clean(prop["status"]).lower() in ("sold", "rented", "inactive",
                                              "unavailable", "closed", "archived"):
            continue
        score, why = _keyword_score(prop, tokens, requirement)
        if score > 0:
            scored.append(_decorate(prop, score, why))
    scored.sort(key=lambda p: -p["match_score"])
    return scored[:limit], source, len(rows), list(notes)


def _mock_search(query_text, requirement, limit):
    """Last resort. Same scoring, but reading config/mock-properties.json."""
    rows = load_mock_inventory()
    tokens = _tokens(query_text) or _tokens(_query_from(requirement))
    scored = []
    for raw in rows:
        prop = normalise_property(raw)
        if prop is None:
            continue
        score, why = _keyword_score(prop, tokens, requirement)
        # With no usable query at all, show the inventory rather than nothing:
        # an empty demo list looks like a broken app.
        scored.append(_decorate(prop, score or 1, why or "mock inventory"))
    scored.sort(key=lambda p: -p["match_score"])
    return scored[:limit], "mock inventory (config/mock-properties.json)", len(rows)


# --------------------------------------------------------- sample guard --

SAMPLE_NOTE = ("no live inventory is connected, so nothing is shown rather than"
               " the sample listings in config/mock-properties.json")


def sample_allowed(config):
    """True only when someone deliberately asked to see the sample listings.

    Off by default. The sample file exists so the app runs with no credentials
    at all, but showing invented flats next to a real conversation is worse
    than showing nothing, so the desk suppresses them unless
    ALLOW_SAMPLE_INVENTORY is set in .env.
    """
    return _clean((config or {}).get("ALLOW_SAMPLE_INVENTORY")).lower() in (
        "1", "true", "yes", "on")


def is_sample_source(source):
    return "mock" in _clean(source).lower()


def _guard(config, result):
    """Blank out a result that came from the sample file."""
    if not is_sample_source(result.get("source")) or sample_allowed(config):
        result.setdefault("sample", False)
        return result
    notes = list(result.get("notes") or [])
    notes.append(SAMPLE_NOTE)
    return {"matches": [], "source": "no live inventory connected", "pool": 0,
            "notes": notes, "error": result.get("error", ""), "sample": True}


# ----------------------------------------------------------------- search --

def search(config, query_text="", requirement=None, limit=8):
    """Find listings for a typed query or a lead requirement.

    Tries the standalone API first, then whatever CRM path property_search can
    reach, and only falls to the mock when both of those fail outright. An empty
    result from a live CRM is left empty on purpose: "we have nothing in Byculla"
    is a true answer, and quietly showing mock flats instead would put invented
    inventory in front of a real lead.
    """
    config = config or {}
    requirement = requirement or {}
    query_text = _clean(query_text)
    limit = max(1, int(limit or 8))
    notes, error = [], ""

    base = api_base(config)
    if base:
        try:
            payload = http_json(
                base + "/properties/search",
                {"query": query_text or _query_from(requirement),
                 "limit": limit,
                 "filters": _filters_from(requirement)},
                headers=_api_headers(config), timeout=30)
            rows = rows_from(payload)
            source = _clean(payload.get("source") if isinstance(payload, dict)
                            else "") or "search api"
            pool = 0
            if isinstance(payload, dict):
                pool = int(to_number(payload.get("pool")) or 0)
            matches = []
            for position, raw in enumerate(rows):
                prop = normalise_property(raw)
                if prop is None:
                    continue
                why = _clean(raw.get("matchedOn") or raw.get("matched_on")) if \
                    isinstance(raw, dict) else ""
                if not why:
                    why = ("semantic match" if source == "vector"
                           else "keyword match")
                matches.append(_decorate(prop, _remote_score(prop.get("score"),
                                                             position), why))
            matches.sort(key=lambda p: -p["match_score"])
            return {"matches": matches[:limit],
                    "source": "%s search via %s" % (source, base),
                    "pool": pool or len(rows), "notes": notes, "error": "",
                    "sample": False}
        except (RuntimeError, ValueError, TypeError, KeyError) as err:
            notes.append("property search API at %s failed: %s" % (base, err))

    try:
        if query_text:
            matches, source, pool, more = _freetext_search(
                config, query_text, requirement, limit)
        else:
            matches, source, pool, more = match_properties(
                config, requirement, limit)
        notes.extend(more or [])
        return _guard(config, {"matches": matches, "source": source,
                               "pool": pool, "notes": notes, "error": ""})
    except Exception as err:                     # noqa: BLE001 - see docstring
        error = "inventory lookup failed: %s" % err
        notes.append(error)

    matches, source, pool = _mock_search(query_text, requirement, limit)
    return _guard(config, {"matches": matches, "source": source, "pool": pool,
                           "notes": notes, "error": error})


# ---------------------------------------------------------- one property --

def _crm_headers(config):
    """Whichever auth is configured, in the same order property_search picks."""
    headers = {}
    if _clean(config.get("CRM_AUTH_TOKEN")):
        headers["Authorization"] = "Bearer " + _clean(config["CRM_AUTH_TOKEN"])
    elif _clean(config.get("CRM_INTERNAL_API_KEY")):
        headers["x-api-key"] = _clean(config["CRM_INTERNAL_API_KEY"])
    elif _clean(config.get("CRM_PUBLIC_API_KEY")):
        headers["Authorization"] = "Bearer " + _clean(config["CRM_PUBLIC_API_KEY"])
    if _clean(config.get("CRM_TENANT_ID")):
        header = _clean(config.get("CRM_TENANT_HEADER")) or "x-tenant-id"
        headers[header] = _clean(config["CRM_TENANT_ID"])
    return headers


def _single_from(payload):
    """A property-by-id route may answer with the item or wrap it."""
    if isinstance(payload, list):
        return payload[0] if payload else None
    if not isinstance(payload, dict):
        return None
    for key in ("property", "item", "data", "record", "Item"):
        node = payload.get(key)
        if isinstance(node, dict):
            return node
    rows = rows_from(payload)
    if rows:
        return rows[0]
    return payload if payload else None


def _matches_id(prop, property_id):
    wanted = property_id.lower()
    return wanted in (_clean(prop.get("id")).lower(),
                      _clean(prop.get("slug")).lower())


def get_property(config, property_id):
    """Fetch one listing by id or slug. Never raises."""
    config = config or {}
    property_id = _clean(property_id)
    if not property_id:
        return {"property": None, "source": "", "error": "no property id given"}

    problems = []
    quoted = property_id.replace("/", "%2F")

    base = api_base(config)
    if base:
        try:
            payload = http_json(base + "/properties/" + quoted,
                                headers=_api_headers(config), timeout=20)
            prop = normalise_property(_single_from(payload))
            if prop and prop.get("id"):
                return {"property": _decorate(prop, 100, "exact id"),
                        "source": "search api via %s" % base, "error": ""}
        except (RuntimeError, ValueError, TypeError) as err:
            problems.append("search api: %s" % err)

    try:
        crm = crm_base_url(config)
    except ValueError as err:
        crm = ""
        problems.append("CRM base url: %s" % err)

    headers = _crm_headers(config)
    if crm and headers:
        try:
            payload = http_json(crm + "/api/crm/properties/" + quoted,
                                headers=headers, timeout=20)
            prop = normalise_property(_single_from(payload))
            if prop and prop.get("id"):
                return {"property": _decorate(prop, 100, "exact id"),
                        "source": "CRM via %s" % crm, "error": ""}
        except (RuntimeError, ValueError, TypeError) as err:
            problems.append("CRM by id: %s" % err)

        # The by-id route is authenticated per user; the public list is not, and
        # for a tenant-key deployment it is the only readable copy of the row.
        try:
            payload = http_json(
                crm + "/api/crm/properties/public/list?limit=200",
                headers=headers, timeout=25)
            for raw in rows_from(payload):
                prop = normalise_property(raw)
                if prop and _matches_id(prop, property_id):
                    return {"property": _decorate(prop, 100, "exact id"),
                            "source": "CRM public list via %s" % crm, "error": ""}
        except (RuntimeError, ValueError, TypeError) as err:
            problems.append("CRM public list: %s" % err)

    if sample_allowed(config):
        for raw in load_mock_inventory():
            prop = normalise_property(raw)
            if prop and _matches_id(prop, property_id):
                return {"property": _decorate(prop, 100, "exact id"),
                        "source": "sample inventory"
                                  " (config/mock-properties.json)",
                        "error": ""}
    elif any(_matches_id(normalise_property(raw) or {}, property_id)
             for raw in load_mock_inventory()):
        return {"property": None, "source": "", "sample": True,
                "error": "%s only exists in the sample file, and %s"
                         % (property_id, SAMPLE_NOTE)}

    return {"property": None,
            "source": "",
            "error": ("%s not found. %s" % (property_id, "; ".join(problems))
                      if problems else "%s not found in any inventory source"
                      % property_id)}


# ------------------------------------------------------------ presentation --

def _configuration(prop):
    """'2 BHK apartment' out of the CRM's separate bhk and propertyType fields."""
    config = _clean(prop.get("config"))
    kind = _clean(prop.get("property_type"))
    if config and re.fullmatch(r"\d+(\.\d+)?", config):
        config += " BHK"
    parts = [p for p in (config, kind) if p]
    if len(parts) == 2 and parts[1].lower() in parts[0].lower():
        parts = parts[:1]
    return " ".join(parts)


def _price_fact(prop):
    """The one money line for this listing, labelled by what it actually is."""
    if prop.get("rent"):
        return "Rent", money(prop["rent"]) + " per month"
    if prop.get("price"):
        return "Price", money(prop["price"])
    if prop.get("amount"):
        deal = _clean(prop.get("deal")).lower()
        return ("Rent" if "rent" in deal else "Price"), money(prop["amount"])
    return "", ""


def property_facts(prop):
    """The facts a salesperson would quote, in the order they would say them.

    Blanks are dropped rather than shown empty: a row of "-" reads like the data
    exists and is zero, and someone will repeat it to a lead.
    """
    if not isinstance(prop, dict):
        return []
    facts = []

    def add(label, value):
        value = _clean(value)
        if value:
            facts.append({"label": label, "value": value})

    add("Configuration", _configuration(prop))
    add("Society", prop.get("society"))
    add("Locality", prop.get("locality"))
    add("City", prop.get("city"))
    label, value = _price_fact(prop)
    if label:
        add(label, value)
    if prop.get("deposit"):
        add("Deposit", money(prop["deposit"]))
    carpet = _clean(prop.get("carpet_area"))
    if carpet:
        # Stored as a bare number of square feet everywhere it has been seen.
        add("Carpet area", carpet + " sq ft"
            if re.fullmatch(r"\d+(\.\d+)?", carpet) else carpet)
    add("Furnishing", prop.get("furnishing"))
    add("Status", prop.get("status"))
    add("Available from", prop.get("available_from"))
    add("Property id", prop.get("id"))
    return facts


def describe_for_prompt(prop):
    """One plain-text paragraph about the listing, for an LLM prompt.

    Only ever states what is in the record. If the search path did not return a
    price this says so, because a model handed a silent gap will fill it.
    """
    if not isinstance(prop, dict):
        return ""
    config = _configuration(prop) or "Property"
    where = ", ".join(p for p in (_clean(prop.get("society")),
                                  _clean(prop.get("locality")),
                                  _clean(prop.get("city"))) if p)
    sentence = config + (" in " + where if where else "")

    money_bits = []
    label, value = _price_fact(prop)
    if label:
        money_bits.append(label.lower() + " " + value)
    if prop.get("deposit"):
        money_bits.append("deposit " + money(prop["deposit"]))
    if money_bits:
        sentence += ", " + " and ".join(money_bits)
    elif prop.get("pricing_known") is False:
        sentence += ", price not returned by the search"
    sentence += "."

    extras = []
    carpet = _clean(prop.get("carpet_area"))
    if carpet:
        extras.append("Carpet area " + (carpet + " sq ft" if re.fullmatch(
            r"\d+(\.\d+)?", carpet) else carpet) + ".")
    if _clean(prop.get("furnishing")):
        extras.append(_clean(prop["furnishing"]).capitalize() + ".")
    if _clean(prop.get("status")):
        extras.append("Status " + _clean(prop["status"]) + ".")
    if _clean(prop.get("available_from")):
        extras.append("Available from " + _clean(prop["available_from"]) + ".")
    if _clean(prop.get("id")):
        extras.append("Listing id " + _clean(prop["id"]) + ".")
    return " ".join([sentence] + extras)


# ----------------------------------------------------------------- health --

def health(config):
    """What the app can actually reach right now, for the status strip."""
    config = config or {}
    notes, error = [], ""
    base = api_base(config)

    if base:
        if not _clean(config.get("PROPERTY_API_KEY")):
            notes.append("PROPERTY_API_BASE is set but PROPERTY_API_KEY is not; "
                         "the API will answer 401.")
        try:
            payload = http_json(base + "/health", headers=_api_headers(config),
                                timeout=15)
            pool = int(to_number((payload or {}).get("pool")) or 0)
            table = _clean((payload or {}).get("table"))
            if table:
                notes.append("table " + table)
            index = _clean((payload or {}).get("vectorIndex"))
            notes.append("vector index " + index if index
                         else "no vector index configured, keyword scoring only")
            return {"mode": "property-api", "base": base, "public_api": True,
                    "ok": bool((payload or {}).get("ok", True)),
                    "inventory_size": pool, "notes": notes, "error": ""}
        except (RuntimeError, ValueError, TypeError) as err:
            error = "property search API unreachable: %s" % err
            notes.append(error + " Falling back to the CRM paths.")

    try:
        mode, crm = crm_mode(config)
    except ValueError as err:
        return {"mode": "misconfigured", "base": "", "public_api": False,
                "ok": False, "inventory_size": 0, "notes": notes,
                "error": error or str(err)}

    try:
        # Scoring an empty requirement matches nothing by design, but it still
        # walks the real path and reports how many rows that path can see.
        _, source, pool, more = match_properties(config, {}, 1)
        notes.append(source)
        notes.extend(more or [])
        if is_sample_source(source) and not sample_allowed(config):
            notes.append(SAMPLE_NOTE)
            return {"mode": "not connected", "base": "", "public_api": False,
                    "ok": False, "inventory_size": 0, "notes": notes,
                    "sample": True, "error": error}
        return {"mode": mode, "base": crm, "public_api": False,
                "ok": True, "inventory_size": pool, "notes": notes,
                "sample": is_sample_source(source), "error": error}
    except Exception as err:                     # noqa: BLE001
        notes.append("inventory probe failed: %s" % err)
        return {"mode": mode, "base": crm, "public_api": False, "ok": False,
                "inventory_size": 0, "notes": notes, "sample": False,
                "error": error or str(err)}


if __name__ == "__main__":
    import json

    result = search({}, query_text=" ".join(sys.argv[1:]) or "1 bhk in Byculla")
    print(json.dumps(result, indent=2, default=str))
