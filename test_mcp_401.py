import os
import urllib.request
import json

MCP_BASE_URL = 'https://' + os.environ.get('MCP_API_DOMAIN_NAME', 'services-api.cloudberrysolutions.in') + '/' + os.environ.get('MCP_API_BASE_PATH', 'devrealestatemcp')

body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}).encode()
req = urllib.request.Request(
    MCP_BASE_URL + '/mcp',
    data=body,
    headers={'Content-Type': 'application/json'},
    method='POST'
)
try:
    r = urllib.request.urlopen(req)
    print('Status:', r.status)
    print('Headers:', dict(r.headers))
except urllib.error.HTTPError as e:
    print('Status:', e.code)
    print('Headers:', dict(e.headers))
    print('Body:', e.read().decode())
