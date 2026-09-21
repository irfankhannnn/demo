#!/bin/bash
set -euo pipefail

# =============================================================================
# marketplace-authentication — Config-Only Deploy
# =============================================================================
# Usage: ./infra/config-deploy.sh <dev|prod>
#
# Skips install/build/zip/upload and goes straight to a CFN parameter update,
# for the case where an env var / CFN parameter changed but Lambda code did
# not. Safety model (identical to platform/auth):
#   - Baseline = the LIVE stack's parameters (describe-stacks).
#   - Desired  = infra/lib/params.sh's compute_param_values() on .env.$ENV
#                (the same mapping infra/deploy.sh uses — no drift possible).
#   - Any differing parameter must be on infra/config-only-allowed-params.json
#     (fail-closed allowlist) or this script refuses and changes nothing.
#   - Every unchanged parameter is re-supplied with its live value, so
#     nothing silently falls back to a template Default.
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
winpath() {
  case "$OS_UNAME" in
    MINGW*|MSYS*|CYGWIN*)
      if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi
      ;;
    *) echo "$1" ;;
  esac
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
echo " marketplace-authentication — Config-Only Deploy"
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
ENV="$DEPLOY_ENV"
ENVIRONMENT_NAME="$DEPLOY_ENV"
export ENV ENVIRONMENT_NAME

REQUIRED_VARS=(
  AWS_REGION
  SERVICE_NAME
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  LAMBDA_PACKAGES_BUCKET_NAME
  IDENTITY_CALLBACK_URL
  IDENTITY_LOGOUT_URL
  INTERNAL_API_KEY
)
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

if [[ "$SERVICE_NAME" != realestateflow-* ]]; then
  echo "ERROR: SERVICE_NAME ('$SERVICE_NAME') must start with 'realestateflow-' — set it in $ENV_FILE"
  exit 1
fi
if [ "$ENV" = "prod" ] && [ "${TEST_OTP_ENABLED:-false}" = "true" ]; then
  echo "ERROR: TEST_OTP_ENABLED=true in .env.prod — refusing."
  exit 1
fi

validate_custom_domain_vars

STACK_NAME="${ENV}-${SERVICE_NAME}-stack"
if [[ "$STACK_NAME" != "${ENV}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') does not start with '${ENV}-realestateflow-' — refusing to proceed."
  exit 1
fi

echo "Region:     $AWS_REGION"
echo "Stack:      $STACK_NAME"
echo "Env:        $ENV"
echo ""

# -----------------------------------------------------------------------------
# 1. The stack must already exist
# -----------------------------------------------------------------------------
echo "[1/4] Reading live stack parameters..."
if ! LIVE_PARAMS_JSON="$("$AWS_BIN" cloudformation describe-stacks \
      --stack-name "$STACK_NAME" \
      --region "$AWS_REGION" \
      --query "Stacks[0].Parameters" \
      --output json --no-cli-pager 2>/dev/null)"; then
  echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable) — config-only mode requires an existing deployed stack."
  echo "Run a full deploy first: ./infra/deploy.sh $ENV"
  exit 1
fi

compute_param_values
check_params_match_template "$SCRIPT_DIR/cfn-backend.yaml"

MISSING_LIVE_PARAMS="$(node -e "
  const live = new Set(JSON.parse(process.argv[1]).map(p => p.ParameterKey));
  const wanted = process.argv.slice(2);
  console.log(wanted.filter(k => !live.has(k)).join(','));
" "$LIVE_PARAMS_JSON" "${PARAM_KEYS[@]}")"
if [ -n "$MISSING_LIVE_PARAMS" ]; then
  echo "ERROR: the live stack has no value for: $MISSING_LIVE_PARAMS."
  echo "cfn-backend.yaml declares a parameter the deployed stack has never seen — that's a template change."
  echo "Run a full deploy instead: ./infra/deploy.sh $ENV"
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Diff desired vs live
# -----------------------------------------------------------------------------
echo "[2/4] Computing desired parameter values from $(basename "$ENV_FILE")..."

ALLOWLIST_FILE="$SCRIPT_DIR/config-only-allowed-params.json"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "ERROR: $ALLOWLIST_FILE not found — refusing to run blind."
  exit 1
fi

# NoEcho parameters come back from describe-stacks as "****" — never diffed,
# always forwarded from .env.$ENV as-is.
NOECHO_PARAMS=(GoogleClientId GoogleClientSecret InternalApiKey AuthCallerApiKey)
# Parameters that only a full deploy can legitimately change (none for this
# service — there is no nested routes template — kept for symmetry).
ALWAYS_LIVE_PARAMS=()

for k in "${PARAM_KEYS[@]}"; do export "PV_${k}=${PARAM_VALUES[$k]}"; done

DIFF_JSON="$(node -e "
  const live = JSON.parse(process.argv[1]);
  const liveMap = {};
  for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;
  const allowed = new Set(JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8')).allowedParams);
  const noEcho = new Set(process.argv[3].split(',').filter(Boolean));
  const alwaysLive = new Set(process.argv[4].split(',').filter(Boolean));
  const keys = process.argv.slice(5);
  const changed = {}, blocked = {};
  for (const key of keys) {
    const desired = process.env['PV_' + key];
    if (liveMap[key] === undefined) continue;
    if (noEcho.has(key) || alwaysLive.has(key)) continue;
    if (desired !== liveMap[key]) {
      (allowed.has(key) ? changed : blocked)[key] = { from: liveMap[key], to: desired };
    }
  }
  process.stdout.write(JSON.stringify({ changed, blocked }));
" "$LIVE_PARAMS_JSON" "$ALLOWLIST_FILE" "$(IFS=,; echo "${NOECHO_PARAMS[*]}")" "$(IFS=,; echo "${ALWAYS_LIVE_PARAMS[*]:-}")" "${PARAM_KEYS[@]}")"

BLOCKED_COUNT="$(node -e "process.stdout.write(String(Object.keys(JSON.parse(process.argv[1]).blocked).length))" "$DIFF_JSON")"
CHANGED_COUNT="$(node -e "process.stdout.write(String(Object.keys(JSON.parse(process.argv[1]).changed).length))" "$DIFF_JSON")"

if [ "$BLOCKED_COUNT" -gt 0 ]; then
  echo ""
  echo "ERROR: config-only mode refuses to proceed — these parameter(s) changed but are NOT on the allowlist ($ALLOWLIST_FILE):"
  node -e "
    const d = JSON.parse(process.argv[1]).blocked;
    for (const [k, v] of Object.entries(d)) console.log('  - ' + k + ': ' + JSON.stringify(v.from) + ' -> ' + JSON.stringify(v.to));
  " "$DIFF_JSON"
  echo ""
  echo "Run a full deploy instead: ./infra/deploy.sh $ENV"
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
# 3. Build the full overrides set
# -----------------------------------------------------------------------------
IS_NOECHO() { local k="$1"; for n in "${NOECHO_PARAMS[@]}"; do [ "$n" = "$k" ] && return 0; done; return 1; }
IS_ALWAYS_LIVE() { local k="$1"; for n in "${ALWAYS_LIVE_PARAMS[@]:-}"; do [ -n "$n" ] && [ "$n" = "$k" ] && return 0; done; return 1; }
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

# Full post-deploy parameter snapshot for the wrapper's rollback-config.
node -e "
  const args = process.argv.slice(1, -1);
  const outFile = process.argv[process.argv.length - 1];
  const out = args.map(p => { const i = p.indexOf('='); return { ParameterKey: p.slice(0, i), ParameterValue: p.slice(i + 1) }; });
  require('fs').writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
" "${PARAM_OVERRIDES[@]}" "$SCRIPT_DIR/.last-config-params.json"

echo "[4/4] Deploying CFN parameter update to $STACK_NAME (no code/bundle touched)..."
"$AWS_BIN" cloudformation deploy \
  --template-file "$(winpath "$SCRIPT_DIR/cfn-backend.yaml")" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides "${PARAM_OVERRIDES[@]}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$AWS_REGION" \
  --no-cli-pager \
  --no-fail-on-empty-changeset

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
