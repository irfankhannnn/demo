#!/usr/bin/env node
/**
 * Finds Express routes that are NOT defined in the API Gateway CFN template.
 * Run: node scripts/find-missing-apigw-routes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CFN_PATH = path.resolve(__dirname, '../infra/apigw-explicit-routes.yaml');
const ROUTES_DIR = path.resolve(__dirname, '../routes');
const SERVER_JS = path.resolve(__dirname, '../server.js');

// ── Parse server.js to learn mount points ──
const serverCode = fs.readFileSync(SERVER_JS, 'utf8');
const lines = serverCode.split('\n');
const mountRegex = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+?)(?:Routes)?\s*\)/;
const mounts = {};

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
    continue;
  }
  const m = trimmed.match(mountRegex);
  if (m) {
    const routeName = m[2];
    const pathPart = m[1];
    mounts[routeName] = pathPart;
    // Store with and without 'Routes' suffix to be safe
    if (routeName.endsWith('Routes')) {
      mounts[routeName.replace(/Routes$/, '')] = pathPart;
    } else {
      mounts[routeName + 'Routes'] = pathPart;
    }
  }
}

// ── Parse CFN for PathParts ──
const cfnText = fs.readFileSync(CFN_PATH, 'utf8');
const cfnPaths = new Set();
let m;

// Extract all PathPart values
const pathPartRegex = /PathPart:\s*["']?([^\s"'\n]+)["']?/g;
while ((m = pathPartRegex.exec(cfnText)) !== null) {
  cfnPaths.add(m[1]);
}

// Also extract literal resource names to detect nested patterns
const resourceRegex = /(\w+Resource):\s*\n\s+Type:\s+AWS::ApiGateway::Resource/g;
const resources = [];
while ((m = resourceRegex.exec(cfnText)) !== null) {
  resources.push(m[1]);
}

// Build a tree of CFN paths
function buildCfnPaths() {
  const parentMap = {};
  const pathMap = {};
  const parentRegex = /(\w+Resource):\s*\n\s+Type:\s+AWS::ApiGateway::Resource\s*\n(?:\s+.+\n)*?\s+PathPart:\s*["']?([^\s"'\n]+)["']?\s*\n(?:\s+.+\n)*?\s+ParentId:\s*!Ref\s+(\w+)/g;

  // Reset regex
  const cfn = fs.readFileSync(CFN_PATH, 'utf8');
  const resourceBlockRegex = /(\w+Resource):\s*\n\s+Type:\s+AWS::ApiGateway::Resource\s*\n\s+Properties:\s*\n(?:\s+.+\n)+?(?=\n\s+\w+:|\n\s*#|$)/g;
  const blocks = [];
  let bm;
  while ((bm = resourceBlockRegex.exec(cfn)) !== null) {
    blocks.push(bm[0]);
  }

  for (const block of blocks) {
    const nameMatch = block.match(/^(\w+Resource):/);
    const pathPartMatch = block.match(/PathPart:\s*["']?([^\s"'\n]+)["']?/);
    const parentMatch = block.match(/ParentId:\s*!Ref\s+(\w+)/);
    if (nameMatch && pathPartMatch) {
      pathMap[nameMatch[1]] = {
        pathPart: pathPartMatch[1],
        parent: parentMatch ? parentMatch[1] : null,
      };
    }
  }

  // Build full paths
  function getFullPath(resName) {
    const parts = [];
    let current = resName;
    const visited = new Set();
    while (current && pathMap[current]) {
      if (visited.has(current)) break;
      visited.add(current);
      parts.unshift(pathMap[current].pathPart);
      current = pathMap[current].parent;
    }
    return '/' + parts.join('/');
  }

  const fullPaths = new Set();
  for (const resName of Object.keys(pathMap)) {
    fullPaths.add(getFullPath(resName));
  }
  return fullPaths;
}

const cfnFullPaths = buildCfnPaths();

// ── Parse Express routes ──
function extractExpressRoutes(filePath, baseMount) {
  const code = fs.readFileSync(filePath, 'utf8');
  const routes = [];

  // Match router.METHOD('path', ...) patterns
  const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let rm;
  while ((rm = routeRegex.exec(code)) !== null) {
    const method = rm[1].toUpperCase();
    let routePath = rm[2];
    // Combine mount + route path
    let fullPath = baseMount + routePath;
    // Normalize: remove trailing slashes, ensure leading slash
    fullPath = fullPath.replace(/\/+/g, '/');
    routes.push({ method, path: fullPath, file: path.basename(filePath) });
  }
  return routes;
}

// ── Compare ──
const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));
const allExpressRoutes = [];

for (const file of routeFiles) {
  const routerName = file.replace('.js', '');
  const routerNameCapitalized = routerName.charAt(0).toUpperCase() + routerName.slice(1);

  // Try to find mount point
  let mount = null;
  let isMounted = false;
  for (const [key, value] of Object.entries(mounts)) {
    if (key.toLowerCase() === routerName.toLowerCase() ||
        key.toLowerCase() === routerNameCapitalized.toLowerCase() ||
        key.toLowerCase() === (routerName + 'routes').toLowerCase()) {
      mount = value;
      isMounted = true;
      break;
    }
  }

  if (!isMounted) {
    continue; // Skip disabled/unmounted routers (like developers, areasBuildings, flats)
  }

  const routes = extractExpressRoutes(path.join(ROUTES_DIR, file), mount);
  allExpressRoutes.push(...routes);
}

// Normalize paths for comparison
function normalize(p) {
  return p
    .replace(/\/{2,}/g, '/')
    .replace(/:([^/]+)/g, '{$1}')  // Express :param -> API Gateway {param}
    .replace(/\/$/, '');
}

// Find missing: check if the base resource path exists in CFN
const missing = [];
for (const route of allExpressRoutes) {
  const norm = normalize(route.path);

  // For comparison, we just need the path portion after /api
  // The CFN template defines paths relative to the API root
  // e.g. /crm/contacts/{id}/activity

  // Check if any CFN full path contains this route pattern
  const exists = Array.from(cfnFullPaths).some(cfnPath => {
    const cfnNorm = normalize(cfnPath);
    // Exact match or the route path is a parent of a CFN method path
    return cfnNorm === norm ||
           // CFN paths might have parent resources that match
           cfnNorm.replace(/\/{.*}/g, '') === norm.replace(/\/{.*}/g, '');
  });

  // Better heuristic: just check if the path segments exist
  // Split path into segments and check each segment exists as a PathPart in CFN
  const segments = norm.split('/').filter(Boolean);
  const allSegmentsExist = segments.every(seg => {
    // {param} matches any param-style PathPart in CFN
    if (seg.startsWith('{') && seg.endsWith('}')) return true;
    return cfnPaths.has(seg);
  });

  if (!allSegmentsExist) {
    missing.push(route);
  }
}

// Deduplicate by path
const seen = new Set();
const uniqueMissing = [];
for (const r of missing) {
  const key = `${r.method} ${r.path}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueMissing.push(r);
  }
}

// ── Report ──
console.log('\n=== Missing API Gateway Routes ===\n');
if (uniqueMissing.length === 0) {
  console.log('✅ All Express routes appear to be covered in the CFN template.');
} else {
  console.log(`❌ Found ${uniqueMissing.length} potentially missing route(s):\n`);
  for (const r of uniqueMissing.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`  ${r.method.padEnd(6)} ${r.path}  (${r.file})`);
  }
  console.log('\n⚠️  Note: This is a heuristic check. Some routes may exist under different naming conventions.');
  console.log('    Please verify each missing route before adding to the CFN template.');
}

console.log('\n=== CFN Path Coverage Summary ===');
console.log(`Total CFN resources: ${resources.length}`);
console.log(`Total Express routes checked: ${allExpressRoutes.length}`);
console.log(`Potentially missing: ${uniqueMissing.length}`);
