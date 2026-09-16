import os
import urllib.request
import json

MCP_BASE_URL = 'https://' + os.environ.get('MCP_API_DOMAIN_NAME', 'services-api.cloudberrysolutions.in') + '/' + os.environ.get('MCP_API_BASE_PATH', 'devrealestatemcp')

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
    MCP_BASE_URL + '/mcp',
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
