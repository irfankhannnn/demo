import urllib.request
import urllib.parse
import urllib.error
import json
import base64
import hashlib
import secrets
import time

BASE_URL = "https://i1un5y6xjl.execute-api.ap-south-1.amazonaws.com/dev"
REDIRECT_URI = "http://localhost:9547/oauth/callback"

def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def json_post(url, data, extra_headers=None):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream", **(extra_headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

def form_post(url, data, follow_redirect=True):
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"})
    if not follow_redirect:
        # Disable redirect handling by using a custom opener
        opener = urllib.request.build_opener(NoRedirectHandler())
        try:
            with opener.open(req) as r:
                return r.status, r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def http_error_302(self, req, fp, code, msg, headers):
        raise urllib.error.HTTPError(req.get_full_url(), code, msg, headers, fp)
    http_error_301 = http_error_303 = http_error_307 = http_error_302

def get_url(url, headers=None):
    req = urllib.request.Request(url, method="GET", headers=headers or {})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

def main():
    # 1. DCR registration
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = b64url_encode(hashlib.sha256(code_verifier.encode("ascii")).digest())
    state = secrets.token_urlsafe(16)

    dcr_payload = {
        "redirect_uris": [REDIRECT_URI],
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "client_name": "Test OAuth Flow",
        "client_uri": "https://example.com",
        "scope": "read_leads write_leads",
    }

    status, body = json_post(f"{BASE_URL}/oauth/register", dcr_payload)
    print("DCR register:", status, body)
    if status != 201:
        return
    client_info = json.loads(body)
    client_id = client_info["client_id"]

    # 2. Authorize (test mode auto-authenticates)
    auth_params = {
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "state": state,
        "action": "allow",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    status, body = form_post(f"{BASE_URL}/oauth/authorize", auth_params, follow_redirect=False)
    print("Authorize:", status, body)
    if status != 302:
        return
    # Extract code from redirect Location header
    # body is the response from urllib; we need the headers. Parse the HTTPError headers.
    print("Authorize response headers:", body)
    # Actually we can't easily get headers from form_post. Let's redo with a raw handler.
    req = urllib.request.Request(f"{BASE_URL}/oauth/authorize", data=urllib.parse.urlencode(auth_params).encode(), method="POST", headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "text/html"})
    opener = urllib.request.build_opener(NoRedirectHandler())
    try:
        with opener.open(req) as r:
            final_url = r.geturl()
            print("Redirect URL (should not happen):", final_url)
    except urllib.error.HTTPError as e:
        final_url = e.headers.get("Location")
        print("Redirect URL:", final_url)
    
    parsed = urllib.parse.urlparse(final_url)
    code = urllib.parse.parse_qs(parsed.query)["code"][0]
    print("Got code:", code)

    # 3. Token exchange
    token_payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": code_verifier,
    }
    status, body = form_post(f"{BASE_URL}/oauth/token", token_payload)
    print("Token:", status, body)
    if status == 200:
        token_info = json.loads(body)
        access_token = token_info["access_token"]
        # 4. Call /mcp with token
        mcp_payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
        }
        status, body = json_post(f"{BASE_URL}/mcp", mcp_payload, {"Authorization": f"Bearer {access_token}"})
        print("MCP tools/list:", status, body)

if __name__ == "__main__":
    main()
