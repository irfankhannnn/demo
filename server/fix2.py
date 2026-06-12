with open('middleware/validateToken.js', 'r') as f:
    content = f.read()

old = 'Authorization: `Bearer ${token}`\n        ...(requestId'
new = 'Authorization: `Bearer ${token}`,\n        ...(requestId'

print('Found:', old in content)
if old in content:
    content = content.replace(old, new)
    with open('middleware/validateToken.js', 'w') as f:
        f.write(content)
    print('Fixed!')
else:
    idx = content.find('Authorization:')
    print('Around Auth:', repr(content[idx:idx+70]))
