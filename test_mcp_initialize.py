import urllib.request
import json

body = json.dumps({
    'jsonrpc': '2.0',
    'id': 0,
    'method': 'initialize',
    'params': {
        'protocolVersion': '2025-03-26',
        'capabilities': {
            'roots': {'listChanged': True},
            'sampling': {}
        },
        'clientInfo': {'name': 'claude-mcp-remote', 'version': '1.0.0'}
    }
}).encode()

req = urllib.request.Request(
    'https://i1un5y6xjl.execute-api.ap-south-1.amazonaws.com/dev/mcp',
    data=body,
    headers={
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Accept-Encoding': 'br, gzip, deflate',
        'Accept-Language': '*',
        'Sec-Fetch-Mode': 'cors',
        'User-Agent': 'node'
    },
    method='POST'
)

try:
    r = urllib.request.urlopen(req)
    print('Status:', r.status)
    print('Headers:', dict(r.headers))
    print('Body:', r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print('Status:', e.code)
    print('Headers:', dict(e.headers))
    print('Body:', e.read().decode())
