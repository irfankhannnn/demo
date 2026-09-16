#!/bin/bash
set -euo pipefail

# =============================================================================
# AI Calling Service — Config-Only Deploy
# =============================================================================
# Usage: ./infra/config-deploy.sh <dev|prod>
#
# Same safety model as services/reality-flow-authentication/infra/config-deploy.sh
# (the reference implementation) — see that file's header comment for the
# full rationale. Short version: diffs the LIVE stack's parameters against
# what .env.$ENV would produce today (infra/lib/generate-cfn-params.js — the
# same generator infra/deploy.sh uses); a changed parameter on the allowlist
# (infra/config-only-allowed-params.json) gets its new value, anything else
# that changed is refused outright; every untouched parameter is
# re-supplied explicitly with its live value; LambdaCodeS3Key is never
# diffed (always carried forward from live).
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/custom-domain-guard.sh"
TEMPLATE_FILE="$SCRIPT_DIR/cfn-ai-calling.yaml"

OS_UNAME="$(uname -s || echo '')"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

winpath() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"
  elif command -v wslpath >/dev/null 2>&1; then wslpath -m "$1"
  else echo "$1"; fi
}

for bin in "$AWS_BIN" node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin not found in PATH"
    exit 1
  fi
done

echo "============================================="
echo " AI Calling Service — Config-Only Deploy"
echo "============================================="

DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
ENVIRONMENT_NAME="$DEPLOY_ENV"

REQUIRED_VARS=(
  AWS_REGION
  AWS_PROFILE
  STACK_NAME
  ARTIFACT_BUCKET
  ARTIFACT_PREFIX
  AI_CALLING_TABLE_NAME
  AI_CALLING_KNOWLEDGE_BUCKET
  AI_CALLING_RECORDINGS_BUCKET
  CRM_INTERNAL_API_DOMAIN_NAME
  CRM_INTERNAL_API_BASE_PATH
  AI_CALLING_API_DOMAIN_NAME
  AI_CALLING_API_BASE_PATH
  ALLOWED_ORIGINS
  ELEVENLABS_AGENT_ID
)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

# These 8 are NoEcho, so NOECHO_PARAMS below always forwards them from .env
# verbatim without ever appearing in the "will change" diff output
# (describe-stacks can't reveal a masked value to diff against). A blank
# value here would silently push an empty secret to the live stack on ANY
# unrelated allowlisted-parameter change, with zero visibility — the same
# gap infra/deploy.sh's own SECRET_VARS check exists to catch for a full
# deploy; required here for the same reason, just enforced before this
# script ever reaches NOECHO_PARAMS.
SECRET_VARS=(
  CRM_INTERNAL_API_KEY
  EXOTEL_API_KEY
  EXOTEL_API_TOKEN
  EXOTEL_SID
  ELEVENLABS_API_KEY
  ELEVENLABS_WEBHOOK_SECRET
  SERVER_TOOL_API_KEY
  CRM_CALLER_API_KEY
)
MISSING_SECRETS=()
for var in "${SECRET_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then MISSING_SECRETS+=("$var"); fi
done
if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  echo "ERROR: required secrets are not set in $ENV_FILE:"
  printf '  - %s\n' "${MISSING_SECRETS[@]}"
  echo "These are NoEcho — config-only mode cannot safely proceed without them (see infra/deploy.sh for where each comes from)."
  exit 1
fi

if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-'"
  exit 1
fi

# Same invariant infra/deploy.sh enforces — both allowlisted, so config-only
# mode could otherwise silently produce the broken combination.
# Also rejects raw execute-api hosts and empty domain/base-path values.
if ! validate_custom_domain_vars; then
  echo "Fix the custom-domain settings in $ENV_FILE."
  exit 1
fi

# Same prod fail-closed guard as infra/deploy.sh — a config-only change that
# blanks this in prod would silently break every Exotel webhook.
if [ "$ENVIRONMENT_NAME" = "prod" ] && [ -z "${EXOTEL_WEBHOOK_IPS:-}" ]; then
  echo "ERROR: EXOTEL_WEBHOOK_IPS is empty in $ENV_FILE — required in prod (see infra/deploy.sh for why)."
  exit 1
fi

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)

echo "Region:  $AWS_REGION"
echo "Profile: $AWS_PROFILE"
echo "Stack:   $STACK_NAME"
echo "Env:     $ENVIRONMENT_NAME"
echo ""

echo "[1/4] Reading live stack parameters..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].Parameters" \
      --output json "${AWS_ARGS[@]}" 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — config-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

echo "[2/4] Computing desired parameter values from $(basename "$ENV_FILE")..."
DESIRED_FILE="$SCRIPT_DIR/.config-deploy-desired.json"
node "$SCRIPT_DIR/lib/generate-cfn-params.js" "$DESIRED_FILE" "$ENVIRONMENT_NAME" ""

ALLOWLIST_FILE="$SCRIPT_DIR/config-only-allowed-params.json"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "ERROR: $ALLOWLIST_FILE not found — config-only mode has no allowlist to check against, refusing to run blind."
  exit 1
fi

# NoEcho params — always forwarded from .env as-is, never diffed/blocked
# (describe-stacks masks them as '****'). All eight are also on the
# allowlist, so this only affects whether they're diffed, not whether
# they're allowed to change.
NOECHO_PARAMS="CrmInternalApiKey,ExotelApiKey,ExotelApiToken,ExotelSid,ElevenLabsApiKey,ElevenLabsWebhookSecret,ServerToolApiKey,CrmCallerApiKey"

# generate-cfn-params.js cannot derive a meaningful value for this key here
# (called with s3Key="" above) — never diff/block on it, always live-passthrough.
ALWAYS_LIVE_PARAMS="LambdaCodeS3Key"

DIFF_JSON="$(node -e "
  const fs = require('fs');
  const live = JSON.parse(process.argv[1]);
  const liveMap = {};
  for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;

  const desired = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const allowed = new Set(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).allowedParams);
  const noEcho = new Set(process.argv[4].split(',').filter(Boolean));
  const alwaysLive = new Set(process.argv[5].split(',').filter(Boolean));

  const missing = [];
  const changed = {};
  const blocked = {};
  for (const p of desired) {
    const key = p.ParameterKey;
    if (alwaysLive.has(key)) continue;
    if (!(key in liveMap)) { missing.push(key); continue; }
    if (noEcho.has(key)) continue;
    const liveVal = liveMap[key];
    if (p.ParameterValue !== liveVal) {
      if (allowed.has(key)) changed[key] = { from: liveVal, to: p.ParameterValue };
      else blocked[key] = { from: liveVal, to: p.ParameterValue };
    }
  }
  process.stdout.write(JSON.stringify({ missing, changed, blocked }));
" "$LIVE_PARAMS_JSON" "$DESIRED_FILE" "$ALLOWLIST_FILE" "$NOECHO_PARAMS" "$ALWAYS_LIVE_PARAMS")"

MISSING_COUNT="$(node -e "process.stdout.write(String(JSON.parse(process.argv[1]).missing.length))" "$DIFF_JSON")"
if [ "$MISSING_COUNT" -gt 0 ]; then
  echo "ERROR: the live stack has no value for some parameter(s) the template declares:"
  node -e "JSON.parse(process.argv[1]).missing.forEach(k => console.log('  - ' + k))" "$DIFF_JSON"
  echo "That's a template change, not a pure config change. Run a full deploy: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

BLOCKED_COUNT="$(node -e "process.stdout.write(String(Object.keys(JSON.parse(process.argv[1]).blocked).length))" "$DIFF_JSON")"
CHANGED_COUNT="$(node -e "process.stdout.write(String(Object.keys(JSON.parse(process.argv[1]).changed).length))" "$DIFF_JSON")"

if [ "$BLOCKED_COUNT" -gt 0 ]; then
  echo ""
  echo "ERROR: config-only mode refuses to proceed — the following parameter(s)"
  echo "changed but are NOT on the config-only-safe allowlist ($ALLOWLIST_FILE):"
  node -e "
    const d = JSON.parse(process.argv[1]).blocked;
    for (const [k, v] of Object.entries(d)) console.log('  - ' + k + ': ' + JSON.stringify(v.from) + ' -> ' + JSON.stringify(v.to));
  " "$DIFF_JSON"
  echo ""
  echo "Run a full deploy instead: ./infra/deploy.sh $ENVIRONMENT_NAME"
  rm -f "$DESIRED_FILE"
  exit 1
fi

if [ "$CHANGED_COUNT" -eq 0 ]; then
  echo ""
  echo "No allowlisted parameter differs from the live stack — nothing to do."
  echo '{}' > "$SCRIPT_DIR/.last-config-diff.json"
  rm -f "$DESIRED_FILE"
  exit 0
fi

echo ""
echo "[3/4] The following parameter(s) will change:"
node -e "
  const d = JSON.parse(process.argv[1]).changed;
  for (const [k, v] of Object.entries(d)) console.log('  - ' + k + ': ' + JSON.stringify(v.from) + ' -> ' + JSON.stringify(v.to));
" "$DIFF_JSON"
echo ""

node -e "
  const d = JSON.parse(process.argv[1]);
  require('fs').writeFileSync(process.argv[2], JSON.stringify(d.changed, null, 2) + '\n');
" "$DIFF_JSON" "$SCRIPT_DIR/.last-config-diff.json"

# Build the full parameter-overrides set: changed (allowlisted) keys get
# their new value; NoEcho keys are forwarded from .env (the real value);
# LambdaCodeS3Key is forwarded from live; everything else unchanged is
# forwarded from live explicitly.
OVERRIDES_JSON="$(node -e "
  const fs = require('fs');
  const live = JSON.parse(process.argv[1]);
  const liveMap = {};
  for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;
  const desired = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const desiredMap = {};
  for (const p of desired) desiredMap[p.ParameterKey] = p.ParameterValue;
  const diff = JSON.parse(process.argv[3]);
  const noEcho = new Set(process.argv[4].split(',').filter(Boolean));
  const alwaysLive = new Set(process.argv[5].split(',').filter(Boolean));

  const out = [];
  for (const key of Object.keys(liveMap)) {
    if (alwaysLive.has(key)) { out.push(key + '=' + liveMap[key]); continue; }
    if (noEcho.has(key)) { out.push(key + '=' + desiredMap[key]); continue; }
    if (key in diff.changed) { out.push(key + '=' + desiredMap[key]); continue; }
    out.push(key + '=' + liveMap[key]);
  }
  process.stdout.write(JSON.stringify(out));
" "$LIVE_PARAMS_JSON" "$DESIRED_FILE" "$DIFF_JSON" "$NOECHO_PARAMS" "$ALWAYS_LIVE_PARAMS")"

rm -f "$DESIRED_FILE"

mapfile -t PARAM_OVERRIDES < <(node -e "JSON.parse(process.argv[1]).forEach(x=>console.log(x))" "$OVERRIDES_JSON")

node -e "
  const args = process.argv.slice(1, -1);
  const outFile = process.argv[process.argv.length - 1];
  const out = args.map(p => {
    const idx = p.indexOf('=');
    return { ParameterKey: p.slice(0, idx), ParameterValue: p.slice(idx + 1) };
  });
  require('fs').writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
" "${PARAM_OVERRIDES[@]}" "$SCRIPT_DIR/.last-config-params.json"
chmod 600 "$SCRIPT_DIR/.last-config-params.json" 2>/dev/null || true

echo "[4/4] Deploying CFN parameter update to $STACK_NAME (no code/bundle touched)..."
"$AWS_BIN" cloudformation deploy \
  --template-file "$(winpath "$TEMPLATE_FILE")" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT_NAME" Service=realestateflow-aicalling \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  "${AWS_ARGS[@]}"

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
