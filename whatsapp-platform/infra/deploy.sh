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
# Required params file: cfn-params-<env>.json  (copy from cfn-params.example.json)
# =============================================================================
set -euo pipefail

ENV_NAME="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

REGION="${AWS_REGION:-ap-south-1}"
STACK_NAME="${ENV_NAME}-whatsapp-platform"
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
ECR_REPO="${ECR_REPO:-${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ENV_NAME}-whatsapp-platform}"

# ─── Step 1: Build + push Docker image ────────────────────────────────────────
if [ "${SKIP_BUILD}" = "true" ]; then
  echo "[SKIP] Docker build/push (SKIP_BUILD=true)"
else
  echo "[1/3] Building Docker image: ${ECR_REPO}:${IMAGE_TAG}"
  docker build -t "${ECR_REPO}:${IMAGE_TAG}" "${ROOT_DIR}"

  echo "[2/3] Pushing image to ECR"
  aws ecr get-login-password --region "${REGION}" | \
    docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
  docker push "${ECR_REPO}:${IMAGE_TAG}"
fi

# ─── Step 2: Deploy CloudFormation ────────────────────────────────────────────
if [ "${SKIP_CFN}" = "true" ]; then
  echo "[SKIP] CloudFormation deploy (SKIP_CFN=true)"
else
  PARAMS_FILE="${SCRIPT_DIR}/cfn-params-${ENV_NAME}.json"

  if [ ! -f "${PARAMS_FILE}" ]; then
    echo "ERROR: Parameters file not found: ${PARAMS_FILE}"
    echo "  Copy cfn-params.example.json → cfn-params-${ENV_NAME}.json and fill in values."
    exit 1
  fi

  # Inject ContainerImageUri from build
  PARAMS_TMP="${SCRIPT_DIR}/cfn-params-${ENV_NAME}-merged.json"
  if command -v jq &> /dev/null; then
    jq --arg img "${ECR_REPO}:${IMAGE_TAG}" '
      map(if .ParameterKey == "ContainerImageUri" then .ParameterValue = $img else . end)
    ' "${PARAMS_FILE}" > "${PARAMS_TMP}"
  else
    echo "ERROR: jq is required but not installed. Install with: apt-get install jq (Debian/Ubuntu) or brew install jq (macOS)"
    exit 1
  fi

  echo "[3/3] Deploying CloudFormation stack: ${STACK_NAME}"
  aws cloudformation deploy \
    --template-file "${SCRIPT_DIR}/cfn-platform.yaml" \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides file://"${PARAMS_TMP}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${REGION}" \
    --no-fail-on-empty-changeset

  rm -f "${PARAMS_TMP}"

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
    --output text)"
  echo "  Add to CRM Lambda env:"
  echo "    BAILEY_ENABLED=true"
  echo "    BAILEY_MODE=selfhosted"
  echo "    BAILEY_API_ENDPOINT=http://${ALB_DNS}"
  echo "    BAILEY_API_KEY=<same as InternalApiKey>"
  echo "    BAILEY_WEBHOOK_SECRET=<same as WebhookSecret>"
fi
