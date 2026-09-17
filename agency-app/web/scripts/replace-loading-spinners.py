import re, os
from pathlib import Path

SRC = Path(r'd:\reality_flow_crm\nabi-app-git-bkp\real-estate-crm-app\src')

# Pattern: inner text-center block with circles + message
pat = re.compile(
    r'<div className="text-center">\s*'
    r'<div className="relative w-16 h-16 mx-auto">\s*'
    r'<div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>\s*'
    r'<div className="absolute inset-0 rounded-full border-4 border-[\w-]+ border-t-transparent animate-spin"></div>\s*'
    r'</div>\s*'
    r'<p className="mt-4 text-gray-600 animate-pulse font-medium">([^<]+)</p>\s*'
    r'</div>',
    re.MULTILINE | re.DOTALL
)

def impath(p):
    d = len(p.relative_to(SRC).parts) - 1
    return '../' * d + 'components/LoadingSpinner'

for f in SRC.rglob('*.tsx'):
    txt = f.read_text('utf-8')
    if not pat.search(txt): continue
    msg = pat.search(txt).group(1).strip()
    txt = pat.sub(f'<LoadingSpinner message="{msg}" />', txt)
    il = f"import LoadingSpinner from '{impath(f)}';\n"
    if 'LoadingSpinner' not in txt:
        lines = txt.split('\n'); li = max((i for i,l in enumerate(lines) if l.startswith('import ')), default=-1)
        lines.insert(li+1, il.rstrip()); txt = '\n'.join(lines)
    f.write_text(txt, 'utf-8')
    print(f"Updated: {f.relative_to(SRC)}")

print("Done")
