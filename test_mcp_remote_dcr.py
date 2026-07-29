import urllib.request
import json

body = json.dumps({
    "redirect_uris": ["http://localhost:9547/oauth/callback"],
    "token_endpoint_auth_method": "none",
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "client_name": "Claude",
    "client_uri": "https://claude.ai",
    "software_id": "claude-desktop-mcp-remote",
    "software_version": "1.0.0",
    "scope": "read_leads write_leads read_properties write_properties read_owners write_owners read_tenants write_tenants read_buyers write_buyers read_meetings write_meetings"
}).encode()

req = urllib.request.Request(
    'https://i1un5y6xjl.execute-api.ap-south-1.amazonaws.com/dev/oauth/register',
    data=body,
    headers={'Content-Type': 'application/json'},
    method='POST'
)

try:
    r = urllib.request.urlopen(req)
    print('SUCCESS', r.status)
    print(r.read().decode())
except urllib.error.HTTPError as e:
    print('ERROR', e.code)
    print(dict(e.headers))
    print(e.read().decode())
