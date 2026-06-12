const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = dir + '/' + f;
    if (fs.statSync(p).isDirectory() && !f.startsWith('node_modules')) walk(p);
    else if (f.endsWith('.js')) files.push(p);
  }
}
walk('.');
const imports = new Set();
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/from\s+['"]([^'"./][^'"]*)['"]/g);
  if (matches) {
    for (const m of matches) {
      const mod = m.replace(/from\s+['"]/, '').replace(/['"]$/, '');
      const base = mod.startsWith('@') ? mod.split('/').slice(0,2).join('/') : mod.split('/')[0];
      imports.add(base);
    }
  }
}
for (const imp of [...imports].sort()) {
  if (!deps.has(imp)) console.log('MISSING:', imp);
}
