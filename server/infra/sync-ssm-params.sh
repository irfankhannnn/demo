#!/bin/bash
set -euo pipefail

# =============================================================================
# Sync server's config to SSM Parameter Store
# =============================================================================
# Usage: ./sync-ssm-params.sh <dev|prod>
#
# Reads server/infra/cfn-params.json (already generated fresh by deploy.sh
# from .env.<env> — must exist and be current before calling this) and
# server/infra/ssm-param-map.txt (ENV_VAR_NAME=CfnParameterName, checked
# into git — the key names themselves aren't secret), and syncs the
# resulting key/value set to SSM under /<env>/realestateflow/server/<KEY> —
# creating parameters that don't exist yet, updating ones whose value
# changed, and deleting ones no longer in the desired set (e.g. a key
# removed from ssm-param-map.txt, or blanked out in .env.<env>). Values that
# are empty in cfn-params.json are skipped, not synced as empty SSM
# parameters — SSM rejects empty values outright, and an absent SSM
# parameter is equivalent to the blank env var it replaces from the app's
# point of view (server/config/ssmBootstrap.js only sets process.env.X for
# keys SSM actually returns).
#
# Always prints the full create/update/delete plan before applying it — see
# server/infra/deploy.sh, which calls this after generating cfn-params.json
# and before the CloudFormation/Lambda deploy step, so the values are live
# in SSM before either Lambda cold-starts against the new code.
#
# All values are stored as SecureString (the AWS-managed alias/aws/ssm KMS
# key — no extra setup, and it costs nothing extra over String at Standard
# tier) — simpler than classifying which of the ~98 keys are "real" secrets
# and which aren't, and there's no downside to encrypting the rest too.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV="${1:-}"
if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
  echo "ERROR: environment must be dev or prod (got: '${ENV}')"
  echo "Usage: ./sync-ssm-params.sh <dev|prod>"
  exit 1
fi

AWS_BIN="aws"
case "$(uname -s || echo '')" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    # Git Bash's MSYS layer auto-converts any argument that looks like a
    # POSIX absolute path (leading /) into a Windows path before handing it
    # to a native .exe — SSM parameter names/paths all start with / by
    # convention, so without this every --name/--path here gets silently
    # rewritten to something like "C:/Program Files/Git/prod/...". This
    # disables that conversion for every aws.exe call in this script
    # (nothing here needs a local file path translated, so it's safe to
    # turn off unconditionally rather than per-call).
    export MSYS_NO_PATHCONV=1
    ;;
esac

# Convert a POSIX path to a Windows-style path when running under Git
# Bash/MSYS/Cygwin — needed for the file paths handed to `node` below
# (node.exe here is itself an MSYS-aware build, so with MSYS_NO_PATHCONV=1
# active above, a raw POSIX path like /c/Users/... reaches its fs calls
# completely unconverted, and Windows Node.js resolves a leading "/" as
# "root of the current drive", not "/" — silently landing on the wrong
# file. Pre-converting sidesteps that regardless of NO_PATHCONV state).
winpath() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    echo "$1"
  fi
}

if [ -z "${AWS_REGION:-}" ]; then
  echo "ERROR: AWS_REGION is not set — source .env.$ENV before calling this script."
  exit 1
fi
REGION="$AWS_REGION"

PARAMS_FILE="$SCRIPT_DIR/cfn-params.json"
MAP_FILE="$SCRIPT_DIR/ssm-param-map.txt"
PREFIX="/${ENV}/realestateflow/server/"

if [ ! -f "$PARAMS_FILE" ]; then
  echo "ERROR: $PARAMS_FILE not found — run this after cfn-params.json has been generated (deploy.sh step 5)."
  exit 1
fi
if [ ! -f "$MAP_FILE" ]; then
  echo "ERROR: $MAP_FILE not found."
  exit 1
fi

echo "=============================================="
echo " Syncing SSM parameters under $PREFIX"
echo "=============================================="

DESIRED_FILE="$(mktemp)"
node -e "
  const fs = require('fs');
  const [ , paramsFile, mapFile, outFile ] = process.argv;
  const params = JSON.parse(fs.readFileSync(paramsFile, 'utf8'));
  const pmap = {};
  for (const p of params) pmap[p.ParameterKey] = p.ParameterValue;

  const lines = fs.readFileSync(mapFile, 'utf8').split('\n');
  const out = [];
  let skippedEmpty = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const envKey = line.slice(0, eq);
    const cfnParam = line.slice(eq + 1);
    if (!(cfnParam in pmap)) {
      console.error('WARNING: CFN parameter ' + cfnParam + ' (mapped from ' + envKey + ') not found in cfn-params.json — skipping');
      continue;
    }
    const value = pmap[cfnParam];
    if (value === undefined || value === null || String(value).length === 0) {
      skippedEmpty++;
      continue;
    }
    // Tab-separated: a value containing '=' or spaces must not corrupt this.
    out.push(envKey + '\t' + value);
  }
  fs.writeFileSync(outFile, out.join('\n') + (out.length ? '\n' : ''));
  if (skippedEmpty > 0) {
    console.error('(' + skippedEmpty + ' mapped key(s) have an empty value in cfn-params.json — not synced; any existing SSM parameter for them will be deleted below.)');
  }
" "$(winpath "$PARAMS_FILE")" "$(winpath "$MAP_FILE")" "$(winpath "$DESIRED_FILE")"

EXISTING_FILE="$(mktemp)"
"$AWS_BIN" ssm get-parameters-by-path \
  --path "$PREFIX" \
  --recursive \
  --with-decryption \
  --region "$REGION" \
  --query "Parameters[].[Name,Value]" \
  --output text > "$EXISTING_FILE" 2>/dev/null || true
# Strip the path prefix from each name so keys line up with DESIRED_FILE
# (which uses bare env-var names, not full SSM paths).
sed -i "s|^${PREFIX}||" "$EXISTING_FILE" 2>/dev/null || true

node -e "
  const fs = require('fs');
  const { execFileSync } = require('child_process');
  const [ , desiredFile, existingFile, prefix, region, awsBin ] = process.argv;

  function parseKV(file) {
    const map = new Map();
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const tab = line.indexOf('\t');
      if (tab === -1) continue;
      map.set(line.slice(0, tab), line.slice(tab + 1));
    }
    return map;
  }

  const desired = parseKV(desiredFile);
  const existing = parseKV(existingFile);

  const toCreate = [];
  const toUpdate = [];
  const toDelete = [];
  let unchanged = 0;

  for (const [key, value] of desired) {
    if (!existing.has(key)) toCreate.push(key);
    else if (existing.get(key) !== value) toUpdate.push(key);
    else unchanged++;
  }
  for (const key of existing.keys()) {
    if (!desired.has(key)) toDelete.push(key);
  }

  console.log('');
  console.log('Will CREATE (' + toCreate.length + '): ' + (toCreate.join(', ') || '(none)'));
  console.log('Will UPDATE (' + toUpdate.length + '): ' + (toUpdate.join(', ') || '(none)'));
  console.log('Will DELETE (' + toDelete.length + '): ' + (toDelete.join(', ') || '(none)'));
  console.log('Unchanged, skipped: ' + unchanged);
  console.log('');

  // Key NAMES only, never values — this script deliberately never prints or
  // writes SSM values anywhere (many are real secrets), and this plan file
  // (read by infra/config-deploy.sh to know whether anything actually
  // changed, and by the CI/CD wrapper for its config revision manifest)
  // keeps that guarantee.
  fs.writeFileSync(
    process.argv[6],
    JSON.stringify({ created: toCreate, updated: toUpdate, deleted: toDelete }, null, 2) + '\n'
  );

  for (const key of [...toCreate, ...toUpdate]) {
    const value = desired.get(key);
    const name = prefix + key;
    execFileSync(awsBin, [
      'ssm', 'put-parameter',
      '--name', name,
      '--value', value,
      '--type', 'SecureString',
      '--overwrite',
      '--region', region,
      '--no-cli-pager',
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  }

  // delete-parameters takes at most 10 names per call.
  for (let i = 0; i < toDelete.length; i += 10) {
    const batch = toDelete.slice(i, i + 10).map((k) => prefix + k);
    execFileSync(awsBin, [
      'ssm', 'delete-parameters',
      '--names', ...batch,
      '--region', region,
      '--no-cli-pager',
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  }

  console.log('SSM sync complete: ' + toCreate.length + ' created, ' + toUpdate.length + ' updated, ' + toDelete.length + ' deleted, ' + unchanged + ' unchanged.');
" "$(winpath "$DESIRED_FILE")" "$(winpath "$EXISTING_FILE")" "$PREFIX" "$REGION" "$AWS_BIN" "$(winpath "$SCRIPT_DIR/.last-ssm-sync-plan.json")"

rm -f "$DESIRED_FILE" "$EXISTING_FILE"
