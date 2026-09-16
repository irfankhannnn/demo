#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# WhatsApp Platform — Config-Only Deploy
# =============================================================================
# Usage: bash infra/config-deploy.sh <dev|staging|prod>
#
# This service is ECS Fargate, not Lambda — "config-only" here means "skip
# the Docker build + ECR push", not "skip the CFN call". deploy.sh already
# has a SKIP_BUILD=true + IMAGE_TAG=<tag> mode built for exactly this (used
# today by the CI/CD wrapper's rollback-code) — this script's only job is to
# add the same safety gate every other service's config-deploy.sh has
# (services/reality-flow-authentication/infra/config-deploy.sh is the reference:
# diff live vs. desired, refuse if a non-allowlisted parameter would change,
# never touch anything otherwise) in front of that existing, already-tested
# path, rather than reimplementing CFN deploy logic here.
#
# Unlike the pure-Lambda services, this file does NOT extract a shared
# lib/params.sh sourced by both deploy.sh and config-deploy.sh — deploy.sh's
# parameter computation is entangled with real AWS calls (VPC/subnet
# auto-detection, secret auto-generation) that only make sense during a
# real deploy. Instead, this script computes desired values only for the
# small allowlisted + always-diffable set below, directly from .env — see
# the inline comments for exactly which values that excludes and why.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

for bin in aws node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin not found in PATH"
    exit 1
  fi
done

echo "============================================="
echo " WhatsApp Platform — Config-Only Deploy"
echo "============================================="

ENV_NAME="${1:-}"
case "${ENV_NAME}" in
  dev|staging|prod) ;;
  *)
    echo "ERROR: environment is required and must be dev, staging, or prod (got: '${ENV_NAME}')"
    echo "Usage: bash infra/config-deploy.sh <dev|staging|prod>"
    exit 1
    ;;
esac

REGION="${AWS_REGION:-ap-south-1}"
case "${ENV_NAME}" in
  dev) STACK_NAME="${ENV_NAME}-realestate-flow-whatsapp-platform" ;;
  *)   STACK_NAME="${ENV_NAME}-realestateflow-whatsapp-platform" ;;
esac
CLUSTER_NAME="${ENV_NAME}-whatsapp-platform"
SERVICE_NAME="${ENV_NAME}-whatsapp-platform"

ENV_FILE="${ROOT_DIR}/.env.${ENV_NAME}"
if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: ${ENV_FILE} not found"
  exit 1
fi
set -a; source "${ENV_FILE}"; set +a

# Same as deploy.sh: previously auto-generated secrets/network values take
# priority over whatever placeholder is still sitting in .env.<env>.
GENERATED_FILE="${SCRIPT_DIR}/.generated-${ENV_NAME}.env"
if [ -f "${GENERATED_FILE}" ]; then
  set -a; source "${GENERATED_FILE}"; set +a
fi

echo "Environment: ${ENV_NAME}"
echo "Stack:       ${STACK_NAME}"
echo "Region:      ${REGION}"
echo ""

echo "[1/4] Reading live stack parameters..."
if ! LIVE_PARAMS_JSON="$(aws cloudformation describe-stacks \
      --stack-name "${STACK_NAME}" --region "${REGION}" \
      --query "Stacks[0].Parameters" --output json 2>/dev/null)"; then
  echo "ERROR: stack ${STACK_NAME} does not exist (or isn't reachable) — config-only mode requires an existing deployed stack."
  echo "Run a full deploy first: bash infra/deploy.sh deploy ${ENV_NAME}"
  exit 1
fi

live_value_of() {
  node -e "const m=JSON.parse(process.argv[1]);for(const p of m)if(p.ParameterKey===process.argv[2])process.stdout.write(p.ParameterValue)" "$LIVE_PARAMS_JSON" "$1"
}

LIVE_IMAGE_URI="$(live_value_of ContainerImageUri)"
LIVE_IMAGE_TAG="${LIVE_IMAGE_URI##*:}"
if [ -z "$LIVE_IMAGE_TAG" ] || [ "$LIVE_IMAGE_TAG" = "$LIVE_IMAGE_URI" ]; then
  echo "ERROR: could not parse an image tag out of live ContainerImageUri ('$LIVE_IMAGE_URI')."
  exit 1
fi
echo "  Live image tag: $LIVE_IMAGE_TAG (will be reused unchanged)"

# ---- per-env task-sizing defaults, same as deploy.sh's set_env_defaults ----
case "${ENV_NAME}" in
  dev)     TASK_CPU_VAL="${TASK_CPU:-256}"; TASK_MEMORY_VAL="${TASK_MEMORY:-512}";  DESIRED_COUNT_VAL="${DESIRED_COUNT:-0}" ;;
  staging) TASK_CPU_VAL="${TASK_CPU:-256}"; TASK_MEMORY_VAL="${TASK_MEMORY:-1024}"; DESIRED_COUNT_VAL="${DESIRED_COUNT:-1}" ;;
  prod)    TASK_CPU_VAL="${TASK_CPU:-512}"; TASK_MEMORY_VAL="${TASK_MEMORY:-1024}"; DESIRED_COUNT_VAL="${DESIRED_COUNT:-1}" ;;
esac

# Same Fargate CPU/Memory compatibility check deploy.sh runs — replicated so
# an invalid combination is caught here too, before ever reaching CFN.
validate_cpu_memory() {
  local cpu="$1" mem="$2"
  case "${cpu}" in
    256)  case "${mem}" in 512|1024|2048) return 0 ;; esac ;;
    512)  case "${mem}" in 1024|2048|3072|4096) return 0 ;; esac ;;
    1024) case "${mem}" in 2048|3072|4096|5120|6144|7168|8192) return 0 ;; esac ;;
    2048) case "${mem}" in 4096|8192) return 0 ;; esac ;;
    4096) case "${mem}" in 8192) return 0 ;; esac ;;
  esac
  echo "ERROR: Invalid Fargate CPU/Memory combination: CPU=${cpu}, Memory=${mem}"
  exit 1
}
validate_cpu_memory "${TASK_CPU_VAL}" "${TASK_MEMORY_VAL}"

echo "[2/4] Computing desired parameter values from .env.${ENV_NAME}..."
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

is_placeholder_vpc() { [ -z "${1:-}" ] || [ "${1}" = "vpc-xxxxxxxx" ]; }
is_placeholder_cidr() { [ -z "${1:-}" ] || [ "${1}" = "0.0.0.0/0" ]; }
is_placeholder_subnets() { [ -z "${1:-}" ] || [ "${1}" = "subnet-aaaaaaaa,subnet-bbbbbbbb,subnet-cccccccc" ]; }

# Build the "desired" map. Every value here is either allowlisted (safe to
# apply) or excluded from diffing entirely below (never a real config
# change to detect — see config-only-allowed-params.json's _comment for
# why each excluded key is excluded).
declare -A DESIRED=(
  [EnvironmentName]="${ENV_NAME}"
  [InternalApiKey]="${BAILEYS_API_KEY:-}"
  [AdminApiKey]="${BAILEYS_ADMIN_API_KEY:-}"
  [WebhookSecret]="${BAILEYS_WEBHOOK_SECRET:-}"
  [CrmWebhookUrl]="${CRM_WEBHOOK_URL:-}"
  [UseEventBridge]="${USE_EVENTBRIDGE:-true}"
  [EventBusName]="${EVENT_BUS_NAME:-default}"
  [MaxSessionsPerTask]="${MAX_SESSIONS_PER_TASK:-100}"
  [DesiredCount]="${DESIRED_COUNT_VAL}"
  [TaskCpu]="${TASK_CPU_VAL}"
  [TaskMemory]="${TASK_MEMORY_VAL}"
  [DirectIngressCidr]="${DIRECT_INGRESS_CIDR:-0.0.0.0/0}"
  [CloudwatchMetricsEnabled]="${CLOUDWATCH_METRICS_ENABLED:-true}"
  [LogRetentionDays]="${LOG_RETENTION_DAYS:-30}"
  [AlarmEmail]="${ALARM_EMAIL:-}"
  [SessionBucketName]="${SESSION_BUCKET_NAME:-${ENV_NAME}-whatsapp-session-state-${ACCOUNT_ID}}"
  [HostedZoneId]="${HOSTED_ZONE_ID:-}"
  [DomainName]="${DOMAIN_NAME:-}"
  [SpotCapacity]="${SPOT_CAPACITY:-true}"
)
# VpcId/VpcCidr/PrivateSubnetIds only enter the diff if .env explicitly sets
# a real (non-placeholder) value — a still-placeholder .env value means
# "no opinion", since only a real deploy's own AWS auto-detection (not
# replicated here) can say what the resolved value should be, and a
# placeholder-vs-placeholder comparison would never usefully differ anyway.
if ! is_placeholder_vpc "${AWS_VPC_ID:-}"; then DESIRED[VpcId]="${AWS_VPC_ID}"; fi
if ! is_placeholder_cidr "${AWS_VPC_CIDR:-}"; then DESIRED[VpcCidr]="${AWS_VPC_CIDR}"; fi
if ! is_placeholder_subnets "${AWS_PRIVATE_SUBNET_IDS:-}"; then DESIRED[PrivateSubnetIds]="${AWS_PRIVATE_SUBNET_IDS}"; fi

ALLOWLIST_FILE="$SCRIPT_DIR/config-only-allowed-params.json"
if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "ERROR: $ALLOWLIST_FILE not found — config-only mode has no allowlist to check against, refusing to run blind."
  exit 1
fi
ALLOWED_LIST="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).allowedParams.join(','))" "$ALLOWLIST_FILE")"

# NoEcho params — describe-stacks masks these as '****', so they're
# forwarded from .env as-is, never diffed/blocked on.
NOECHO_PARAMS="InternalApiKey,AdminApiKey,WebhookSecret"

CHANGED_KEYS=()
BLOCKED_KEYS=()
for key in "${!DESIRED[@]}"; do
  live="$(live_value_of "$key")"
  desired="${DESIRED[$key]}"
  case ",$NOECHO_PARAMS," in *",$key,"*) continue ;; esac
  if [ "$live" != "$desired" ]; then
    case ",$ALLOWED_LIST," in
      *",$key,"*) CHANGED_KEYS+=("$key") ;;
      *) BLOCKED_KEYS+=("$key: '$live' -> '$desired'") ;;
    esac
  fi
done

if [ ${#BLOCKED_KEYS[@]} -gt 0 ]; then
  echo ""
  echo "ERROR: config-only mode refuses to proceed — the following parameter(s)"
  echo "changed but are NOT on the config-only-safe allowlist ($ALLOWLIST_FILE):"
  for b in "${BLOCKED_KEYS[@]}"; do echo "  - $b"; done
  echo ""
  echo "Run a full deploy instead: bash infra/deploy.sh deploy ${ENV_NAME}"
  exit 1
fi

if [ ${#CHANGED_KEYS[@]} -eq 0 ]; then
  echo ""
  echo "No allowlisted parameter differs from the live stack — nothing to do."
  echo '{}' > "$SCRIPT_DIR/.last-config-diff.json"
  exit 0
fi

echo ""
echo "[3/4] The following parameter(s) will change:"
for key in "${CHANGED_KEYS[@]}"; do
  echo "  - $key: '$(live_value_of "$key")' -> '${DESIRED[$key]}'"
done

DIFF_FILE_TMP="$SCRIPT_DIR/.last-config-diff.json"
{
  echo "{"
  n=${#CHANGED_KEYS[@]}
  i=0
  for key in "${CHANGED_KEYS[@]}"; do
    i=$((i + 1))
    live="$(live_value_of "$key")"
    desired="${DESIRED[$key]}"
    comma=","
    [ "$i" -eq "$n" ] && comma=""
    printf '  "%s": { "from": %s, "to": %s }%s\n' \
      "$key" \
      "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$live")" \
      "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$desired")" \
      "$comma"
  done
  echo "}"
} > "$DIFF_FILE_TMP"
echo ""

# -----------------------------------------------------------------------------
# 4. Delegate to the existing SKIP_BUILD path — reuses deploy.sh's own,
#    already-tested VPC resolution, secret reload, task-sizing, and CFN
#    deploy logic unchanged. Since every non-allowlisted parameter has just
#    been verified identical to live, deploy.sh recomputing its own full
#    parameter set from .env will independently arrive at the same values
#    for everything except the keys that changed above.
# -----------------------------------------------------------------------------
echo "[4/4] Delegating to deploy.sh (SKIP_BUILD=true, image tag pinned to live)..."
SKIP_BUILD=true IMAGE_TAG="$LIVE_IMAGE_TAG" bash "$SCRIPT_DIR/deploy.sh" deploy "$ENV_NAME"

if [ -f "$SCRIPT_DIR/cfn-params-${ENV_NAME}.json" ]; then
  cp "$SCRIPT_DIR/cfn-params-${ENV_NAME}.json" "$SCRIPT_DIR/.last-config-params.json"
  chmod 600 "$SCRIPT_DIR/.last-config-params.json" 2>/dev/null || true
fi

echo ""
echo "============================================="
echo " Config-only deploy complete!"
echo "============================================="
