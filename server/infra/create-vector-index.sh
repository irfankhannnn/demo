#!/bin/bash
set -euo pipefail

# =============================================================================
# Create the DynamoDB vector indexes this backend needs
# =============================================================================
# Usage: ./infra/create-vector-index.sh <dev|prod> [property|policy|all]
#
#   property  property-vector-index   on the CRM table        (semantic property search)
#   policy    knowledge-vector-index  on the knowledge table  (answer_policy_question)
#
# Both idempotent: an index that already exists is left alone, because
# re-creating one re-embeds everything in it.
#
# This script only loads the environment. The work is in create-vector-index.mjs,
# which uses the AWS SDK rather than the `aws` CLI: DynamoDB vector search is new
# enough that an installed CLI is very likely too old (2.27.10 rejects
# --vector-index-updates and has no search-vectors at all), whereas the SDK
# version is pinned in package.json.
#
# Why not CloudFormation: it has no schema for DynamoDB vector indexes.
# `VectorIndexes` is a parameter of the CreateTable *API*, not a property of
# AWS::DynamoDB::Table. Declaring it passes `validate-template` (syntax only)
# and then fails every changeset with an opaque
# AWS::EarlyValidation::PropertyValidation error naming no resource — which
# blocked all prod deploys of the backend stack on 2026-09-02.
#
# IMMUTABLE once created. Changing the distance function, the projected
# attribute set, or the dimension count means delete + recreate + a full
# re-embed. The specifications, and the reasoning behind each field, live in
# create-vector-index.mjs.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOY_ENV="${1:-}"
TARGET="${2:-all}"

if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod> [property|policy|all]"
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

echo "Environment: $DEPLOY_ENV"

cd "$PROJECT_DIR"
exec node infra/create-vector-index.mjs "$TARGET"
