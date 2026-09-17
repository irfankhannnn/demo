#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolved from this file (tools/scripts/), so it works from any cwd.
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER_DIR = path.join(PROJECT_ROOT, 'agency-app', 'api');
const ROUTES_DIR = path.join(SERVER_DIR, 'routes');
const YAML_PATH = path.join(SERVER_DIR, 'infra', 'apigw-explicit-routes.yaml');

// ---------- Parse Express routes from server.js + routes/*.js ----------

const serverJs = fs.readFileSync(path.join(SERVER_DIR, 'server.js'), 'utf8');

// import X from './routes/y.js'
const importRe = /import\s+(\w+)\s+from\s+['"]\.\/routes\/(\w+)\.js['"];?/g;
const importMap = {}; // variableName -> routeFileName
let m;
while ((m = importRe.exec(serverJs)) !== null) {
  importMap[m[1]] = m[2];
}

// app.use('/path', variableName)
const useRe = /app\.use\(['"]([^'"]+)['"],\s*(\w+)\)/g;
const mounts = []; // { basePath, varName }
while ((m = useRe.exec(serverJs)) !== null) {
  mounts.push({ basePath: m[1], varName: m[2] });
}

// app.use('/path', middleware, variableName) — e.g. webhooks
const useMiddlewareRe = /app\.use\(['"]([^'"]+)['"],\s*[^,]+,\s*(\w+)\)/g;
while ((m = useMiddlewareRe.exec(serverJs)) !== null) {
  mounts.push({ basePath: m[1], varName: m[2] });
}

// app.get/post/...('/path', ...) mounted directly
const directAppRe = /app\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g;
const directRoutes = new Set();
while ((m = directAppRe.exec(serverJs)) !== null) {
  directRoutes.add(`${m[1].toUpperCase()} ${m[2]}`);
}

// Build full paths for each route file
const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));
const fileRoutes = {}; // filename -> Set of "METHOD /path"
for (const file of routeFiles) {
  const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
  const re = /router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g;
  const set = new Set();
  while ((m = re.exec(content)) !== null) {
    set.add(`${m[1].toUpperCase()} ${m[2]}`);
  }
  fileRoutes[file.replace('.js', '')] = set;
}

// Combine mounts
const expressPaths = new Set(directRoutes);
for (const mount of mounts) {
  const fileName = importMap[mount.varName];
  if (!fileName) continue;
  const routes = fileRoutes[fileName] || new Set();
  for (const r of routes) {
    const [method, routePath] = r.split(' ');
    const base = mount.basePath.endsWith('/') && routePath !== '/' ? mount.basePath.slice(0, -1) : mount.basePath;
    const full = routePath === '/' ? base : `${base}${routePath}`;
    expressPaths.add(`${method} ${full}`);
  }
}

// ---------- Parse API Gateway YAML line by line ----------

const yamlLines = fs.readFileSync(YAML_PATH, 'utf8').split(/\r?\n/);
const resourceDefs = {}; // name -> { parent, pathPart }
const methodDefs = []; // { method, resourceName }

let currentName = null;
let currentType = null;
let currentParent = null;
let currentPathPart = null;
let currentResourceId = null;
let currentHttpMethod = null;

for (const rawLine of yamlLines) {
  const line = rawLine.trimEnd();
  // Top-level resource/method name: "  Foo:"
  const nameMatch = line.match(/^  (\w+):\s*$/);
  if (nameMatch) {
    // Save previous if any
    if (currentName && currentType === 'AWS::ApiGateway::Resource' && currentPathPart) {
      resourceDefs[currentName] = { parent: currentParent || 'RootResourceId', pathPart: currentPathPart };
    }
    if (currentName && currentType === 'AWS::ApiGateway::Method' && currentHttpMethod && currentResourceId) {
      methodDefs.push({ method: currentHttpMethod, resourceName: currentResourceId });
    }
    currentName = nameMatch[1];
    currentType = null;
    currentParent = null;
    currentPathPart = null;
    currentResourceId = null;
    currentHttpMethod = null;
    continue;
  }
  if (currentName) {
    if (line.match(/^\s+Type:\s*AWS::ApiGateway::Resource\s*$/)) currentType = 'AWS::ApiGateway::Resource';
    if (line.match(/^\s+Type:\s*AWS::ApiGateway::Method\s*$/)) currentType = 'AWS::ApiGateway::Method';
    const parentMatch = line.match(/^\s+ParentId:\s*!Ref\s+(\w+)\s*$/);
    if (parentMatch) {
      currentParent = parentMatch[1];
    }
    const pathPartMatch = line.match(/^\s+PathPart:\s*([\w\-]+)\s*$/);
    if (pathPartMatch) {
      currentPathPart = pathPartMatch[1];
    }
    const resourceIdMatch = line.match(/^\s+ResourceId:\s*!Ref\s+(\w+)\s*$/);
    if (resourceIdMatch) {
      currentResourceId = resourceIdMatch[1];
    }
    const httpMethodMatch = line.match(/^\s+HttpMethod:\s*(\w+)\s*$/);
    if (httpMethodMatch) {
      currentHttpMethod = httpMethodMatch[1];
    }
  }
}

// Save last block
if (currentName && currentType === 'AWS::ApiGateway::Resource' && currentPathPart) {
  resourceDefs[currentName] = { parent: currentParent || 'RootResourceId', pathPart: currentPathPart };
}
if (currentName && currentType === 'AWS::ApiGateway::Method' && currentHttpMethod && currentResourceId) {
  methodDefs.push({ method: currentHttpMethod, resourceName: currentResourceId });
}

// Build full path for each resource
function buildResourcePath(name, memo = {}) {
  if (memo[name] !== undefined) return memo[name];
  const def = resourceDefs[name];
  if (!def) { memo[name] = null; return null; }
  if (def.parent === 'RootResourceId') {
    memo[name] = `/${def.pathPart}`;
  } else {
    const parentPath = buildResourcePath(def.parent, memo);
    memo[name] = parentPath ? `${parentPath}/${def.pathPart}` : null;
  }
  return memo[name];
}
const resourcePaths = {};
for (const name of Object.keys(resourceDefs)) {
  resourcePaths[name] = buildResourcePath(name, resourcePaths);
}

const apigwPaths = new Set();
for (const md of methodDefs) {
  const rp = resourcePaths[md.resourceName];
  if (rp) apigwPaths.add(`${md.method.toUpperCase()} ${rp}`);
}

// ---------- Compare ----------
const missing = [];
const extra = [];
for (const p of expressPaths) {
  if (!apigwPaths.has(p)) missing.push(p);
}
for (const p of apigwPaths) {
  if (!expressPaths.has(p)) extra.push(p);
}

missing.sort((a, b) => a.split(' ')[1].localeCompare(b.split(' ')[1]) || a.localeCompare(b));
extra.sort((a, b) => a.split(' ')[1].localeCompare(b.split(' ')[1]) || a.localeCompare(b));

console.log(`\nExpress routes: ${expressPaths.size}`);
console.log(`API Gateway routes: ${apigwPaths.size}`);
console.log(`\nMISSING in API Gateway (will cause 403/404/CORS): ${missing.length}`);
for (const p of missing) console.log(`  ${p}`);

console.log(`\nEXTRA in API Gateway (not used by Express): ${extra.length}`);
for (const p of extra) console.log(`  ${p}`);

// CORS preflight risk: browser-facing routes that have mutating methods but no OPTIONS
console.log(`\nBrowser-facing routes missing OPTIONS (CORS preflight risk):`);
const methodsByPath = {};
for (const p of expressPaths) {
  const [method, route] = p.split(' ');
  if (!methodsByPath[route]) methodsByPath[route] = new Set();
  methodsByPath[route].add(method);
}
const corsRisk = [];
for (const [route, methods] of Object.entries(methodsByPath)) {
  if ((methods.has('POST') || methods.has('PATCH') || methods.has('PUT') || methods.has('DELETE')) && !methods.has('OPTIONS')) {
    corsRisk.push({ route, methods: [...methods].sort() });
  }
}
corsRisk.sort((a, b) => a.route.localeCompare(b.route));
for (const r of corsRisk) console.log(`  ${r.route} has ${r.methods.join(',')} but no OPTIONS`);
