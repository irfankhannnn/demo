#!/usr/bin/env bash
# =============================================================================
# WhatsApp Platform — Start ECS Service (dev cost optimization)
#
# Usage:
#   cd whatsapp-platform/infra
#   bash start-service.sh [dev|staging|prod]
#
# Sets the ECS service desired count to 1 without changing infrastructure.
# Useful for dev environments where the service is normally stopped.
# =============================================================================
set -euo pipefail

ENV_NAME="${1:-dev}"
REGION="${AWS_REGION:-ap-south-1}"
CLUSTER_NAME="${ENV_NAME}-whatsapp-platform"
SERVICE_NAME="${ENV_NAME}-whatsapp-platform"

echo "Starting ECS service: ${SERVICE_NAME}"
aws ecs update-service \
  --cluster "${CLUSTER_NAME}" \
  --service "${SERVICE_NAME}" \
  --desired-count 1 \
  --region "${REGION}" \
  >/dev/null

echo "✅ Service desired count set to 1."
echo "Check status: aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${REGION}"
