#!/bin/bash
set -euo pipefail

# =============================================================================
# AI Calling Service - Deployment Script
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#
# Loads agency-app/ai-calling/.env.dev or .env.prod (never a plain .env) and FORCES
# ENVIRONMENT_NAME to match the CLI argument, so a stale env file can never
# silently deploy dev as prod or vice versa. dev and prod are separate stacks
# with separate physical resource names - no shared state.
#
# Every physical resource is named <env>-realestateflow-aicalling-<resource>
# (env first), matching prod-realestateflow-networking-common.
#
# Secrets (Exotel / ElevenLabs / CRM api key) are passed as NoEcho CFN
# parameters into a Secrets Manager secret. The Lambda resolves them at cold
# start from SECRETS_ARN - they are never written into the function's
# environment variables, where anyone with GetFunctionConfiguration could read
# them back.
#
# infra/cfn-params.json is a BUILD ARTIFACT, regenerated fresh on every run.
# It contains real secret values. Never hand-edit it; it is gitignored.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/custom-domain-guard.sh"
TEMPLATE_FILE="$SCRIPT_DIR/cfn-ai-calling.yaml"

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

# AWS CLI v2 on Windows is a native process and cannot read /d/... paths, so any
# file:// URL or --template-file has to be handed a D:/... path instead.
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
echo " AI Calling Service - Deploy"
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
  echo "Copy agency-app/ai-calling/.env.example to $ENV_FILE and fill in the values."
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
  AI_CALLING_TABLE_NAME
  AI_CALLING_KNOWLEDGE_BUCKET
  AI_CALLING_RECORDINGS_BUCKET
  CRM_INTERNAL_API_DOMAIN_NAME
  CRM_INTERNAL_API_BASE_PATH
  AI_CALLING_API_DOMAIN_NAME
  AI_CALLING_API_BASE_PATH
  ALLOWED_ORIGINS
  ELEVENLABS_AGENT_ID
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
# actually comes from. There are no defaults and no placeholders for these -
# an unset secret fails the deploy rather than shipping a broken stack.
SECRET_VARS=(
  CRM_INTERNAL_API_KEY
  EXOTEL_API_KEY
  EXOTEL_API_TOKEN
  EXOTEL_SID
  ELEVENLABS_API_KEY
  ELEVENLABS_WEBHOOK_SECRET
  SERVER_TOOL_API_KEY
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
  CRM_INTERNAL_API_KEY       must equal agency-app/api/.env.${DEPLOY_ENV}'s AI_CALLING_INTERNAL_API_KEY
                             (the CRM's AiCallingInternalApiKey parameter)
  EXOTEL_API_KEY / _TOKEN    Exotel dashboard -> Settings -> API credentials
  EXOTEL_SID                 Exotel account SID
  ELEVENLABS_API_KEY         ElevenLabs dashboard -> Developers -> API keys
  ELEVENLABS_WEBHOOK_SECRET  ElevenLabs dashboard -> the agent's post-call webhook
  SERVER_TOOL_API_KEY        generate one, e.g. \`openssl rand -hex 32\`, and set the
                             same value as the server tool's secret header in the
                             ElevenLabs dashboard
  CRM_CALLER_API_KEY         generate one, e.g. \`openssl rand -hex 32\`, and set the
                             same value in agency-app/api/.env.${DEPLOY_ENV} so the CRM
                             backend can call this service's management routes

These are never committed - $ENV_FILE is gitignored.
EOF
  exit 1
fi

# Naming convention guards. Catch a copy-pasted env file before it creates a
# stack that matches nothing else in the account.
if [[ "$STACK_NAME" != "${ENVIRONMENT_NAME}-realestateflow-"* ]]; then
  echo "ERROR: STACK_NAME ('$STACK_NAME') must start with '${ENVIRONMENT_NAME}-realestateflow-'"
  exit 1
fi
for name_var in AI_CALLING_TABLE_NAME AI_CALLING_KNOWLEDGE_BUCKET AI_CALLING_RECORDINGS_BUCKET; do
  if [[ "${!name_var}" != "${ENVIRONMENT_NAME}-realestateflow-aicalling-"* ]]; then
    echo "ERROR: $name_var ('${!name_var}') must start with '${ENVIRONMENT_NAME}-realestateflow-aicalling-'"
    exit 1
  fi
done

# The custom domain differs per environment and getting it backwards points a
# prod service at the nonprod domain. Check it rather than trusting the file.
if ! validate_custom_domain_vars; then
  echo "Fix the custom-domain settings in $ENV_FILE."
  exit 1
fi
for var in AI_CALLING_API_DOMAIN_NAME CRM_INTERNAL_API_DOMAIN_NAME; do
  if [ "$ENVIRONMENT_NAME" = "prod" ] && [ "${!var}" != "services-api.realestateflow.in" ]; then
    echo "ERROR: prod $var must be services-api.realestateflow.in (got '${!var}')"
    exit 1
  fi
  if [ "$ENVIRONMENT_NAME" = "dev" ] && [ "${!var}" != "services-api.cloudberrysolutions.in" ]; then
    echo "ERROR: dev $var must be services-api.cloudberrysolutions.in (got '${!var}')"
    exit 1
  fi
done

# Exotel does not sign its webhooks, so the source-IP allowlist is the only
# thing standing between /webhooks/exotel/status and a forged call-status event.
# The Lambda fails closed on this in prod: blank here means every real Exotel
# webhook is rejected too, so call status never updates and no call ever
# completes. Block that at deploy time rather than discovering it on a live call.
if [ "$ENVIRONMENT_NAME" = "prod" ] && [ -z "${EXOTEL_WEBHOOK_IPS:-}" ]; then
  echo "ERROR: EXOTEL_WEBHOOK_IPS is empty in $ENV_FILE."
  echo "       Webhook IP validation fails closed in prod, so a blank list rejects"
  echo "       every Exotel call-status webhook - calls would never leave 'ringing'."
  echo "       Fill it with Exotel's documented webhook source IP ranges"
  echo "       (comma-separated) and deploy again."
  exit 1
fi

# ElevenLabsAgentPhoneNumberId can only be obtained by importing the Exotel
# ExoPhone in the ElevenLabs dashboard (Conversational AI -> Phone Numbers ->
# Import number -> From Exotel), which itself requires Exotel's "Voicebot
# Applet" feature to be enabled on the account first (external Exotel support
# ticket, not something this repo/AWS side can unblock). Blank here means the
# stack deploys with everything except actual outbound calling - POST
# /v1/convai/exotel/outbound-call will fail at runtime until it's filled in
# and the stack redeployed, but every other resource (API Gateway, DynamoDB,
# S3, the Lambda itself, webhooks) comes up fine, so it's not worth blocking
# a non-prod deploy on. It fails closed in prod - shipping a paid, live
# environment with no working call path is not "deployed", it's broken.
if [ "$ENVIRONMENT_NAME" = "prod" ] && [ -z "${ELEVENLABS_AGENT_PHONE_NUMBER_ID:-}" ]; then
  echo "ERROR: ELEVENLABS_AGENT_PHONE_NUMBER_ID is empty in $ENV_FILE."
  echo "       Required in prod - without it POST /v1/convai/exotel/outbound-call"
  echo "       has no phone number to bridge audio through, so no call can ever be"
  echo "       placed. Import the Exotel ExoPhone in the ElevenLabs dashboard"
  echo "       (Conversational AI -> Phone Numbers -> Import number -> From Exotel)"
  echo "       and set the resulting id here, then deploy again."
  exit 1
fi
if [ -z "${ELEVENLABS_AGENT_PHONE_NUMBER_ID:-}" ]; then
  echo "WARNING: ELEVENLABS_AGENT_PHONE_NUMBER_ID is empty - proceeding anyway"
  echo "         (allowed outside prod). Every resource will deploy, but"
  echo "         POST /v1/convai/exotel/outbound-call will fail at runtime until"
  echo "         this is filled in and the stack redeployed."
fi

# Click-to-call is optional in every environment: blank simply turns the
# feature off (the route answers 503 click_to_call_not_configured) and AI
# calling is unaffected, so this is a warning in prod too, never a block.
if [ -z "${EXOTEL_CALLER_ID:-}" ]; then
  echo "WARNING: EXOTEL_CALLER_ID is empty - click-to-call is disabled."
  echo "         POST /api/ai-calling/calls/connect will answer 503 until the"
  echo "         ExoPhone (E.164) is set here and the stack redeployed."
fi

AWS_ARGS=(--region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager)

echo "Deploy target:  $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo "Region:         $AWS_REGION"
echo "Profile:        $AWS_PROFILE"
echo "Stack:          $STACK_NAME"
echo "Table:          $AI_CALLING_TABLE_NAME"
echo "Knowledge:      $AI_CALLING_KNOWLEDGE_BUCKET"
echo "Recordings:     $AI_CALLING_RECORDINGS_BUCKET"
echo "CRM API:        https://${CRM_INTERNAL_API_DOMAIN_NAME}/${CRM_INTERNAL_API_BASE_PATH}"
echo "Public API:     https://${AI_CALLING_API_DOMAIN_NAME}/${AI_CALLING_API_BASE_PATH} (WEBHOOK_BASE_URL)"
echo "ElevenLabs:     agent=$ELEVENLABS_AGENT_ID phone=$ELEVENLABS_AGENT_PHONE_NUMBER_ID"
echo "Click-to-call:  CallerId=${EXOTEL_CALLER_ID:-<blank - disabled>}"
echo ""

# Confirm which account we are actually about to deploy into. This repo has
# historically had env files pointing at the wrong account, so print it rather
# than assume it.
CALLER_ACCOUNT="$("$AWS_BIN" sts get-caller-identity "${AWS_ARGS[@]}" --query Account --output text)"
echo "AWS account:    $CALLER_ACCOUNT"
echo ""

TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")

# -----------------------------------------------------------------------------
# 1. Install production dependencies
# -----------------------------------------------------------------------------
echo "[1/6] Installing production dependencies..."
cd "$PROJECT_DIR"
"$NPM_BIN" ci --omit=dev --no-audit --no-fund 2>/dev/null || "$NPM_BIN" install --omit=dev --no-audit --no-fund

# -----------------------------------------------------------------------------
# 2. Package the Lambda bundle
# -----------------------------------------------------------------------------
echo "[2/6] Packaging function.zip..."
rm -f "$PROJECT_DIR/function.zip"
cd "$PROJECT_DIR"
zip -r -q -1 function.zip \
  node_modules package.json src/ \
  -x "node_modules/.cache/*" "node_modules/**/*.ts" "node_modules/**/*.map" \
     "node_modules/**/*.d.ts" "node_modules/**/*.md" "node_modules/**/README*" \
     "node_modules/**/CHANGELOG*" "node_modules/**/LICENSE*" \
     "node_modules/**/test/*" "node_modules/**/tests/*" "node_modules/**/__tests__/*" \
     "node_modules/**/docs/*" "node_modules/**/examples/*" "node_modules/**/.github/*" \
     "src/**/*.test.js"

# The handler is src/lambda-handler.handler - a missing src/ directory produces
# an ERR_MODULE_NOT_FOUND at init that is far easier to catch here.
# grep -c (not -q): -q exits at the first match, unzip then dies of SIGPIPE,
# and with pipefail the whole check reports "missing" even when it is present.
if ! unzip -l "$PROJECT_DIR/function.zip" | grep -c "src/lambda-handler.js" >/dev/null; then
  echo "ERROR: src/lambda-handler.js missing from function.zip - refusing to deploy"
  exit 1
fi

ZIP_BYTES=$(wc -c < "$PROJECT_DIR/function.zip")
echo "      function.zip: $((ZIP_BYTES / 1024)) KB"

# -----------------------------------------------------------------------------
# 3. Upload code + template to the artifact bucket
# -----------------------------------------------------------------------------
S3_KEY="${ARTIFACT_PREFIX}/function-${TIMESTAMP}.zip"
echo "[3/6] Uploading to s3://${ARTIFACT_BUCKET}/${S3_KEY}..."
"$AWS_BIN" s3 cp "$PROJECT_DIR/function.zip" "s3://${ARTIFACT_BUCKET}/${S3_KEY}" "${AWS_ARGS[@]}"

TEMPLATE_KEY="${ARTIFACT_PREFIX}/cfn-ai-calling.yaml"
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
# 4. Generate cfn-params.json (build artifact - regenerated every run)
# -----------------------------------------------------------------------------
echo "[4/6] Generating infra/cfn-params.json..."
PARAMS_FILE="$SCRIPT_DIR/cfn-params.json"
# Written via node so secret values are JSON-escaped rather than pasted raw into
# a heredoc, where a quote or backslash would produce invalid JSON. Shared with
# infra/config-deploy.sh — see lib/generate-cfn-params.js's header comment.
node "$SCRIPT_DIR/lib/generate-cfn-params.js" "$PARAMS_FILE" "$ENVIRONMENT_NAME" "$S3_KEY"

# Every template Parameter must appear above, or it silently falls back to its
# Default and the env file cannot override it. Check it rather than trusting it.
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
# 5. Deploy the CloudFormation stack
# -----------------------------------------------------------------------------
echo "[5/6] Deploying stack $STACK_NAME..."

# Read into an array (one Key=Value per line) rather than a single space-joined
# string, so a value containing a space cannot split into two arguments.
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
  --tags Environment="$ENVIRONMENT_NAME" Service=realestateflow-aicalling \
  --parameter-overrides "${PARAM_ARRAY[@]}" \
  "${AWS_ARGS[@]}"

# -----------------------------------------------------------------------------
# 6. Force an API Gateway stage deployment and print outputs
# -----------------------------------------------------------------------------
echo "[6/6] Forcing API Gateway stage deployment..."
API_ID="$("$AWS_BIN" cloudformation describe-stacks --stack-name "$STACK_NAME" "${AWS_ARGS[@]}" \
  --query "Stacks[0].Outputs[?OutputKey=='AICallingApiId'].OutputValue" --output text)"
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

WEBHOOK_BASE_URL (set on the Lambda by the stack) is
  https://${AI_CALLING_API_DOMAIN_NAME}/${AI_CALLING_API_BASE_PATH}
Register ElevenLabs server tools / post-call webhook and Exotel callbacks
against that URL (see elevenlabs-agent-tools.md).
EOF

echo ""
echo "Cleaning up function.zip..."
rm -f "$PROJECT_DIR/function.zip"
echo "Done."
