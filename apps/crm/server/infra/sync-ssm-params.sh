#!/bin/bash
set -euo pipefail

# =============================================================================
# Sync server's config to SSM Parameter Store
# =============================================================================
# Usage: ./sync-ssm-params.sh <dev|prod> [--no-delete | --delete-only] [--dry-run]
#
#   (no mode flag)  create + update + delete in one pass. Used by
#                   infra/config-deploy.sh, where no code changes, so removing
#                   an obsolete key is exactly the intended config change.
#   --no-delete     create + update only. Obsolete keys are reported as
#                   DEFERRED DELETE and left in place. Used by infra/deploy.sh
#                   BEFORE the CloudFormation/Lambda update.
#   --delete-only   delete obsolete keys only (no create/update). Used by
#                   infra/deploy.sh AFTER the CloudFormation/Lambda update has
#                   succeeded.
#   --dry-run       print the plan for the chosen mode and change nothing (no
#                   put/delete calls, plan file not written). Read-only AWS
#                   call: get-parameters-by-path.
#
# Why the split: the old Lambda code keeps serving requests until the stack
# update finishes, and any container that cold-starts during that window
# reads SSM. Deleting a key the OLD code still needs (e.g. AUTH_SERVICE_URL,
# replaced by AUTH_SERVICE_DOMAIN_NAME/BASE_PATH) before the NEW code is live
# breaks the old code mid-deploy. So a full deploy adds/updates first, and
# prunes only once the new code is live. If the deploy fails, nothing is
# deleted.
#
# Reads apps/crm/server/infra/cfn-params.json (already generated fresh by deploy.sh
# from .env.<env> — must exist and be current before calling this) and
# apps/crm/server/infra/ssm-param-map.txt (ENV_VAR_NAME=CfnParameterName, checked
# into git — the key names themselves aren't secret), and syncs the
# resulting key/value set to SSM under /<env>/realestateflow/server/<KEY> —
# creating parameters that don't exist yet, updating ones whose value
# changed, and deleting ones no longer in the desired set (e.g. a key
# removed from ssm-param-map.txt, or blanked out in .env.<env>). Values that
# are empty in cfn-params.json are skipped, not synced as empty SSM
# parameters — SSM rejects empty values outright, and an absent SSM
# parameter is equivalent to the blank env var it replaces from the app's
# point of view (apps/crm/server/config/ssmBootstrap.js only sets process.env.X for
# keys SSM actually returns).
#
# Always prints the full create/update/delete plan before applying it.
#
# All values are stored as SecureString (the AWS-managed alias/aws/ssm KMS
# key — no extra setup, and it costs nothing extra over String at Standard
# tier) — simpler than classifying which of the ~98 keys are "real" secrets
# and which aren't, and there's no downside to encrypting the rest too.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  echo "Usage: ./sync-ssm-params.sh <dev|prod> [--no-delete | --delete-only] [--dry-run]"
}

ENV=""
MODE="full"
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    dev|prod)
      if [ -n "$ENV" ]; then echo "ERROR: environment given twice"; usage; exit 1; fi
      ENV="$arg"
      ;;
    --no-delete|--delete-only)
      if [ "$MODE" != "full" ]; then echo "ERROR: --no-delete and --delete-only are mutually exclusive"; usage; exit 1; fi
      MODE="${arg#--}"
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      echo "ERROR: unknown argument '${arg}'"
      usage
      exit 1
      ;;
  esac
done

if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
  echo "ERROR: environment must be dev or prod (got: '${ENV}')"
  usage
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
echo " Mode: $MODE$([ "$DRY_RUN" = true ] && echo ' (DRY RUN — no changes)')"
echo "=============================================="

DESIRED_FILE="$(mktemp)"
EXISTING_FILE="$(mktemp)"
# Both temp files can hold decrypted secret values — never leave them behind,
# even if a put/delete call below fails under set -e.
trap 'rm -f "$DESIRED_FILE" "$EXISTING_FILE"' EXIT

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
    console.error('(' + skippedEmpty + ' mapped key(s) have an empty value in cfn-params.json — not synced; any existing SSM parameter for them is treated as obsolete below.)');
  }
" "$(winpath "$PARAMS_FILE")" "$(winpath "$MAP_FILE")" "$(winpath "$DESIRED_FILE")"

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
  const [ , desiredFile, existingFile, prefix, region, awsBin, planFile, mode, dryRunArg ] = process.argv;
  const dryRun = dryRunArg === 'true';
  const doPut = mode !== 'delete-only';
  const doDelete = mode !== 'no-delete';

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
  const obsolete = [];
  let unchanged = 0;

  for (const [key, value] of desired) {
    if (!existing.has(key)) toCreate.push(key);
    else if (existing.get(key) !== value) toUpdate.push(key);
    else unchanged++;
  }
  for (const key of existing.keys()) {
    if (!desired.has(key)) obsolete.push(key);
  }

  const created = doPut ? toCreate : [];
  const updated = doPut ? toUpdate : [];
  const deleted = doDelete ? obsolete : [];
  const deferred = doDelete ? [] : obsolete;

  const verb = dryRun ? 'Would' : 'Will';
  console.log('');
  if (doPut) {
    console.log(verb + ' CREATE (' + created.length + '): ' + (created.join(', ') || '(none)'));
    console.log(verb + ' UPDATE (' + updated.length + '): ' + (updated.join(', ') || '(none)'));
  } else if (toCreate.length || toUpdate.length) {
    // Should not happen in a normal deploy (the --no-delete pass ran first
    // against the same cfn-params.json) — report, but never write here.
    console.log('NOTE: ' + (toCreate.length + toUpdate.length) + ' key(s) still differ from cfn-params.json but --delete-only never creates/updates: ' + [...toCreate, ...toUpdate].join(', '));
  }
  if (doDelete) {
    console.log(verb + ' DELETE (' + deleted.length + '): ' + (deleted.join(', ') || '(none)'));
  } else {
    console.log('DEFERRED DELETE (' + deferred.length + ', removed only after a successful stack/Lambda update): ' + (deferred.join(', ') || '(none)'));
  }
  console.log('Unchanged, skipped: ' + unchanged);
  console.log('');

  if (dryRun) {
    console.log('Dry run — no SSM changes made, plan file not written.');
    process.exit(0);
  }

  // Key NAMES only, never values — this script deliberately never prints or
  // writes SSM values anywhere (many are real secrets), and this plan file
  // (read by infra/config-deploy.sh to know whether anything actually
  // changed, and by the CI/CD wrapper for its config revision manifest)
  // keeps that guarantee.
  let plan = { created, updated, deleted };
  if (mode === 'no-delete') {
    plan.deferredDeletes = deferred;
  } else if (mode === 'delete-only') {
    // Merge into the plan the --no-delete pass of the same deploy wrote, so
    // the file still describes the whole deploy's SSM changes.
    try {
      const prev = JSON.parse(fs.readFileSync(planFile, 'utf8'));
      plan = {
        created: prev.created || [],
        updated: prev.updated || [],
        deleted: [...(prev.deleted || []), ...deleted],
      };
    } catch (_) { /* no previous plan — record just this pass */ }
  }
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2) + '\n');

  for (const key of [...created, ...updated]) {
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
  for (let i = 0; i < deleted.length; i += 10) {
    const batch = deleted.slice(i, i + 10).map((k) => prefix + k);
    execFileSync(awsBin, [
      'ssm', 'delete-parameters',
      '--names', ...batch,
      '--region', region,
      '--no-cli-pager',
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  }

  console.log('SSM sync complete (' + mode + '): ' + created.length + ' created, ' + updated.length + ' updated, ' + deleted.length + ' deleted, ' + deferred.length + ' deferred, ' + unchanged + ' unchanged.');
" "$(winpath "$DESIRED_FILE")" "$(winpath "$EXISTING_FILE")" "$PREFIX" "$REGION" "$AWS_BIN" "$(winpath "$SCRIPT_DIR/.last-ssm-sync-plan.json")" "$MODE" "$DRY_RUN"
