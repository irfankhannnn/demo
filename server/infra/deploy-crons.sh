#!/bin/bash
set -euo pipefail
# Deploy individual cron CloudFormation stacks
# Usage: ./infra/deploy-crons.sh [cron-name]
# Example: ./infra/deploy-crons.sh credit-reset

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CRON_DIR="$ROOT_DIR/cron"
AWS_REGION="${AWS_REGION:-ap-south-1}"

CRONS=(
  credit-reset
  incomplete-data
  expiring-agreements
  team-summary
  lead-followup
  whatsapp-processor
  lead-qualifier
  lead-router
)

deploy_one() {
  local name="$1"
  local template="$CRON_DIR/${name}.yaml"
  if [ ! -f "$template" ]; then
    echo "SKIP: $template not found"
    return
  fi
  echo "Deploying cron stack: realestateflow-${name}..."
  aws cloudformation deploy \
    --template-file "$template" \
    --stack-name "realestateflow-${name}" \
    --capabilities CAPABILITY_IAM \
    --region "$AWS_REGION" \
    --no-fail-on-empty-changeset
}

if [ "${1:-}" = "all" ] || [ -z "${1:-}" ]; then
  for c in "${CRONS[@]}"; do deploy_one "$c"; done
else
  deploy_one "$1"
fi

echo "Done."
