#!/bin/bash
set -euo pipefail

# =============================================================================
# marketplace-api — Config-Only Deploy
# =============================================================================
# Usage: ./infra/config-deploy.sh <dev|prod>
#
# Same safety model as public-app/property-pages/infra/config-deploy.sh and the
# reference implementation in platform/auth. Short
# version: diffs the LIVE stack's parameters against what .env.$ENV would
# produce today (infra/lib/params.sh — the same function infra/deploy.sh
# uses); a changed parameter on the allowlist
# (infra/config-only-allowed-params.json) gets its new value, anything else
# that changed is refused outright; every untouched parameter is re-supplied
# explicitly with its live value; LambdaCodeS3Key is never diffed (always
# carried forward from live — it's a freshly timestamped key only a real
# deploy's upload produces).
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_FILE="cfn-marketplace-api.yaml"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"

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

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found in PATH (used here only for safe JSON read/write)"
  exit 1
fi

echo "============================================="
echo " marketplace-api — Config-Only Deploy"
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
  CRM_INTERNAL_API_DOMAIN_NAME
  CRM_INTERNAL_API_BASE_PATH
  MARKETPLACE_INTERNAL_API_KEY
  CRM_CALLER_API_KEY
  AUTH_CALLER_API_KEY
  COGNITO_USER_POOL_ID
)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

if ! validate_custom_domain_vars; then
  echo "Fix the custom-domain settings in $ENV_FILE."
  exit 1
fi

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

echo "[2/4] Computing desired parameter values from $(basename "$ENV_FILE")..."
compute_param_values ""

ALLOWLIST_FILE="$SCRIPT_DIR/config-only-allowed-params.json"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "ERROR: $ALLOWLIST_FILE not found — config-only mode has no allowlist to check against, refusing to run blind."
  exit 1
fi

# NoEcho params — always forwarded from .env as-is, never diffed/blocked on
# (describe-stacks masks them as '****').
NOECHO_PARAMS=(MarketplaceInternalApiKey CrmCallerApiKey AuthCallerApiKey GeminiApiKey HcaptchaSecretKey MarketplaceSessionSecret)

# compute_param_values() cannot derive a meaningful value for this key here
# (called with "" above) — never diff/block on it, always live-passthrough.
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
  --template-file "$(winpath "$SCRIPT_DIR/$TEMPLATE_FILE")" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT_NAME" Service=realestateflow-marketplace-api \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  "${AWS_ARGS[@]}"

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
