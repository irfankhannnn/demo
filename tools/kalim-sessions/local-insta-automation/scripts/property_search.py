#!/usr/bin/env python3
"""
property_search.py -- inventory lookup for the Instagram Lead Desk runner.

Talks to whichever CRM path is configured and falls back cleanly:

  internal  POST {base}/api/internal/properties/match
            Bedrock Titan embeddings + DynamoDB vector search.
            Headers: x-api-key, x-tenant-id
  crm       GET  {base}/api/crm/properties?area=&bhk=&minRent=&...
            Exact filters. Header: Authorization: Bearer <jwt>
  public    GET  {base}/api/crm/properties/public/list
            Header: Authorization: Bearer <opaque api key>
  mock      config/mock-properties.json

Whatever answers, results are re-scored locally so the ranking and the shape
are the same on every path.
"""

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MOCK_PROPERTIES = os.path.join(ROOT, "config", "mock-properties.json")


def text(value):
    return "" if value is None else str(value).strip()


def http_json(url, payload=None, headers=None, method=None, timeout=60):
    """One place for every outbound call, so failures read the same way."""
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
        detail = err.read().decode("utf-8", "replace")[:500]
        raise RuntimeError("HTTP %s from %s: %s"
                           % (err.code, urllib.parse.urlsplit(url).netloc, detail))
    except urllib.error.URLError as err:
        raise RuntimeError("could not reach %s: %s"
                           % (urllib.parse.urlsplit(url).netloc, err.reason))
    except ValueError:
        raise RuntimeError("%s did not return JSON"
                           % urllib.parse.urlsplit(url).netloc)


# ------------------------------------------------------------------ money --

# No leading \b on the lakh and crore patterns: leads write "25-30lakh" with no
# space, and a word boundary between "0" and "l" does not exist.
UNIT_MULTIPLIER = [
    (r"crore|\bcr\b", 10000000),
    (r"lakh|lakhs|lac\b|lacs\b", 100000),
    (r"\bk\b|\dk\b|thousand", 1000),
]


def parse_amounts(value):
    """Pull a (low, high) rupee range out of free text like '40k to 42k'.

    Budgets are stored the way the lead said them, so this has to cope with
    '5 to 10 lakh deposit', '60 lac', '45 - 47 lakh' and a bare '15k'.
    """
    if not value:
        return None, None
    lower = str(value).lower().replace(",", "")
    multiplier = 1000                          # a bare number in a rent chat
    for pattern, scale in UNIT_MULTIPLIER:
        if re.search(pattern, lower):
            multiplier = scale
            break
    numbers = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", lower) if float(n) > 0]
    if not numbers:
        return None, None
    scaled = [n if n >= 100000 else n * multiplier for n in numbers]
    return min(scaled), max(scaled)


def to_number(value):
    try:
        return float(re.sub(r"[^\d.]", "", str(value)) or 0)
    except ValueError:
        return 0.0


# ------------------------------------------------------------ normalising --

def dig(raw, *paths):
    """Read the first present value from a list of dotted, case-insensitive paths."""
    for path in paths:
        node = raw
        for part in path.split("."):
            if isinstance(node, dict):
                key = next((k for k in node if k.lower() == part.lower()), None)
                node = node[key] if key is not None else None
            else:
                node = None
                break
        if node not in (None, "", [], {}):
            return node
    return ""


def normalise_property(raw):
    """Fold the three CRM response shapes into one.

    The authenticated list returns a flat record with nested rentalInfo and
    saleInfo, the public list returns a pricing object, and the internal match
    endpoint returns its own voice-agent shape. All three land here.
    """
    if not isinstance(raw, dict):
        return None
    deal = text(dig(raw, "pricing.mode", "dealType", "deal_type", "listingType",
                    "transactionType", "purpose")).lower()
    status = text(dig(raw, "status", "availability", "availabilityStatus"))
    if not deal and status:
        lowered = status.lower()
        if "rent" in lowered:
            deal = "rent"
        elif "sale" in lowered or "sold" in lowered:
            deal = "buy"
    return {
        "id": text(dig(raw, "propertyId", "property_id", "id", "_id")),
        "title": text(dig(raw, "title", "name", "propertyName", "displayName")),
        "locality": text(dig(raw, "locality", "area", "sublocality", "location",
                             "address")),
        "city": text(dig(raw, "city")),
        "society": text(dig(raw, "buildingName", "building", "society",
                            "projectName", "project")),
        "config": text(dig(raw, "bhk", "configuration", "bedrooms", "unitType")),
        "property_type": text(dig(raw, "propertyType", "property_type", "type")),
        "furnishing": text(dig(raw, "furnishing")),
        "deal": deal,
        "rent": dig(raw, "rentalInfo.expectedRent", "rentAmount", "rent",
                    "monthlyRent", "expectedRent"),
        "price": dig(raw, "saleInfo.expectedPrice", "expectedPrice", "salePrice",
                     "price"),
        "amount": dig(raw, "pricing.amount"),
        "deposit": dig(raw, "rentalInfo.securityDeposit", "pricing.deposit",
                       "securityDeposit", "deposit"),
        "carpet_area": text(dig(raw, "carpetArea", "builtUpArea", "squareFeet")),
        "status": status,
        "slug": text(dig(raw, "slug")),
        "available_from": text(dig(raw, "availableFrom", "possessionDate")),
        # The semantic index returns "_score", the REST shapes do not score.
        "score": dig(raw, "_score", "score"),
    }


def headline_amount(prop):
    """The number a salesperson would quote for this listing."""
    for key in ("rent", "price", "amount", "deposit"):
        if prop.get(key):
            return to_number(prop[key]), key
    return 0.0, ""


def money(value):
    number = to_number(value)
    if not number:
        return ""
    if number >= 10000000:
        return "%.2f cr" % (number / 10000000)
    if number >= 100000:
        return "%.2f lakh" % (number / 100000)
    if number >= 1000:
        return "%dk" % round(number / 1000)
    return str(int(number))


# ------------------------------------------------------------------ paths --

def load_mock_inventory():
    if not os.path.isfile(MOCK_PROPERTIES):
        return []
    with open(MOCK_PROPERTIES, encoding="utf-8") as fh:
        return json.load(fh).get("properties", [])


def build_service_base_url(domain_name, base_path, domain_var="domainName"):
    """https://<domain>/<base path> for an API Gateway custom domain mapping.

    A scheme is allowed only for local development (http://localhost:4000).
    Raw execute-api invoke URLs are refused: every API is reached through
    services-api.cloudberrysolutions.in / services-api.realestateflow.in.
    """
    domain = text(domain_name)
    if not domain:
        raise ValueError(domain_var + " is not set")
    origin = (domain if "://" in domain else "https://" + domain).rstrip("/")
    if re.search(r"execute-api\.|\.amazonaws\.com", origin, re.IGNORECASE):
        raise ValueError(domain_var + ": raw API Gateway URLs are not allowed; use the custom domain")
    path = text(base_path).strip("/")
    return origin + "/" + path if path else origin


def crm_base_url(config):
    """CRM API root from CRM_API_DOMAIN_NAME + CRM_API_BASE_PATH, or "" if unset."""
    if not text(config.get("CRM_API_DOMAIN_NAME")):
        return ""
    return build_service_base_url(config.get("CRM_API_DOMAIN_NAME"),
                                  config.get("CRM_API_BASE_PATH"),
                                  "CRM_API_DOMAIN_NAME")


def crm_mode(config):
    """Which backend path is actually configured, in preference order."""
    base = crm_base_url(config)
    if text(config.get("USE_MOCK_PROPERTIES")).lower() in ("1", "true", "yes"):
        return "mock", base
    if not base:
        return "mock", ""
    if config.get("CRM_INTERNAL_API_KEY") and config.get("CRM_TENANT_ID"):
        return "internal", base
    if config.get("CRM_AUTH_TOKEN"):
        return "crm", base
    if config.get("CRM_PUBLIC_API_KEY"):
        return "public", base
    return "mock", base


def rows_from(payload):
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for key in ("properties", "matches", "items", "data", "results", "records",
                "Items"):
        if isinstance(payload.get(key), list):
            return payload[key]
    return []


def bhk_number(value):
    match = re.search(r"(\d+(?:\.\d+)?)", text(value))
    return match.group(1) if match else None


def search_semantic(config, base, requirement, limit):
    """Bedrock Titan embeddings + DynamoDB vector search on the CRM.

    An empty result here does not prove there is no match. Two verified causes,
    both of which return an empty list rather than an error:

    1. The DynamoDB vector index was never created for that environment. The
       backend catches the failure and returns nothing.
    2. The route hardcodes `status: 'available'` in its post-filter, but a
       listed property carries `for-rent` or `for-sale`. Confirmed live on
       nonprod on 2026-09-12: the same query returns 1 result with no status
       filter and 0 with `available`. Until that is fixed, this endpoint
       returns nothing for any property actually on the market.

    That is why the caller falls through to the filter search before declaring
    nothing available.
    """
    query = " ".join(part for part in [
        text(requirement.get("property_type")),
        text(requirement.get("deal_type")).replace("_", " "),
        "in", text(requirement.get("locality")),
        text(requirement.get("budget"))] if part.strip()).strip()
    body = {"query": query or "residential property", "limit": max(limit * 3, 10)}
    number = bhk_number(requirement.get("property_type"))
    if number:
        body["minBedrooms"] = int(float(number))
        body["maxBedrooms"] = int(float(number)) + 1

    # Deliberately no minPrice/maxPrice. Verified live on nonprod: the vector
    # index projects "rentAmount" and "price", but createProperty writes pricing
    # nested as rentalInfo.expectedRent and saleInfo.expectedPrice, so no price
    # attribute is ever projected. The backend's post-filter then reads null for
    # every row and a price range silently rejects all of them. Budget is
    # applied locally instead, where the value is actually available.
    headers = {
        "x-api-key": config["CRM_INTERNAL_API_KEY"],
        "x-tenant-id": config["CRM_TENANT_ID"],
    }
    payload = http_json(base + "/api/internal/properties/match", body,
                        headers=headers, timeout=45)
    return rows_from(payload)


def search_internal_listing(config, base, requirement, limit):
    """The internal listing route, on the same key and tenant as the semantic one.

    This is the path that actually returns something. The semantic route is
    empty for any environment whose vector index was never built, and the
    filter route wants a user JWT no desktop app can hold, which used to leave
    an internal-key setup with nothing behind the embeddings. This route takes
    the same x-api-key and x-tenant-id, so there is no new credential to hold.

    Its filters are the agent tool's vocabulary: `location` ORs across area,
    building name, address and city, which is the closest thing to how a lead
    names a place. Budget is deliberately not sent -- the route applies a
    generic range against whichever of rent or sale price the listing carries,
    and a listing with the amount nested where it cannot read it is then
    dropped. Scoring locally keeps it.
    """
    params = {"limit": str(min(max(limit * 5, 10), 50))}
    if requirement.get("locality"):
        params["location"] = text(requirement["locality"])
    number = bhk_number(requirement.get("property_type"))
    if number:
        params["bhk"] = number
    headers = {
        "x-api-key": config["CRM_INTERNAL_API_KEY"],
        "x-tenant-id": config["CRM_TENANT_ID"],
    }
    url = base + "/api/internal/properties/available?" + urllib.parse.urlencode(params)
    return rows_from(http_json(url, headers=headers, timeout=30))


def search_filtered(config, base, mode, requirement, limit):
    """Exact-filter listing call, parameter names taken from the live route."""
    params = {"limit": str(max(limit * 20, 100))}
    if requirement.get("locality"):
        params["area"] = text(requirement["locality"])
    number = bhk_number(requirement.get("property_type"))
    if number:
        params["bhk"] = number
    deal = text(requirement.get("deal_type")).lower()
    low, high = parse_amounts(requirement.get("budget"))
    if low and deal in ("rent", "heavy_deposit"):
        params["minRent"] = str(int(low * 0.7))
        params["maxRent"] = str(int(high * 1.3))
    elif low and deal == "buy":
        params["minSalePrice"] = str(int(low * 0.7))
        params["maxSalePrice"] = str(int(high * 1.3))
    if deal == "buy":
        params["status"] = "for-sale"
    elif deal in ("rent", "heavy_deposit"):
        params["status"] = "for-rent"

    if mode == "public":
        path = "/api/crm/properties/public/list"
        headers = {"Authorization": "Bearer " + config["CRM_PUBLIC_API_KEY"]}
    else:
        path = text(config.get("CRM_PROPERTY_SEARCH_PATH")) or "/api/crm/properties"
        headers = {"Authorization": "Bearer " + text(config.get("CRM_AUTH_TOKEN"))}
    if config.get("CRM_TENANT_ID"):
        headers[text(config.get("CRM_TENANT_HEADER")) or "x-tenant-id"] = \
            config["CRM_TENANT_ID"]
    url = base + path + "?" + urllib.parse.urlencode(params)
    return rows_from(http_json(url, headers=headers, timeout=30))


def fetch_inventory(config, requirement, limit=5):
    """Return (rows, source label, notes). Never raises, degrades to the mock."""
    mode, base = crm_mode(config)
    notes = []
    if mode == "mock":
        return (load_mock_inventory(),
                "mock inventory (config/mock-properties.json)", notes)

    if mode == "internal":
        try:
            rows = search_semantic(config, base, requirement, limit)
            if rows:
                return rows, "embeddings search via %s" % base, notes
            notes.append("semantic search returned nothing. That can also mean the "
                         "DynamoDB vector index was never built for this "
                         "environment, so falling back to filter search.")
        except RuntimeError as err:
            notes.append("semantic search failed: %s" % err)

        try:
            rows = search_internal_listing(config, base, requirement, limit)
            if rows:
                return rows, "internal listing via %s" % base, notes
            notes.append("the internal listing route answered with nothing for "
                         "this tenant.")
        except RuntimeError as err:
            notes.append("internal listing failed: %s" % err)

    if config.get("CRM_AUTH_TOKEN") or config.get("CRM_PUBLIC_API_KEY"):
        try:
            rows = search_filtered(config, base, mode, requirement, limit)
            return rows, "filter search via %s" % base, notes
        except RuntimeError as err:
            notes.append("filter search failed: %s" % err)

    notes.append("using the mock inventory instead.")
    return load_mock_inventory(), "mock inventory (fallback)", notes


def match_properties(config, requirement, limit=5):
    """Score whatever inventory came back against the lead's requirement.

    Re-scoring locally on top of the backend's own filtering is deliberate. The
    three endpoints take different parameter names and the semantic one ranks by
    embedding distance, so this single local pass is what makes the result the
    same shape and the same order no matter which path answered.
    """
    raw_rows, source, notes = fetch_inventory(config, requirement, limit)
    wanted_locality = text(requirement.get("locality")).lower()
    wanted_deal = text(requirement.get("deal_type")).lower()
    low, high = parse_amounts(requirement.get("budget"))
    config_number = bhk_number(requirement.get("property_type"))

    # "Kurla West" must not match "Bhandup West". Split the place name from its
    # direction qualifier: the place name has to match, the direction only
    # decides ranking between two properties in the same place.
    all_words = [w for w in re.split(r"[^a-z]+", wanted_locality) if len(w) > 2]
    qualifiers = {"west", "east", "north", "south", "central"}
    core_words = [w for w in all_words if w not in qualifiers and len(w) > 3]
    qualifier_words = [w for w in all_words if w in qualifiers]

    scored = []
    for raw in raw_rows:
        prop = normalise_property(raw)
        if prop is None:
            continue
        if text(prop["status"]).lower() in ("sold", "rented", "inactive",
                                            "unavailable", "closed", "archived"):
            continue

        haystack = " ".join([prop["locality"], prop["society"], prop["title"],
                             prop["city"]]).lower()
        score, why = 0, []

        if core_words:
            if not any(word in haystack for word in core_words):
                continue                        # wrong area is not a near miss
            score += 50
            listing_qualifier = any(q in haystack for q in qualifiers)
            if qualifier_words and any(q in haystack for q in qualifier_words):
                score += 8
                why.append("locality")
            elif qualifier_words and listing_qualifier:
                why.append("locality, different side")
            else:
                why.append("locality")
        if config_number and config_number in prop["config"].lower():
            score += 25
            why.append("configuration")
        if wanted_deal:
            # What the listing itself says it is. A row with no deal and no
            # amount says nothing: the semantic index projects neither, so
            # reading that silence as "for sale" dropped every listing the
            # embeddings path returned from every rent requirement. Confirmed
            # live on dev 2026-09-20 with the one Kurla West flat, which the
            # inventory tab could see and the pipeline row could not.
            stated = prop["deal"] or (
                "rent" if prop["rent"] else
                ("buy" if prop["price"] or prop["amount"] else ""))
            if wanted_deal.startswith("heavy"):
                if prop["deposit"]:
                    score += 10
                    why.append("deposit deal")
            elif not stated:
                why.append("deal not stated")
            elif wanted_deal in stated or stated in wanted_deal:
                score += 15
                why.append("deal type")
            else:
                continue
        if low:
            # On a heavy-deposit requirement the budget IS the deposit, so
            # comparing it against the monthly rent would rank backwards.
            if wanted_deal.startswith("heavy") and prop.get("deposit"):
                amount = to_number(prop["deposit"])
            else:
                amount, _ = headline_amount(prop)
            if amount:
                if low * 0.85 <= amount <= high * 1.15:
                    score += 30
                    why.append("budget")
                elif amount > high * 1.15:
                    score -= 20
                    why.append("over budget")
        if score > 0:
            if wanted_deal.startswith("heavy") and prop.get("deposit"):
                amount, kind = to_number(prop["deposit"]), "deposit"
            else:
                amount, kind = headline_amount(prop)
            prop["match_score"] = score
            prop["matched_on"] = ", ".join(why) or "locality"
            # The semantic index does not project pricing, so a hit found that
            # way can legitimately have no amount. Say so rather than showing a
            # blank, so nobody quotes a rent that was never returned.
            prop["pricing_known"] = bool(amount)
            prop["headline"] = (("%s %s" % (money(amount), kind)).strip()
                                if amount else "price not returned by search")
            scored.append(prop)

    scored.sort(key=lambda p: -p["match_score"])
    return scored[:limit], source, len(raw_rows), notes
