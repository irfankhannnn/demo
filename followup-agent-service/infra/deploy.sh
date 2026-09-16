#!/bin/bash
set -euo pipefail

# =============================================================================
# Follow-up Agent Service - Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#
# Loads followup-agent-service/.env.dev or .env.prod (never a plain .env) and
# FORCES ENVIRONMENT_NAME to match the CLI argument, so a stale env file can
# never silently deploy dev as prod or vice versa. dev and prod are separate
# stacks with separate physical resource names - no shared state.
#
# Every physical resource is named <env>-realestateflow-followup-<resource>
# (env first), matching the other services in this account.
#
# Secrets (CRM / ai-calling shared keys) are passed as NoEcho CFN parameters
# into a Secrets Manager secret. The Lambdas resolve them at cold start from
# SECRETS_ARN - they are never written into the function's environment.
#
# infra/cfn-params.json is a BUILD ARTIFACT, regenerated fresh on every run.
# It contains real secret values. Never hand-edit it; it is gitignored.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/custom-domain-guard.sh"
TEMPLATE_FILE="$SCRIPT_DIR/cfn-followup.yaml"

# -----------------------------------------------------------------------------
# Windows Git Bash compatibility (same approach as the other services)
# -----------------------------------------------------------------------------
OS_UNAME="$(uname -s || echo '')"
NPM_BIN="npm"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v npm.cmd >/dev/null 2>&1; then NPM_BIN="npm.cmd"; fi
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

winpath() {
  if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"
  elif command -v wslpath >/dev/null 2>&1; then wslpath -m "$1"
  else echo "$1"; fi
}

for bin in "$NPM_BIN" "$AWS_BIN" zip node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin not found in PATH"
    exit 1
  fi
done

echo "============================================="
echo " Follow-up Agent Service - Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument
# -----------------------------------------------------------------------------
DEPLOY_ENV="${1:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod>"
  echo "  e.g. ./infra/deploy.sh dev"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Copy followup-agent-service/.env.example to $ENV_FILE and fill in the values."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# The CLI argument is the source of truth, not whatever the file happens to say.
ENVIRONMENT_NAME="$DEPLOY_ENV"

# -----------------------------------------------------------------------------
# 0a. Validate configuration
# -----------------------------------------------------------------------------
REQUIRED_VARS=(
  AWS_REGION
  AWS_PROFILE
  STACK_NAME
  ARTIFACT_BUCKET
  ARTIFACT_PREFIX
  FOLLOWUP_TABLE_NAME
  CRM_INTERNAL_API_DOMAIN_NAME
  CRM_INTERNAL_API_BASE_PATH
  AI_CALLING_SERVICE_DOMAIN_NAME
  AI_CALLING_SERVICE_BASE_PATH
  FOLLOWUP_API_DOMAIN_NAME
  FOLLOWUP_API_BASE_PATH
  ALLOWED_ORIGINS
)
MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then MISSING+=("$var"); fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERROR: required config missing from $ENV_FILE:"
  for var in "${MISSING[@]}"; do echo "  - $var"; done
  exit 1
fi

# Secrets are listed separately so the failure message can say where each one
# actually comes from. No defaults, no placeholders.
SECRET_VARS=(
  CRM_INTERNAL_API_KEY
  AI_CALLING_CALLER_API_KEY
  CRM_CALLER_API_KEY
)
MISSING_SECRETS=()
for var in "${SECRET_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then MISSING_SECRETS+=("$var"); fi
done
if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  cat <<EOF
ERROR: required secrets are not set in $ENV_FILE:
$(printf '  - %s\n' "${MISSING_SECRETS[@]}")

Where each comes from:
  CRM_INTERNAL_API_KEY       must equal server/.env.${DEPLOY_ENV}'s FOLLOWUP_INTERNAL_API_KEY
                             (the CRM's FollowupInternalApiKey parameter)
  AI_CALLING_CALLER_API_KEY  must equal ai-calling-service/.env.${DEPLOY_ENV}'s CRM_CALLER_API_KEY
  CRM_CALLER_API_KEY         generate one, e.g. \`openssl rand -hex 32\`, and set the
                             same value as FOLLOWUP_CALLER_API_KEY in server/.env.${DEPLOY_ENV}

These are never committed - $ENV_FILE is gitignored.
EOF
  exit 1
fi

# Naming convention guards.
if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-'"
  exit 1
fi
if [[ "$FOLLOWUP_TABLE_NAME" != "${ENVIRONMENT_NAME}-realestateflow-followup-"* ]]; then
  echo "ERROR: FOLLOWUP_TABLE_NAME ('$FOLLOWUP_TABLE_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-followup-'"
  exit 1
fi
if [ "$ARTIFACT_BUCKET" != "${ENVIRONMENT_NAME}-realestateflow-artifacts" ]; then
  echo "ERROR: ARTIFACT_BUCKET ('$ARTIFACT_BUCKET') must be '${ENVIRONMENT_NAME}-realestateflow-artifacts'"
  exit 1
fi

# The custom domain differs per environment and getting it backwards points a
# prod service at the nonprod domain. Check it rather than trusting the file.
if ! validate_custom_domain_vars; then
  echo "Fix the custom-domain settings in $ENV_FILE."
  exit 1
fi
for var in FOLLOWUP_API_DOMAIN_NAME CRM_INTERNAL_API_DOMAIN_NAME AI_CALLING_SERVICE_DOMAIN_NAME; do
  if [ "$ENVIRONMENT_NAME" = "prod" ] && [ "${!var}" != "services-api.realestateflow.in" ]; then
    echo "ERROR: prod $var must be services-api.realestateflow.in (got '${!var}')"
    exit 1
  fi
  if [ "$ENVIRONMENT_NAME" = "dev" ] && [ "${!var}" != "services-api.cloudberrysolutions.in" ]; then
    echo "ERROR: dev $var must be services-api.cloudberrysolutions.in (got '${!var}')"
    exit 1
  fi
done

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)

echo "Deploy target:  $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo "Region:         $AWS_REGION"
echo "Profile:        $AWS_PROFILE"
echo "Stack:          $STACK_NAME"
echo "Table:          $FOLLOWUP_TABLE_NAME"
echo "CRM API:        https://${CRM_INTERNAL_API_DOMAIN_NAME}/${CRM_INTERNAL_API_BASE_PATH}"
echo "AI calling:     https://${AI_CALLING_SERVICE_DOMAIN_NAME}/${AI_CALLING_SERVICE_BASE_PATH}"
echo "Public API:     https://${FOLLOWUP_API_DOMAIN_NAME}/${FOLLOWUP_API_BASE_PATH}"
echo "Dispatch:       ${DISPATCH_SCHEDULE_EXPRESSION:-rate(5 minutes)}"
echo ""

CALLER_ACCOUNT="$("$AWS_BIN" sts get-caller-identity "${AWS_ARGS[@]}" --query Account --output text)"
echo "AWS account:    $CALLER_ACCOUNT"
echo ""

TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

# -----------------------------------------------------------------------------
# 1. Tests
# -----------------------------------------------------------------------------
echo "[1/7] Running tests..."
cd "$PROJECT_DIR"
"$NPM_BIN" test

# -----------------------------------------------------------------------------
# 2. Install production dependencies
# -----------------------------------------------------------------------------
echo "[2/7] Installing production dependencies..."
"$NPM_BIN" ci --omit=dev --no-audit --no-fund 2>/dev/null || "$NPM_BIN" install --omit=dev --no-audit --no-fund

# -----------------------------------------------------------------------------
# 3. Package the Lambda bundle
# -----------------------------------------------------------------------------
echo "[3/7] Packaging function.zip..."
rm -f "$PROJECT_DIR/function.zip"
zip -r -q -1 function.zip \
  node_modules package.json src/ \
  -x "node_modules/.cache/*" "node_modules/**/*.ts" "node_modules/**/*.map" \
     "node_modules/**/*.d.ts" "node_modules/**/*.md" "node_modules/**/README*" \
     "node_modules/**/CHANGELOG*" "node_modules/**/LICENSE*" \
     "node_modules/**/test/*" "node_modules/**/tests/*" "node_modules/**/__tests__/*" \
     "node_modules/**/docs/*" "node_modules/**/examples/*" "node_modules/**/.github/*" \
     "src/**/*.test.js"

for entry in src/lambda-api.js src/lambda-worker.js; do
  if ! unzip -l "$PROJECT_DIR/function.zip" | grep -c "$entry" >/dev/null; then
    echo "ERROR: $entry missing from function.zip - refusing to deploy"
    exit 1
  fi
done

ZIP_BYTES=$(wc -c < "$PROJECT_DIR/function.zip")
echo "      function.zip: $((ZIP_BYTES / 1024)) KB"

# -----------------------------------------------------------------------------
# 4. Upload code + template to the artifact bucket
# -----------------------------------------------------------------------------
S3_KEY="${ARTIFACT_PREFIX}/function-${TIMESTAMP}.zip"
echo "[4/7] Uploading to s3://${ARTIFACT_BUCKET}/${S3_KEY}..."
"$AWS_BIN" s3 cp "$PROJECT_DIR/function.zip" "s3://${ARTIFACT_BUCKET}/${S3_KEY}" "${AWS_ARGS[@]}"

TEMPLATE_KEY="${ARTIFACT_PREFIX}/cfn-followup.yaml"
"$AWS_BIN" s3 cp "$TEMPLATE_FILE" "s3://${ARTIFACT_BUCKET}/${TEMPLATE_KEY}" "${AWS_ARGS[@]}"

# Record exactly what this run uploaded so the CI/CD wrapper can build a release
# manifest without recomputing a timestamp that would no longer match.
cat > "$SCRIPT_DIR/.last-deploy-artifacts.json" <<EOF
{
  "artifactBucket": "${ARTIFACT_BUCKET}",
  "codeS3Key": "${S3_KEY}",
  "templateS3Key": "${TEMPLATE_KEY}",
  "environment": "${ENVIRONMENT_NAME}",
  "stackName": "${STACK_NAME}",
  "timestamp": "${TIMESTAMP}"
}
EOF

# -----------------------------------------------------------------------------
# 5. Generate cfn-params.json (build artifact - regenerated every run)
# -----------------------------------------------------------------------------
echo "[5/7] Generating infra/cfn-params.json..."
PARAMS_FILE="$SCRIPT_DIR/cfn-params.json"
node "$SCRIPT_DIR/lib/generate-cfn-params.js" "$PARAMS_FILE" "$ENVIRONMENT_NAME" "$S3_KEY"

echo "      Cross-checking params against the template..."
node -e '
  const fs = require("fs");
  const tpl = fs.readFileSync(process.argv[1], "utf8");
  const params = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).map(p => p.ParameterKey);
  const section = tpl.split(/^(?:Rules|Conditions|Resources):/m)[0].split(/^Parameters:/m)[1] || "";
  const declared = [...section.matchAll(/^  ([A-Za-z0-9]+):\r?$/gm)].map(m => m[1]);
  const missing = declared.filter(d => !params.includes(d));
  const extra = params.filter(p => !declared.includes(p));
  if (extra.length) {
    console.error("      ERROR: params not in template (deploy would hard-fail): " + extra.join(", "));
    process.exit(1);
  }
  if (missing.length) {
    console.error("      WARNING: template params never passed (will use Default): " + missing.join(", "));
  }
  console.log("      OK: " + params.length + " params, " + declared.length + " declared");
' "$TEMPLATE_FILE" "$PARAMS_FILE"

# -----------------------------------------------------------------------------
# 6. Deploy the CloudFormation stack
# -----------------------------------------------------------------------------
echo "[6/7] Deploying stack $STACK_NAME..."

PARAM_ARRAY=()
while IFS= read -r line; do
  [ -n "$line" ] && PARAM_ARRAY+=("$line")
done < <(node -e '
  const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  console.log(p.map(x => x.ParameterKey + "=" + x.ParameterValue).join("\n"));
' "$PARAMS_FILE")

"$AWS_BIN" cloudformation deploy \
  --template-file "$(winpath "$TEMPLATE_FILE")" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --tags Environment="$ENVIRONMENT_NAME" Service=realestateflow-followup \
  --parameter-overrides "${PARAM_ARRAY[@]}" \
  "${AWS_ARGS[@]}"

# -----------------------------------------------------------------------------
# 7. Force an API Gateway stage deployment and print outputs
# -----------------------------------------------------------------------------
echo "[7/7] Forcing API Gateway stage deployment..."
API_ID="$("$AWS_BIN" cloudformation describe-stacks --stack-name "$STACK_NAME" "${AWS_ARGS[@]}" \
  --query "Stacks[0].Outputs[?OutputKey=='FollowupApiId'].OutputValue" --output text)"
if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
  "$AWS_BIN" apigateway create-deployment \
    --rest-api-id "$API_ID" \
    --stage-name "${API_STAGE_NAME:-v1}" \
    --description "deploy.sh $TIMESTAMP" \
    "${AWS_ARGS[@]}" >/dev/null
  echo "      Stage ${API_STAGE_NAME:-v1} redeployed."
fi

echo ""
echo "============================================="
echo " Deploy complete"
echo "============================================="
"$AWS_BIN" cloudformation describe-stacks --stack-name "$STACK_NAME" "${AWS_ARGS[@]}" \
  --query "Stacks[0].Outputs" --output table

cat <<EOF

The CRM reaches this service at
  https://${FOLLOWUP_API_DOMAIN_NAME}/${FOLLOWUP_API_BASE_PATH}
Set FOLLOWUP_SERVICE_DOMAIN_NAME / FOLLOWUP_SERVICE_BASE_PATH in server/.env.${DEPLOY_ENV}
to those two values (see docs/RUNBOOK.md).
EOF

echo ""
echo "Cleaning up function.zip..."
rm -f "$PROJECT_DIR/function.zip"
echo "Done."
