#!/bin/bash
set -euo pipefail

# =============================================================================
# Instagram Solution Microservice — Config-Only Deploy
# =============================================================================
# Usage: ./infra/config-deploy.sh <dev|prod>
#
# Skips install/zip/upload entirely and goes straight to a CFN parameter
# update, for the "category 2" case (env var / CFN parameter changed, Lambda
# code did not) from docs/proposals/config-only-deploy/context.md. Same
# safety model as services/reality-flow-authentication/infra/config-deploy.sh (the
# reference implementation) — see that file's header comment for the full
# rationale. Short version:
#   - Diffs the LIVE stack's parameters (describe-stacks) against what
#     .env.$ENV would produce today (infra/lib/params.sh — the same
#     function infra/deploy.sh uses, so the two paths can't drift).
#   - A changed parameter on the allowlist (infra/config-only-allowed-
#     params.json) gets its new value; anything else that changed is
#     refused outright (exit 1, no CFN call made).
#   - Every untouched parameter is re-supplied explicitly with its live
#     value, so nothing ever falls back to a template Default by omission.
#   - LambdaCodeS3Key is never diffed — it's a freshly timestamped key only
#     a real deploy's upload produces, always carried forward from live.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"

OS_UNAME="$(uname -s || echo '')"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found in PATH (used here only for safe JSON read/write)"
  exit 1
fi

echo "============================================="
echo " Instagram Solution backend — Config-Only Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument and load the matching env file
# -----------------------------------------------------------------------------
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
  AUTH_SERVICE_DOMAIN_NAME
  AUTH_SERVICE_BASE_PATH
  INSTA_DATA_TABLE_NAME
  INSTA_AUDIT_TABLE_NAME
  ALLOWED_ORIGINS
  # Not required by infra/deploy.sh (the template's own default-blank
  # "kill switch" semantics make that a judgment call there) — but required
  # here specifically: ADAPTER_INTERNAL_API_KEY is NoEcho, so it's always
  # forwarded from .env verbatim without ever appearing in the "will
  # change" diff output (describe-stacks can't reveal a masked value to
  # diff against). A blank value would silently push an empty secret to
  # the live stack on ANY unrelated allowlisted-parameter change, with zero
  # visibility. Fail loudly here instead.
  ADAPTER_INTERNAL_API_KEY
)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

assert_custom_domain_vars

if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-'"
  exit 1
fi

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)

echo "Region:  $AWS_REGION"
echo "Profile: $AWS_PROFILE"
echo "Stack:   $STACK_NAME"
echo "Env:     $ENVIRONMENT_NAME"
echo ""

# -----------------------------------------------------------------------------
# 1. The stack must already exist.
# -----------------------------------------------------------------------------
echo "[1/4] Reading live stack parameters..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --query "Stacks[0].Parameters" \
      --output json "${AWS_ARGS[@]}" 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — config-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

compute_param_values ""
MISSING_LIVE_PARAMS="$(node -e "
  const live = new Set(JSON.parse(process.argv[1]).map(p => p.ParameterKey));
  const wanted = process.argv.slice(2);
  console.log(wanted.filter(k => !live.has(k)).join(','));
" "$LIVE_PARAMS_JSON" "${PARAM_KEYS[@]}")"
if [ -n "$MISSING_LIVE_PARAMS" ]; then
  echo "ERROR: the live stack has no value for: $MISSING_LIVE_PARAMS."
  echo "That's a template change, not a pure parameter change. Run a full deploy: ./infra/deploy.sh $ENVIRONMENT_NAME"
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Compute desired parameter values from .env.$ENV, and diff against live.
# -----------------------------------------------------------------------------
echo "[2/4] Computing desired parameter values from $(basename "$ENV_FILE")..."
compute_param_values ""

ALLOWLIST_FILE="$SCRIPT_DIR/config-only-allowed-params.json"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "ERROR: $ALLOWLIST_FILE not found — config-only mode has no allowlist to check against, refusing to run blind."
  exit 1
fi

# NoEcho parameters come back from describe-stacks as the literal string
# "****" — always forwarded from .env.$ENV as-is (never diffed, never
# blocked on). Every NoEcho parameter in cfn-insta-sol-ms.yaml must be listed
# here, or its "****" live value reads as a permanent change and blocks every
# config-only deploy. INSTA_TOKEN_ENCRYPTION_KEY is forwarded too, so changing
# it in .env.$ENV still rotates it: every connected account would then need
# to reconnect.
NOECHO_PARAMS=(AdapterInternalApiKey MetaAppSecret MetaWebhookVerifyToken TokenEncryptionKey GeminiApiKey)

# LambdaCodeS3Key: compute_param_values() cannot derive a meaningful value
# for it here (called with "" above) — never diff/block on it, always fall
# back to whatever the live stack already has.
ALWAYS_LIVE_PARAMS=(LambdaCodeS3Key)

for k in "${PARAM_KEYS[@]}"; do export "PV_${k}=${PARAM_VALUES[$k]}"; done

DIFF_JSON="$(node -e "
  const live = JSON.parse(process.argv[1]);
  const liveMap = {};
  for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;

  const allowed = new Set(JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')).allowedParams);
  const noEcho = new Set(process.argv[3].split(',').filter(Boolean));
  const alwaysLive = new Set(process.argv[4].split(',').filter(Boolean));
  const keys = process.argv.slice(5);

  const changed = {};
  const blocked = {};
  for (const key of keys) {
    const desired = process.env['PV_' + key];
    if (liveMap[key] === undefined) continue;
    if (noEcho.has(key) || alwaysLive.has(key)) continue;
    const liveVal = liveMap[key];
    if (desired !== liveVal) {
      if (allowed.has(key)) changed[key] = { from: liveVal, to: desired };
      else blocked[key] = { from: liveVal, to: desired };
    }
  }
  process.stdout.write(JSON.stringify({ changed, blocked }));
" "$LIVE_PARAMS_JSON" "$ALLOWLIST_FILE" "$(IFS=,; echo "${NOECHO_PARAMS[*]}")" "$(IFS=,; echo "${ALWAYS_LIVE_PARAMS[*]}")" "${PARAM_KEYS[@]}")"

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
  exit 1
fi

if [ "$CHANGED_COUNT" -eq 0 ]; then
  echo ""
  echo "No allowlisted parameter differs from the live stack — nothing to do."
  echo '{}' > "$SCRIPT_DIR/.last-config-diff.json"
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

# -----------------------------------------------------------------------------
# 3. Build the full parameter-overrides set.
# -----------------------------------------------------------------------------
IS_NOECHO() { local k="$1"; for n in "${NOECHO_PARAMS[@]}"; do [ "$n" = "$k" ] && return 0; done; return 1; }
IS_ALWAYS_LIVE() { local k="$1"; for n in "${ALWAYS_LIVE_PARAMS[@]}"; do [ "$n" = "$k" ] && return 0; done; return 1; }
live_value_of() {
  node -e "const m=JSON.parse(process.argv[1]);for(const p of m)if(p.ParameterKey===process.argv[2])process.stdout.write(p.ParameterValue)" "$LIVE_PARAMS_JSON" "$1"
}

PARAM_OVERRIDES=()
for key in "${PARAM_KEYS[@]}"; do
  if IS_ALWAYS_LIVE "$key"; then
    PARAM_OVERRIDES+=("${key}=$(live_value_of "$key")")
  elif IS_NOECHO "$key"; then
    PARAM_OVERRIDES+=("${key}=${PARAM_VALUES[$key]}")
  else
    is_changed="$(node -e "process.stdout.write(String(process.argv[1] in JSON.parse(process.argv[2]).changed))" "$key" "$DIFF_JSON")"
    if [ "$is_changed" = "true" ]; then
      PARAM_OVERRIDES+=("${key}=${PARAM_VALUES[$key]}")
    else
      PARAM_OVERRIDES+=("${key}=$(live_value_of "$key")")
    fi
  fi
done

node -e "
  const args = process.argv.slice(1, -1);
  const outFile = process.argv[process.argv.length - 1];
  const out = args.map(p => {
    const idx = p.indexOf('=');
    return { ParameterKey: p.slice(0, idx), ParameterValue: p.slice(idx + 1) };
  });
  require('fs').writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
" "${PARAM_OVERRIDES[@]}" "$SCRIPT_DIR/.last-config-params.json"

echo "[4/4] Deploying CFN parameter update to $STACK_NAME (no code/bundle touched)..."
"$AWS_BIN" cloudformation deploy \
  --template-file "$SCRIPT_DIR/cfn-insta-sol-ms.yaml" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT_NAME" Service=realestateflow-insta \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  "${AWS_ARGS[@]}"

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
