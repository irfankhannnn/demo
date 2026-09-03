#!/bin/bash
set -euo pipefail

# =============================================================================
# Create the DynamoDB vector indexes this backend needs
# =============================================================================
# Usage: ./infra/create-vector-index.sh <dev|prod> [property|policy|all]
#
# Creates two indexes, both idempotently:
#   property  property-vector-index   on the CRM table          (semantic property search)
#   policy    knowledge-vector-index  on the knowledge table    (answer_policy_question)
#
# Why this is a script and not CloudFormation
# -------------------------------------------
# CloudFormation does not support DynamoDB vector indexes. `VectorIndexes` is a
# parameter of the DynamoDB CreateTable *API*, not a property of
# AWS::DynamoDB::Table. Declaring it in cfn-backend.yaml passes
# `validate-template` (syntax only) and then fails every changeset with an
# opaque AWS::EarlyValidation::PropertyValidation error naming no resource —
# which blocked all prod deploys of the backend stack on 2026-09-02.
#
# The tables already exist (CloudFormation owns them), so an index is added with
# UpdateTable + --vector-index-updates rather than at CreateTable time.
#
# IMMUTABLE once created. Changing any of these means delete + recreate + a full
# re-embed of everything in the index:
#   - DistanceFunction
#   - the Projection NonKeyAttributes set
#   - Dimensions (must match EMBEDDING_DIMENSIONS on the app side)
#
# The two indexes are deliberately on separate tables. AWS allows up to 5 vector
# indexes per table, so one table would have been possible — the reason not to
# is the immutability above. Sharing a table does not share an index, but it does
# tie the two schemas' lifecycles together in review and in ops; keeping property
# vectors and policy vectors apart means a change to one can never force a
# re-embed of the other.
#
# Requirement (per AWS docs): the table must be on-demand (PAY_PER_REQUEST).
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEPLOY_ENV="${1:-}"
TARGET="${2:-all}"

if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod> [property|policy|all]"
  exit 1
fi

case "$TARGET" in
  property|policy|all) ;;
  *) echo "ERROR: target must be one of: property, policy, all"; exit 1 ;;
esac

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${AWS_REGION:?AWS_REGION must be set in $ENV_FILE}"

AWS_BIN="aws"
case "$(uname -s || echo '')" in
  MINGW*|MSYS*|CYGWIN*) command -v aws.exe >/dev/null 2>&1 && AWS_BIN="aws.exe" ;;
esac

PROFILE_ARGS=()
if [ -n "${AWS_PROFILE:-}" ]; then
  PROFILE_ARGS=(--profile "$AWS_PROFILE")
fi

# -----------------------------------------------------------------------------
# create_index <table> <index-name> <attribute-definitions-json> <index-json>
# -----------------------------------------------------------------------------
create_index() {
  local table="$1"
  local index_name="$2"
  local attr_defs="$3"
  local index_json="$4"

  echo ""
  echo "--- $index_name on $table ---"

  # Guard 1 — does the table exist at all? A clear message beats an AWS one.
  if ! "$AWS_BIN" dynamodb describe-table --table-name "$table" \
        --region "$AWS_REGION" "${PROFILE_ARGS[@]}" >/dev/null 2>&1; then
    echo "ERROR: table '$table' not found. Deploy the backend stack first."
    return 1
  fi

  # Guard 2 — already exists? Re-creating re-embeds everything, so never
  # silently replace one.
  local existing
  existing="$("$AWS_BIN" dynamodb describe-table \
    --table-name "$table" \
    --region "$AWS_REGION" "${PROFILE_ARGS[@]}" \
    --query "Table.VectorIndexes[?IndexName=='${index_name}'].IndexStatus" \
    --output text 2>/dev/null || echo "")"

  if [ -n "$existing" ] && [ "$existing" != "None" ]; then
    echo "Already exists (status: $existing) — nothing to do."
    return 0
  fi

  # Guard 3 — on-demand capacity is required for vector indexes.
  local billing
  billing="$("$AWS_BIN" dynamodb describe-table \
    --table-name "$table" \
    --region "$AWS_REGION" "${PROFILE_ARGS[@]}" \
    --query 'Table.BillingModeSummary.BillingMode' \
    --output text 2>/dev/null || echo "UNKNOWN")"

  if [ "$billing" != "PAY_PER_REQUEST" ]; then
    echo "ERROR: vector indexes require on-demand capacity; table is '$billing'."
    return 1
  fi

  echo "Creating (returns immediately; backfill runs async)..."
  "$AWS_BIN" dynamodb update-table \
    --table-name "$table" \
    --region "$AWS_REGION" "${PROFILE_ARGS[@]}" \
    --attribute-definitions "$attr_defs" \
    --vector-index-updates "$index_json" >/dev/null

  echo "Creation started."
}

# -----------------------------------------------------------------------------
# Property vectors, on the CRM table.
#
# tenantId as the SearchSchema HASH is NOT optional and must never be removed.
# AWS requires the partition key value in every SearchVectors call, which turns
# tenant scoping into an API-level requirement that fails the call if omitted,
# rather than a convention a developer has to remember. Without it, one search
# would rank vectors from every agency and return their data in the response.
#
# NonKeyAttributes must carry every field used for post-search range filtering
# (price, bhk, status): inline filters support equality only, so range
# predicates run in Lambda against whatever the index projected. Adding a field
# later is not possible without a rebuild.
# -----------------------------------------------------------------------------
create_property_index() {
  : "${CRM_DYNAMODB_TABLE_NAME:?CRM_DYNAMODB_TABLE_NAME must be set in $ENV_FILE}"
  create_index "$CRM_DYNAMODB_TABLE_NAME" "property-vector-index" \
    '[{"AttributeName":"tenantId","AttributeType":"S"},
      {"AttributeName":"EntityType","AttributeType":"S"},
      {"AttributeName":"propertyType","AttributeType":"S"}]' \
    '[{"Create":{
        "IndexName":"property-vector-index",
        "VectorAttributeName":"descriptionVector",
        "Dimensions":1024,
        "DistanceFunction":"COSINE",
        "SearchSchema":{"SearchSchemaDefinitions":[
          {"AttributeName":"tenantId","KeyType":"HASH"},
          {"AttributeName":"EntityType","KeyType":"INLINE_FILTER"},
          {"AttributeName":"propertyType","KeyType":"INLINE_FILTER"}
        ]},
        "Projection":{"ProjectionType":"INCLUDE","NonKeyAttributes":[
          "propertyId","title","description","area","city","buildingName",
          "bhk","furnishing","status","rentAmount","price","carpetArea","amenities"
        ]}
      }}]'
}

# -----------------------------------------------------------------------------
# Policy vectors, on the knowledge-chunks table.
#
# Same tenantId-as-HASH reasoning. `category` is an inline filter so the agent
# can narrow to pricing or FAQ; ingestion always writes a category (defaulting
# to "policies") precisely so no chunk is ever missing the filter attribute.
#
# The projection carries chunkText because the retrieved passage IS the answer —
# a search that returned only ids would need a second round trip per hit, inside
# a live phone call.
# -----------------------------------------------------------------------------
create_policy_index() {
  : "${KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME:?KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME must be set in $ENV_FILE}"
  create_index "$KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME" "knowledge-vector-index" \
    '[{"AttributeName":"tenantId","AttributeType":"S"},
      {"AttributeName":"category","AttributeType":"S"}]' \
    '[{"Create":{
        "IndexName":"knowledge-vector-index",
        "VectorAttributeName":"contentVector",
        "Dimensions":1024,
        "DistanceFunction":"COSINE",
        "SearchSchema":{"SearchSchemaDefinitions":[
          {"AttributeName":"tenantId","KeyType":"HASH"},
          {"AttributeName":"category","KeyType":"INLINE_FILTER"}
        ]},
        "Projection":{"ProjectionType":"INCLUDE","NonKeyAttributes":[
          "chunkText","documentTitle","policyId","chunkIndex","category"
        ]}
      }}]'
}

echo "Environment: $DEPLOY_ENV"
echo "Region:      $AWS_REGION"
echo "Target:      $TARGET"

case "$TARGET" in
  property) create_property_index ;;
  policy)   create_policy_index ;;
  all)      create_property_index; create_policy_index ;;
esac

cat <<'NOTE'

-------------------------------------------------------------------------------
An index is NOT searchable until its backfill finishes. Poll with:

  aws dynamodb describe-table --table-name <table> --region <region> \
    --query "Table.VectorIndexes[].{Name:IndexName,Status:IndexStatus,Backfilling:Backfilling}"

Wait for Status=ACTIVE and Backfilling absent/false before searching. Querying a
backfilling index returns partial results with no error, which reads as "we have
no properties matching that" rather than as a fault.

Then populate the vectors:
  node server/scripts/backfill-property-embeddings.js     # properties
  node server/scripts/reindex-policies.js                 # policy documents
-------------------------------------------------------------------------------
NOTE
