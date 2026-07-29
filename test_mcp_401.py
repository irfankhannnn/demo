import urllib.request
import json

body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}).encode()
req = urllib.request.Request(
    'https://i1un5y6xjl.execute-api.ap-south-1.amazonaws.com/dev/mcp',
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
