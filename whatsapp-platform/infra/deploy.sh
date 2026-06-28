#!/usr/bin/env bash
# =============================================================================
# WhatsApp Platform — Deploy Script
#
# Usage:
#   cd whatsapp-platform/infra
#   bash deploy.sh [dev|staging|prod]
#
# Environment (read from ../.env or shell):
#   SKIP_BUILD=true    — skip Docker build + ECR push (re-deploy infra only)
#   SKIP_CFN=true      — skip CloudFormation deploy (build + push only)
#
# AWS infrastructure params (required for ECS deployment):
#   AWS_VPC_ID, AWS_VPC_CIDR, AWS_PRIVATE_SUBNET_IDS
#   These can be set in .env or as shell env vars.
# =============================================================================
set -euo pipefail

ENV_NAME="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

REGION="${AWS_REGION:-ap-south-1}"
STACK_NAME="${ENV_NAME}-realestate-flow-whatsapp-platform"
IMAGE_TAG="${IMAGE_TAG:-latest}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_CFN="${SKIP_CFN:-false}"

# Load .env if present
if [ -f "${ROOT_DIR}/.env" ]; then
  set -a; source "${ROOT_DIR}/.env"; set +a
fi

echo "============================================="
echo " WhatsApp Platform — Deploy"
echo "============================================="
echo " Environment: ${ENV_NAME}"
echo " Stack:       ${STACK_NAME}"
echo " Region:      ${REGION}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO_NAME="${ENV_NAME}-whatsapp-platform"
ECR_REPO="${ECR_REPO:-${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO_NAME}}"

# ─── Step 1: Build + push Docker image ────────────────────────────────────────
if [ "${SKIP_BUILD}" = "true" ]; then
  echo "[SKIP] Docker build/push (SKIP_BUILD=true)"
else
  # Ensure ECR repository exists before pushing
  if ! aws ecr describe-repositories --repository-names "${ECR_REPO_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    echo "[1/4] Creating ECR repository: ${ECR_REPO_NAME}"
    aws ecr create-repository --repository-name "${ECR_REPO_NAME}" --region "${REGION}"
  fi

  echo "[2/4] Building Docker image: ${ECR_REPO}:${IMAGE_TAG}"
  docker build -t "${ECR_REPO}:${IMAGE_TAG}" "${ROOT_DIR}"

  echo "[3/4] Pushing image to ECR"
  aws ecr get-login-password --region "${REGION}" | \
    docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
  docker push "${ECR_REPO}:${IMAGE_TAG}"
fi

# ─── Step 2: Generate params file from .env ────────────────────────────────────
PARAMS_FILE="${SCRIPT_DIR}/cfn-params-${ENV_NAME}.json"

echo "[3/4] Generating params file from .env"

# Default bucket name if not set
SESSION_BUCKET_NAME="${SESSION_BUCKET_NAME:-${ENV_NAME}-whatsapp-session-state-${ACCOUNT_ID}}"

# Default to LOCAL_STORAGE mode if no bucket set
if [ -z "${SESSION_BUCKET_NAME}" ]; then
  echo "  WARNING: SESSION_BUCKET_NAME not set, using LOCAL_STORAGE mode (no ECS deployment)"
  echo "  Set SESSION_BUCKET_NAME in .env for ECS deployment"
  SKIP_CFN="true"
fi

# Check for required AWS infra params
if [ "${SKIP_CFN}" != "true" ]; then
  if [ -z "${AWS_VPC_ID}" ] || [ "${AWS_VPC_ID}" = "vpc-xxxxxxxx" ]; then
    echo "  ERROR: AWS_VPC_ID is required for ECS deployment"
    echo "  Set AWS_VPC_ID in .env or as env var"
    exit 1
  fi
  if [ -z "${AWS_VPC_CIDR}" ] || [ "${AWS_VPC_CIDR}" = "10.0.0.0/16" ]; then
    echo "  ERROR: AWS_VPC_CIDR is required for ECS deployment"
    echo "  Set AWS_VPC_CIDR in .env or as env var"
    exit 1
  fi
  if [ -z "${AWS_PRIVATE_SUBNET_IDS}" ]; then
    echo "  ERROR: AWS_PRIVATE_SUBNET_IDS is required for ECS deployment"
    echo "  Set AWS_PRIVATE_SUBNET_IDS in .env or as env var (comma-separated)"
    exit 1
  fi
fi

# Validate required secrets
validate_secret() {
  local name="$1"
  local value="$2"
  if [ -z "${value}" ] || [ "${value}" = "change-me" ] || [ "${value}" = "change-me-to-a-long-random-string" ] || [ "${value}" = "change-me-to-a-different-long-random-string" ] || [ "${value}" = "change-me-to-32-plus-char-random-string" ]; then
    echo "  ERROR: ${name} must be set in .env (not a placeholder)"
    exit 1
  fi
}

validate_secret "BAILEYS_API_KEY (or INTERNAL_API_KEY)" "${BAILEYS_API_KEY:-${INTERNAL_API_KEY:-}}"
validate_secret "BAILEYS_ADMIN_API_KEY" "${BAILEYS_ADMIN_API_KEY:-}"
validate_secret "BAILEYS_WEBHOOK_SECRET" "${BAILEYS_WEBHOOK_SECRET:-}"
validate_secret "AUTH_ENCRYPTION_KEY" "${AUTH_ENCRYPTION_KEY:-}"

# Generate params JSON
INTERNAL_API_KEY="${BAILEYS_API_KEY:-${INTERNAL_API_KEY}}"
INTERNAL_API_KEY="${INTERNAL_API_KEY:-change-me}"
ADMIN_API_KEY="${BAILEYS_ADMIN_API_KEY:-change-me}"
WEBHOOK_SECRET="${BAILEYS_WEBHOOK_SECRET:-change-me}"
ENCRYPTION_KEY="${AUTH_ENCRYPTION_KEY:-change-me}"
CRM_WEBHOOK="${CRM_WEBHOOK_URL:-}"
EVENT_BRIDGE="${USE_EVENTBRIDGE:-true}"
EVENT_BUS="${EVENT_BUS_NAME:-default}"
MAX_SESSIONS="${MAX_SESSIONS_PER_TASK:-100}"
DESIRED_COUNT_VAL="${DESIRED_COUNT:-1}"
TASK_CPU_VAL="${TASK_CPU:-2048}"
TASK_MEMORY_VAL="${TASK_MEMORY:-4096}"
ALB_CIDR="${ALB_INGRESS_CIDR:-}"
CLOUDWATCH_METRICS="${CLOUDWATCH_METRICS_ENABLED:-true}"
LOG_RETENTION="${LOG_RETENTION_DAYS:-30}"

cat > "${PARAMS_FILE}" <<EOF
[
  {"ParameterKey": "EnvironmentName", "ParameterValue": "${ENV_NAME}"},
  {"ParameterKey": "ContainerImageUri", "ParameterValue": "${ECR_REPO}:${IMAGE_TAG}"},
  {"ParameterKey": "SessionBucketName", "ParameterValue": "${SESSION_BUCKET_NAME}"},
  {"ParameterKey": "InternalApiKey", "ParameterValue": "${INTERNAL_API_KEY}"},
  {"ParameterKey": "AdminApiKey", "ParameterValue": "${ADMIN_API_KEY}"},
  {"ParameterKey": "WebhookSecret", "ParameterValue": "${WEBHOOK_SECRET}"},
  {"ParameterKey": "AuthEncryptionKey", "ParameterValue": "${ENCRYPTION_KEY}"},
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
  {"ParameterKey": "AlbIngressCidr", "ParameterValue": "${ALB_CIDR}"},
  {"ParameterKey": "CloudwatchMetricsEnabled", "ParameterValue": "${CLOUDWATCH_METRICS}"},
  {"ParameterKey": "LogRetentionDays", "ParameterValue": "${LOG_RETENTION}"}
]
EOF

echo "  Generated: ${PARAMS_FILE}"

# ─── Step 3: Deploy CloudFormation ────────────────────────────────────────────
if [ "${SKIP_CFN}" = "true" ]; then
  echo "[SKIP] CloudFormation deploy (SKIP_CFN=true)"
else
  echo "[4/4] Deploying CloudFormation stack: ${STACK_NAME}"
  # Use relative paths so AWS CLI works regardless of shell (Git Bash, WSL, native Unix)
  aws cloudformation deploy \
    --template-file "cfn-platform.yaml" \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides "file://cfn-params-${ENV_NAME}.json" \
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
  ALB_DNS="$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`AlbDnsName`].OutputValue' \
    --output text 2>/dev/null || echo '')"

  if [ -n "${ALB_DNS}" ]; then
    echo "  Add to CRM Lambda env:"
    echo "    BAILEY_ENABLED=true"
    echo "    BAILEY_MODE=selfhosted"
    echo "    BAILEY_API_ENDPOINT=http://${ALB_DNS}"
    echo "    BAILEY_API_KEY=<same as InternalApiKey>"
    echo "    BAILEY_WEBHOOK_SECRET=<same as WebhookSecret>"
  else
    echo "  Note: ALB DNS not found in stack outputs (stack may still be creating)"
  fi
fi
