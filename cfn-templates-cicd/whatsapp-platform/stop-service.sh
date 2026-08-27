#!/usr/bin/env bash
# =============================================================================
# WhatsApp Platform — Stop ECS Service (dev cost optimization)
#
# Usage:
#   cd cfn-templates-cicd/whatsapp-platform
#   bash stop-service.sh [dev|staging|prod]
#
# Sets the ECS service desired count to 0 without changing infrastructure.
# Stops Fargate charges while keeping the stack, ECR image, and task definition.
# =============================================================================
set -euo pipefail

ENV_NAME="${1:-dev}"
REGION="${AWS_REGION:-ap-south-1}"
CLUSTER_NAME="${ENV_NAME}-whatsapp-platform"
SERVICE_NAME="${ENV_NAME}-whatsapp-platform"

echo "Stopping ECS service: ${SERVICE_NAME}"
aws ecs update-service \
  --cluster "${CLUSTER_NAME}" \
  --service "${SERVICE_NAME}" \
  --desired-count 0 \
  --region "${REGION}" \
  >/dev/null

echo "✅ Service desired count set to 0."
echo "Check status: aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${REGION}"
