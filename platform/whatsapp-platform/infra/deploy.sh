#!/usr/bin/env bash
# =============================================================================
# WhatsApp Platform — Real Deploy Script (build + push + CFN)
#
# This is the actual packaging/CFN work — the delegate script that
# infra/cicd/platform/whatsapp-platform/deploy.sh calls for every deploy. Run
# it directly for local/manual use; go through the CI/CD wrapper for anything
# you want recorded as a numbered build (release tracking, rollback). See
# infra/cicd/platform/whatsapp-platform/README.md for that design.
#
# Usage:
#   cd platform/whatsapp-platform/infra
#   bash deploy.sh [command] [env]
#
# Commands:
#   deploy   (default) — build image, push to ECR, deploy/update CFN stack
#   start               — set ECS desired count to 1 (no infra changes)
#   stop                — set ECS desired count to 0 (no infra changes, saves cost)
#   status              — show current service status (task count, CPU/mem, health)
#   endpoint            — show current ECS task public IP endpoint (no ALB)
#
# Env: dev | staging | prod (default: dev)
#
# Backward-compatible: `bash deploy.sh dev` still works (env-only shorthand).
#
# Zero manual config required for a fresh AWS account/VPC:
#   - AWS_VPC_ID / AWS_VPC_CIDR / AWS_PRIVATE_SUBNET_IDS are auto-detected from
#     the account's default VPC if not set (or left as placeholders) in .env.
#   - Required secrets (API keys, webhook secret, encryption key) are
#     auto-generated if left as placeholders, and saved to
#     infra/.generated-<env>.env (gitignored) for reuse on redeploys.
#
# Every deploy is pushed under a unique, immutable image tag (git short SHA +
# UTC timestamp) — never a floating "latest" — so a later deploy can never
# silently overwrite the image an earlier one is still running, and the CI/CD
# wrapper always has a concrete historical image to roll back to. The exact
# tag/digest resolved is written to infra/.last-deploy-artifacts.json
# (gitignored, a build artifact) for that wrapper to read back.
#
# Environment overrides (read from ../.env or shell):
#   SKIP_BUILD=true    — skip Docker build + ECR push, reuse an existing
#                        IMAGE_TAG (the wrapper's rollback-code uses this)
#   IMAGE_TAG=...      — deploy this exact tag instead of generating a new one
#                        (required together with SKIP_BUILD=true)
#   SKIP_CFN=true      — skip CloudFormation deploy (build + push only)
#   ALARM_EMAIL=...    — enable CloudWatch alarm and Spot interruption email notifications
#   HOSTED_ZONE_ID=... — enable Route53 dynamic DNS for a stable hostname
#   DOMAIN_NAME=...    — DNS record name to update (e.g., whatsapp.realtyflow.com)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Convert a POSIX path to a Windows-style path when running under Git Bash/MSYS/Cygwin.
# AWS CLI (a Windows process) cannot read /c/... paths, so file:// URLs need C:/... paths.
# Same helper as agency-app/api/infra/deploy.sh — see its comment for the full reasoning.
winpath() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  elif command -v wslpath >/dev/null 2>&1; then
    wslpath -m "$1"
  else
    echo "$1"
  fi
}

# ─── Parse command + env (supports old `deploy.sh [env]` shorthand) ───────────
# Both COMMAND and ENV_NAME are required — no silent "dev" default. A direct/
# manual invocation with a missing or misspelled env argument fails loudly
# instead of quietly targeting dev.
COMMAND="${1:-}"
ENV_NAME="${2:-}"
case "${COMMAND}" in
  dev|staging|prod)
    ENV_NAME="${COMMAND}"
    COMMAND="deploy"
    ;;
  deploy|start|stop|status|endpoint)
    ;;
  *)
    echo "Unknown command: '${COMMAND}'"
    echo "Usage: bash deploy.sh [deploy|start|stop|status|endpoint] <dev|staging|prod>"
    exit 1
    ;;
esac
case "${ENV_NAME}" in
  dev|staging|prod) ;;
  *)
    echo "ERROR: environment is required and must be dev, staging, or prod (got: '${ENV_NAME}')"
    echo "Usage: bash deploy.sh [deploy|start|stop|status|endpoint] <dev|staging|prod>"
    exit 1
    ;;
esac

REGION="${AWS_REGION:-ap-south-1}"
case "${ENV_NAME}" in
  dev)
    # Historical name — the live dev stack (dev-realestate-flow-whatsapp-
    # platform, deployed 2026-07-04) predates the "${env}-realestateflow-*"
    # naming convention now used by platform/auth/server.
    # Changing this formula for dev would target a stack that doesn't exist
    # instead of updating the running one — deliberately left as-is.
    STACK_NAME="${ENV_NAME}-realestate-flow-whatsapp-platform"
    ;;
  *)
    # New environments (staging/prod have no live stack yet) use the
    # correct, repo-wide convention from the start.
    STACK_NAME="${ENV_NAME}-realestateflow-whatsapp-platform"
    ;;
esac
case "${STACK_NAME}" in
  "${ENV_NAME}-"*) ;;
  *)
    echo "ERROR: STACK_NAME '${STACK_NAME}' does not start with '${ENV_NAME}-' — refusing to deploy under a name that doesn't match this environment."
    exit 1
    ;;
esac
CLUSTER_NAME="${ENV_NAME}-whatsapp-platform"
SERVICE_NAME="${ENV_NAME}-whatsapp-platform"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_CFN="${SKIP_CFN:-false}"

# Load the per-environment config file — NEVER the bare local-dev .env for a
# real deploy target. `.env` itself stays reserved for pure local/non-AWS
# runs (LOCAL_STORAGE=true, no ECS involved) — see platform/whatsapp-platform/.env.sample.
ENV_FILE="${ROOT_DIR}/.env.${ENV_NAME}"
if [ -f "${ENV_FILE}" ]; then
  set -a; source "${ENV_FILE}"; set +a
elif [ "${COMMAND}" = "deploy" ]; then
  echo "ERROR: ${ENV_FILE} not found — create it before deploying ${ENV_NAME} (see platform/whatsapp-platform/.env.sample)."
  exit 1
else
  echo "NOTE: ${ENV_FILE} not found — continuing with defaults for a '${COMMAND}' control command (no image/CFN changes need it)."
fi
# Re-assert from the CLI argument regardless of what the sourced file says —
# a stale value inside .env.<env> can never cause a run to silently target
# the wrong environment.
ENV_NAME="${ENV_NAME}"

# Load previously auto-generated secrets/infra values for this env, if any
GENERATED_FILE="${SCRIPT_DIR}/.generated-${ENV_NAME}.env"
if [ -f "${GENERATED_FILE}" ]; then
  set -a; source "${GENERATED_FILE}"; set +a
fi

# Environments with a real live audience must make deliberate choices here —
# never silently inherit a dev-only value with real consequences (an
# internet-open port, or a webhook URL that only resolves on a dev machine).
if [ "${COMMAND}" = "deploy" ] && [ "${ENV_NAME}" != "dev" ]; then
  # Only rejects BLANK — an unset var means "never actually decided this,"
  # inheriting the CFN parameter's open 0.0.0.0/0 default by accident. A
  # value of 0.0.0.0/0 written explicitly into .env.<env> is a deliberate
  # choice (someone had to type it, presumably knowing this task has no
  # ALB/TLS in front of it) and is allowed through unchanged.
  if [ -z "${DIRECT_INGRESS_CIDR:-}" ]; then
    echo "ERROR: DIRECT_INGRESS_CIDR must be set in ${ENV_FILE} for ${ENV_NAME} — not left blank."
    echo "  This task has no ALB/TLS in front of it — DIRECT_INGRESS_CIDR is the only thing between port 3003 and the internet."
    echo "  Use a restricted CIDR (office/VPN range) where possible; 0.0.0.0/0 is accepted if set explicitly and deliberately."
    exit 1
  fi
  if [ "${USE_EVENTBRIDGE:-false}" != "true" ]; then
    case "${CRM_WEBHOOK_URL:-}" in
      ""|*localhost*|*127.0.0.1*)
        echo "ERROR: CRM_WEBHOOK_URL is unset or points at localhost in ${ENV_FILE}, and USE_EVENTBRIDGE is not 'true'."
        echo "  Set USE_EVENTBRIDGE=true, or set CRM_WEBHOOK_URL to a real endpoint reachable from ${ENV_NAME}, before deploying."
        exit 1
        ;;
    esac
  fi
fi

echo "============================================="
echo " WhatsApp Platform — ${COMMAND}"
echo "============================================="
echo " Environment: ${ENV_NAME}"
echo " Stack:       ${STACK_NAME}"
echo " Region:      ${REGION}"
echo ""

# =============================================================================
# Command: start / stop / status — pure ECS service control, no infra changes
# =============================================================================
if [ "${COMMAND}" = "start" ] || [ "${COMMAND}" = "stop" ]; then
  DESIRED=1
  [ "${COMMAND}" = "stop" ] && DESIRED=0

  echo "Setting ECS service '${SERVICE_NAME}' desired count to ${DESIRED}..."
  aws ecs update-service \
    --cluster "${CLUSTER_NAME}" \
    --service "${SERVICE_NAME}" \
    --desired-count "${DESIRED}" \
    --region "${REGION}" \
    >/dev/null

  echo "✅ Done. Desired count = ${DESIRED}."
  echo "   Check status: bash deploy.sh status ${ENV_NAME}"
  exit 0
fi

if [ "${COMMAND}" = "status" ]; then
  aws ecs describe-services \
    --cluster "${CLUSTER_NAME}" \
    --services "${SERVICE_NAME}" \
    --region "${REGION}" \
    --query 'services[0].{status:status,desired:desiredCount,running:runningCount,pending:pendingCount,taskDef:taskDefinition}' \
    --output table
  exit 0
fi

if [ "${COMMAND}" = "endpoint" ]; then
  TASK_ARN="$(aws ecs list-tasks \
    --cluster "${CLUSTER_NAME}" \
    --service-name "${SERVICE_NAME}" \
    --region "${REGION}" \
    --query 'taskArns[0]' \
    --output text 2>/dev/null || echo '')"

  if [ -z "${TASK_ARN}" ] || [ "${TASK_ARN}" = "None" ]; then
    echo "No running tasks found for service '${SERVICE_NAME}'."
    echo "Start the service first: bash deploy.sh start ${ENV_NAME}"
    exit 1
  fi

  ENI_ID="$(aws ecs describe-tasks \
    --cluster "${CLUSTER_NAME}" \
    --tasks "${TASK_ARN}" \
    --region "${REGION}" \
    --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
    --output text 2>/dev/null || echo '')"

  if [ -z "${ENI_ID}" ] || [ "${ENI_ID}" = "None" ]; then
    echo "Task is running but network interface not yet assigned. Wait 30 seconds and retry."
    exit 1
  fi

  PUBLIC_IP="$(aws ec2 describe-network-interfaces \
    --network-interface-ids "${ENI_ID}" \
    --region "${REGION}" \
    --query 'NetworkInterfaces[0].Association.PublicIp' \
    --output text 2>/dev/null || echo '')"

  if [ -z "${PUBLIC_IP}" ] || [ "${PUBLIC_IP}" = "None" ]; then
    echo "Task is running but public IP not yet assigned. Wait 30 seconds and retry."
    exit 1
  fi

  echo "http://${PUBLIC_IP}:3003"
  exit 0
fi

# =============================================================================
# Command: deploy — full build + auto-config + CFN deploy
# =============================================================================
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO_NAME="${ENV_NAME}-whatsapp-platform"
ECR_REPO="${ECR_REPO:-${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO_NAME}}"

# ─── Resolve immutable image tag ──────────────────────────────────────────────
# Each deploy gets a unique, never-reused tag (git short SHA + UTC timestamp)
# by default, so ECR always has an addressable historical image to roll back
# to — unlike a floating "latest" tag, which the next push silently
# overwrites. A caller that needs a specific existing image (the CI/CD
# wrapper's rollback-code, pointing back at an old build) sets IMAGE_TAG
# explicitly and this default is skipped.
GIT_SHA_SHORT="$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo local)"
IMAGE_TAG="${IMAGE_TAG:-${GIT_SHA_SHORT}-$(date -u +%Y%m%d%H%M%S)}"

# ─── Step 1: Build + push Docker image ────────────────────────────────────────
if [ "${SKIP_BUILD}" = "true" ]; then
  echo "[SKIP] Docker build/push (SKIP_BUILD=true) — reusing existing image tag: ${IMAGE_TAG}"
  if ! aws ecr describe-images --repository-name "${ECR_REPO_NAME}" --image-ids imageTag="${IMAGE_TAG}" --region "${REGION}" >/dev/null 2>&1; then
    echo "  ERROR: image tag '${IMAGE_TAG}' not found in ECR repo '${ECR_REPO_NAME}' — cannot deploy a build that was never pushed."
    exit 1
  fi
else
  if ! aws ecr describe-repositories --repository-names "${ECR_REPO_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    echo "[1/6] Creating ECR repository: ${ECR_REPO_NAME}"
    aws ecr create-repository --repository-name "${ECR_REPO_NAME}" --region "${REGION}"
  fi

  echo "[2/6] Building Docker image: ${ECR_REPO}:${IMAGE_TAG}"
  docker build -t "${ECR_REPO}:${IMAGE_TAG}" -t "${ECR_REPO}:latest" "${ROOT_DIR}"

  echo "[3/6] Pushing image to ECR"
  aws ecr get-login-password --region "${REGION}" | \
    docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
  docker push "${ECR_REPO}:${IMAGE_TAG}"
  # "latest" is a convenience floating tag for manual pulls only — CFN's
  # ContainerImageUri parameter (below) always deploys the immutable tag.
  docker push "${ECR_REPO}:latest"
fi

# Record the exact image this run resolved to, for the CI/CD wrapper
# (infra/cicd/platform/whatsapp-platform/deploy.sh) to read afterward — it
# needs the immutable tag+digest to build a release manifest and to point
# rollback-code at a specific historical image. Written regardless of what
# happens next (CFN deploy may still fail) — a build artifact, not source,
# see .gitignore.
IMAGE_DIGEST="$(aws ecr describe-images --repository-name "${ECR_REPO_NAME}" --image-ids imageTag="${IMAGE_TAG}" --region "${REGION}" --query 'imageDetails[0].imageDigest' --output text 2>/dev/null || echo unknown)"
[ "${IMAGE_DIGEST}" = "None" ] && IMAGE_DIGEST="unknown"

cat > "${SCRIPT_DIR}/.last-deploy-artifacts.json" <<EOF
{
  "ecrRepoName": "${ECR_REPO_NAME}",
  "ecrRepo": "${ECR_REPO}",
  "imageTag": "${IMAGE_TAG}",
  "imageUri": "${ECR_REPO}:${IMAGE_TAG}",
  "imageDigest": "${IMAGE_DIGEST}",
  "region": "${REGION}",
  "accountId": "${ACCOUNT_ID}"
}
EOF

# ─── Step 2: Auto-detect VPC/subnets when not explicitly configured ───────────
is_placeholder_vpc() { [ -z "${1:-}" ] || [ "${1}" = "vpc-xxxxxxxx" ]; }
is_placeholder_cidr() { [ -z "${1:-}" ] || [ "${1}" = "0.0.0.0/0" ]; }
is_placeholder_subnets() { [ -z "${1:-}" ] || [ "${1}" = "subnet-aaaaaaaa,subnet-bbbbbbbb,subnet-cccccccc" ]; }

if [ "${SKIP_CFN}" != "true" ]; then
  echo "[4/6] Resolving AWS network configuration"

  if is_placeholder_vpc "${AWS_VPC_ID:-}"; then
    echo "  AWS_VPC_ID not set — auto-detecting default VPC in ${REGION}..."
    AWS_VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
      --region "${REGION}" --query 'Vpcs[0].VpcId' --output text)"
    if [ -z "${AWS_VPC_ID}" ] || [ "${AWS_VPC_ID}" = "None" ]; then
      echo "  ERROR: No default VPC found in ${REGION} and AWS_VPC_ID not set."
      echo "  Set AWS_VPC_ID explicitly in .env for non-default VPCs."
      exit 1
    fi
    echo "  Using VPC: ${AWS_VPC_ID}"
  fi

  if is_placeholder_cidr "${AWS_VPC_CIDR:-}"; then
    AWS_VPC_CIDR="$(aws ec2 describe-vpcs --vpc-ids "${AWS_VPC_ID}" \
      --region "${REGION}" --query 'Vpcs[0].CidrBlock' --output text)"
    echo "  Using VPC CIDR: ${AWS_VPC_CIDR}"
  fi

  if is_placeholder_subnets "${AWS_PRIVATE_SUBNET_IDS:-}"; then
    echo "  AWS_PRIVATE_SUBNET_IDS not set — auto-detecting subnets in ${AWS_VPC_ID}..."
    AWS_PRIVATE_SUBNET_IDS="$(aws ec2 describe-subnets \
      --filters "Name=vpc-id,Values=${AWS_VPC_ID}" \
      --region "${REGION}" --query 'Subnets[].SubnetId' --output text | tr '\t' ',')"
    if [ -z "${AWS_PRIVATE_SUBNET_IDS}" ]; then
      echo "  ERROR: No subnets found in VPC ${AWS_VPC_ID}."
      echo "  Set AWS_PRIVATE_SUBNET_IDS explicitly in .env."
      exit 1
    fi
    SUBNET_COUNT="$(echo "${AWS_PRIVATE_SUBNET_IDS}" | tr ',' '\n' | wc -l | tr -d ' ')"
    if [ "${SUBNET_COUNT}" -lt 2 ]; then
      echo "  ERROR: Fargate requires subnets in at least 2 AZs; found ${SUBNET_COUNT}."
      echo "  Set AWS_PRIVATE_SUBNET_IDS explicitly in .env with subnets from 2+ AZs."
      exit 1
    fi
    echo "  Using subnets: ${AWS_PRIVATE_SUBNET_IDS}"
  fi
fi

# ─── Step 3: Auto-generate required secrets if missing/placeholder ───────────
generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

is_placeholder_secret() {
  case "${1:-}" in
    ""|change-me|change-me-to-a-long-random-string|change-me-to-a-different-long-random-string|change-me-to-32-plus-char-random-string) return 0 ;;
    *) return 1 ;;
  esac
}

SECRETS_GENERATED="false"
ensure_secret() {
  local var_name="$1"
  local current_value="${!var_name:-}"
  if is_placeholder_secret "${current_value}"; then
    local generated
    generated="$(generate_secret)"
    printf -v "${var_name}" '%s' "${generated}"
    echo "  Auto-generated ${var_name} (saved to $(basename "${GENERATED_FILE}"))"
    SECRETS_GENERATED="true"
  fi
}

ensure_secret "BAILEYS_API_KEY"
ensure_secret "BAILEYS_ADMIN_API_KEY"
ensure_secret "BAILEYS_WEBHOOK_SECRET"
ensure_secret "AUTH_ENCRYPTION_KEY"

# Persist auto-generated values (secrets + resolved network config) so re-runs
# are idempotent and don't regenerate secrets or re-query AWS every time.
cat > "${GENERATED_FILE}" <<EOF
# Auto-generated by deploy.sh for env=${ENV_NAME} on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# DO NOT COMMIT — contains secrets. Delete this file to force re-generation/re-detection.
BAILEYS_API_KEY=${BAILEYS_API_KEY}
BAILEYS_ADMIN_API_KEY=${BAILEYS_ADMIN_API_KEY}
BAILEYS_WEBHOOK_SECRET=${BAILEYS_WEBHOOK_SECRET}
AUTH_ENCRYPTION_KEY=${AUTH_ENCRYPTION_KEY}
AWS_VPC_ID=${AWS_VPC_ID:-}
AWS_VPC_CIDR=${AWS_VPC_CIDR:-}
AWS_PRIVATE_SUBNET_IDS=${AWS_PRIVATE_SUBNET_IDS:-}
EOF
chmod 600 "${GENERATED_FILE}" 2>/dev/null || true

if [ "${SECRETS_GENERATED}" = "true" ]; then
  echo "  ⚠️  New secrets were generated. Back up ${GENERATED_FILE} securely (e.g. a password manager)."
fi

# ─── Step 4: Set environment-specific task sizing ─────────────────────────────
# Apply sensible defaults per environment if not explicitly set in .env
set_env_defaults() {
  local env="$1"
  case "${env}" in
    dev)
      TASK_CPU_VAL="${TASK_CPU:-256}"
      TASK_MEMORY_VAL="${TASK_MEMORY:-512}"
      DESIRED_COUNT_VAL="${DESIRED_COUNT:-0}"
      ;;
    staging)
      TASK_CPU_VAL="${TASK_CPU:-256}"
      TASK_MEMORY_VAL="${TASK_MEMORY:-1024}"
      DESIRED_COUNT_VAL="${DESIRED_COUNT:-1}"
      ;;
    prod)
      TASK_CPU_VAL="${TASK_CPU:-512}"
      TASK_MEMORY_VAL="${TASK_MEMORY:-1024}"
      DESIRED_COUNT_VAL="${DESIRED_COUNT:-1}"
      ;;
    *)
      echo "  ERROR: Invalid environment '${env}'. Must be one of: dev, staging, prod"
      echo "  Usage: bash deploy.sh [deploy|start|stop|status] [dev|staging|prod]"
      exit 1
      ;;
  esac
}
set_env_defaults "${ENV_NAME}"

echo "  Task sizing: CPU=${TASK_CPU_VAL}, Memory=${TASK_MEMORY_VAL}, DesiredCount=${DESIRED_COUNT_VAL}"

# ─── Step 5: Validate Fargate CPU/Memory combination ──────────────────────────
echo "[5/6] Validating Fargate CPU/Memory combination"

validate_cpu_memory() {
  local cpu="$1" mem="$2"
  case "${cpu}" in
    256)  case "${mem}" in 512|1024|2048) return 0 ;; esac ;;
    512)  case "${mem}" in 1024|2048|3072|4096) return 0 ;; esac ;;
    1024) case "${mem}" in 2048|3072|4096|5120|6144|7168|8192) return 0 ;; esac ;;
    2048) case "${mem}" in 4096|8192) return 0 ;; esac ;;
    4096) case "${mem}" in 8192) return 0 ;; esac ;;
  esac
  echo "  ERROR: Invalid Fargate CPU/Memory combination: CPU=${cpu}, Memory=${mem}"
  echo "  See https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html"
  exit 1
}
validate_cpu_memory "${TASK_CPU_VAL}" "${TASK_MEMORY_VAL}"

# ─── Step 6: Generate params file + deploy CloudFormation ─────────────────────
PARAMS_FILE="${SCRIPT_DIR}/cfn-params-${ENV_NAME}.json"
echo "[6/6] Generating params file and deploying"

if [ -z "${SESSION_BUCKET_NAME:-}" ]; then
  SESSION_BUCKET_NAME="${ENV_NAME}-whatsapp-session-state-${ACCOUNT_ID}"
  echo "  SESSION_BUCKET_NAME not set — defaulting to: ${SESSION_BUCKET_NAME}"
fi

CRM_WEBHOOK="${CRM_WEBHOOK_URL:-}"
EVENT_BRIDGE="${USE_EVENTBRIDGE:-true}"
EVENT_BUS="${EVENT_BUS_NAME:-default}"
MAX_SESSIONS="${MAX_SESSIONS_PER_TASK:-100}"
DIRECT_INGRESS_CIDR="${DIRECT_INGRESS_CIDR:-0.0.0.0/0}"
SPOT_CAPACITY="${SPOT_CAPACITY:-true}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
CLOUDWATCH_METRICS="${CLOUDWATCH_METRICS_ENABLED:-true}"
LOG_RETENTION="${LOG_RETENTION_DAYS:-30}"
ALARM_EMAIL="${ALARM_EMAIL:-}"

cat > "${PARAMS_FILE}" <<EOF
[
  {"ParameterKey": "EnvironmentName", "ParameterValue": "${ENV_NAME}"},
  {"ParameterKey": "ContainerImageUri", "ParameterValue": "${ECR_REPO}:${IMAGE_TAG}"},
  {"ParameterKey": "SessionBucketName", "ParameterValue": "${SESSION_BUCKET_NAME}"},
  {"ParameterKey": "InternalApiKey", "ParameterValue": "${BAILEYS_API_KEY}"},
  {"ParameterKey": "AdminApiKey", "ParameterValue": "${BAILEYS_ADMIN_API_KEY}"},
  {"ParameterKey": "WebhookSecret", "ParameterValue": "${BAILEYS_WEBHOOK_SECRET}"},
  {"ParameterKey": "AuthEncryptionKey", "ParameterValue": "${AUTH_ENCRYPTION_KEY}"},
  {"ParameterKey": "CrmWebhookUrl", "ParameterValue": "${CRM_WEBHOOK}"},
  {"ParameterKey": "UseEventBridge", "ParameterValue": "${EVENT_BRIDGE}"},
  {"ParameterKey": "EventBusName", "ParameterValue": "${EVENT_BUS}"},
  {"ParameterKey": "MaxSessionsPerTask", "ParameterValue": "${MAX_SESSIONS}"},
  {"ParameterKey": "DesiredCount", "ParameterValue": "${DESIRED_COUNT_VAL}"},
  {"ParameterKey": "TaskCpu", "ParameterValue": "${TASK_CPU_VAL}"},
  {"ParameterKey": "TaskMemory", "ParameterValue": "${TASK_MEMORY_VAL}"},
  {"ParameterKey": "VpcId", "ParameterValue": "${AWS_VPC_ID}"},
  {"ParameterKey": "VpcCidr", "ParameterValue": "${AWS_VPC_CIDR}"},
  {"ParameterKey": "PrivateSubnetIds", "ParameterValue": "${AWS_PRIVATE_SUBNET_IDS}"},
  {"ParameterKey": "DirectIngressCidr", "ParameterValue": "${DIRECT_INGRESS_CIDR}"},
  {"ParameterKey": "HostedZoneId", "ParameterValue": "${HOSTED_ZONE_ID}"},
  {"ParameterKey": "DomainName", "ParameterValue": "${DOMAIN_NAME}"},
  {"ParameterKey": "SpotCapacity", "ParameterValue": "${SPOT_CAPACITY}"},
  {"ParameterKey": "CloudwatchMetricsEnabled", "ParameterValue": "${CLOUDWATCH_METRICS}"},
  {"ParameterKey": "LogRetentionDays", "ParameterValue": "${LOG_RETENTION}"},
  {"ParameterKey": "AlarmEmail", "ParameterValue": "${ALARM_EMAIL}"}
]
EOF

echo "  Generated: ${PARAMS_FILE}"

if [ "${SKIP_CFN}" = "true" ]; then
  echo "[SKIP] CloudFormation deploy (SKIP_CFN=true)"
else
  echo "  Deploying CloudFormation stack: ${STACK_NAME}"
  aws cloudformation deploy \
    --template-file "$(winpath "${SCRIPT_DIR}/cfn-platform.yaml")" \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides "file://$(winpath "${PARAMS_FILE}")" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${REGION}" \
    --no-fail-on-empty-changeset

  echo ""
  echo "=== Stack Outputs ==="
  aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs' \
    --output table

  echo ""
  echo "=== CRM Configuration ==="
  if [ -n "${DOMAIN_NAME}" ]; then
    echo "  Dynamic DNS enabled. Use this stable endpoint in CRM:"
    echo ""
    echo "    http://${DOMAIN_NAME}:3003"
    echo ""
    echo "  The Lambda will update the A record when the task restarts."
  else
    echo "  ALB removed. The ECS task now uses a dynamic public IP."
    echo "  After starting the service, get the current endpoint with:"
    echo ""
    echo "    bash deploy.sh endpoint ${ENV_NAME}"
    echo ""
    echo "  IMPORTANT: The public IP changes when the task restarts."
    echo "  Set HOSTED_ZONE_ID + DOMAIN_NAME in .env to enable Route53 dynamic DNS."
  fi
  echo ""
  echo "  Add to CRM Lambda env:"
  echo "    BAILEY_ENABLED=true"
  echo "    BAILEY_MODE=selfhosted"
  if [ -n "${DOMAIN_NAME}" ]; then
    echo "    BAILEY_API_ENDPOINT=http://${DOMAIN_NAME}:3003"
  else
    echo "    BAILEY_API_ENDPOINT=http://<task-public-ip>:3003"
  fi
  echo "    BAILEY_API_KEY=${BAILEYS_API_KEY}"
  echo "    BAILEY_WEBHOOK_SECRET=${BAILEYS_WEBHOOK_SECRET}"
  echo ""
  echo "=== Dev Cost Controls ==="
  echo "  Stop when idle:  bash deploy.sh stop ${ENV_NAME}"
  echo "  Start again:     bash deploy.sh start ${ENV_NAME}"
  echo "  Check status:    bash deploy.sh status ${ENV_NAME}"
fi
