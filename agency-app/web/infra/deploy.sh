#!/bin/bash
set -euo pipefail

# =============================================================================
# RealtyFlow CRM Frontend — Deployment Script (S3 + CloudFront)
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod>
#   Loads .env.dev or .env.prod (never a plain .env) and forces ENV to match
#   the argument, so every physical resource this stack creates is named
#   <dev|prod>-realestateflow-crm-frontend-*, matching the naming already
#   live on prod-realestateflow-networking-common. dev and prod are
#   separate stacks, separate S3 buckets, separate CloudFront distributions.
#
# Unlike the Lambda services in this repo, this is a static-site deploy:
# build -> deploy the S3+CloudFront stack -> sync dist/ -> invalidate cache.
# There's no "function.zip" — the live S3 bucket content IS the deployed
# artifact, and S3 versioning (enabled on the bucket in cfn-frontend.yaml)
# is the content-level rollback mechanism.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/api-domain-guard.sh"

# -----------------------------------------------------------------------------
# Windows Git Bash compatibility
# -----------------------------------------------------------------------------
OS_UNAME="$(uname -s || echo '')"

NPM_BIN="npm"
AWS_BIN="aws"

case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v npm.cmd >/dev/null 2>&1; then
      NPM_BIN="npm.cmd"
    fi
    if command -v aws.exe >/dev/null 2>&1; then
      AWS_BIN="aws.exe"
    fi
    ;;
esac

if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
  echo "ERROR: $NPM_BIN not found in PATH"
  exit 1
fi

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi

echo "============================================="
echo " RealtyFlow CRM Frontend — Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Require an explicit dev|prod argument and load the matching env file
# -----------------------------------------------------------------------------
# --skip-build / --skip-cfn: this is a static site with two independent
# "expensive step" axes (see docs/proposals/config-only-deploy/context.md's
# category 1 vs category 3) — a pure CFN parameter change (custom domain,
# price class, WAF) never needs npm ci/vite build/s3 sync, and a pure
# VITE_*-only change (baked into the JS bundle at build time) never needs a
# CFN update. infra/config-deploy.sh and infra/content-deploy.sh are the
# gated entry points for each; this script itself stays the source of truth
# for both step sequences so neither has to duplicate them.
SKIP_BUILD=false
SKIP_CFN=false
POSITIONAL_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --skip-cfn) SKIP_CFN=true ;;
    *) POSITIONAL_ARGS+=("$arg") ;;
  esac
done
if [ "$SKIP_BUILD" = true ] && [ "$SKIP_CFN" = true ]; then
  echo "ERROR: --skip-build and --skip-cfn together would do nothing — pick at most one."
  exit 1
fi

DEPLOY_ENV="${POSITIONAL_ARGS[0]:-}"
if [ "$DEPLOY_ENV" != "dev" ] && [ "$DEPLOY_ENV" != "prod" ]; then
  echo "ERROR: Usage: $0 <dev|prod> [--skip-build|--skip-cfn]"
  echo "  e.g. ./infra/deploy.sh dev"
  echo "       ./infra/deploy.sh prod"
  exit 1
fi

ENV_FILE="$PROJECT_DIR/.env.${DEPLOY_ENV}"

# -----------------------------------------------------------------------------
# 1. Load and validate the environment file
# -----------------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "Copy .env.${DEPLOY_ENV}.sample to $ENV_FILE and fill in the values."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# The CLI argument is the source of truth, not whatever the env file happens
# to set — this is what stops a dev deploy from silently reusing prod's
# bucket/distribution names (or vice versa) if the file drifts.
ENV="$DEPLOY_ENV"

echo "Deploy target: $DEPLOY_ENV (env file: $(basename "$ENV_FILE"))"
echo ""

REQUIRED_VARS=(
  AWS_REGION
  SERVICE_NAME
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: Required env var $var is not set in $ENV_FILE"
    exit 1
  fi
done

if [[ "$SERVICE_NAME" != realestateflow-* ]]; then
  echo "ERROR: SERVICE_NAME ('$SERVICE_NAME') must start with 'realestateflow-' — set it in $ENV_FILE"
  exit 1
fi

# API endpoints baked into the bundle must be custom domain + base path —
# never a raw execute-api URL (see lib/api-domain-guard.sh).
validate_api_domain_vars "$ENV_FILE"

# BucketName: derived from the env-first convention by default
# (<env>-realestateflow-crm-frontend), overridable via FRONTEND_S3_BUCKET_NAME
# for a one-off/legacy bucket name — but the default is what every new
# environment should use.
BUCKET_NAME="${FRONTEND_S3_BUCKET_NAME:-${ENV}-${SERVICE_NAME}}"
STACK_NAME="${ENV}-${SERVICE_NAME}-stack"
PRICE_CLASS="${FRONTEND_PRICE_CLASS:-PriceClass_200}"
CUSTOM_DOMAIN_NAME="${FRONTEND_CUSTOM_DOMAIN_NAME:-}"
ACM_CERTIFICATE_ARN="${FRONTEND_ACM_CERTIFICATE_ARN:-}"
HOSTED_ZONE_ID="${FRONTEND_HOSTED_ZONE_ID:-}"
WAF_WEB_ACL_ARN="${FRONTEND_WAF_WEB_ACL_ARN:-}"
# Optional — wires up the /insta/* CloudFront behavior. Set to the
# InstaFrontendBucketRegionalDomainName output of the
# <env>-realestateflow-insta-frontend stack (step 1 of the 3-step deploy
# order documented in cfn-insta-frontend.yaml). Leave blank if the insta
# frontend isn't deployed / doesn't need to be wired into this distribution.
INSTA_FRONTEND_BUCKET_DOMAIN_NAME="${INSTA_FRONTEND_BUCKET_DOMAIN_NAME:-}"

if [ -n "$CUSTOM_DOMAIN_NAME" ] && [ -z "$ACM_CERTIFICATE_ARN" ]; then
  echo "ERROR: FRONTEND_CUSTOM_DOMAIN_NAME is set but FRONTEND_ACM_CERTIFICATE_ARN is missing in $ENV_FILE (cert must be issued in us-east-1)"
  exit 1
fi

echo "Region:     $AWS_REGION"
echo "Stack:      $STACK_NAME"
echo "Bucket:     $BUCKET_NAME"
echo "Service:    $SERVICE_NAME"
echo "Env:        $ENV"
echo ""

# -----------------------------------------------------------------------------
# 2. Install dependencies and build (vite loads .env.<ENV> automatically via --mode)
# -----------------------------------------------------------------------------
DIST_DIR="$PROJECT_DIR/dist"
if [ "$SKIP_BUILD" = true ]; then
  echo "[1/6] Skipping npm ci (--skip-build)"
  echo "[2/6] Skipping vite build (--skip-build)"
else
  echo "[1/6] Installing dependencies..."
  cd "$PROJECT_DIR"
  "$NPM_BIN" ci

  echo "[2/6] Building frontend (vite build --mode $ENV)..."
  rm -rf "$DIST_DIR"
  npx vite build --mode "$ENV"

  if [ ! -d "$DIST_DIR" ]; then
    echo "ERROR: build output not found at $DIST_DIR"
    exit 1
  fi
fi

# -----------------------------------------------------------------------------
# 3. Generate cfn-params.json from .env (archival/rollback snapshot — the
#    actual deploy below passes parameter-overrides directly, this file is
#    never hand-edited and is regenerated fresh on every run)
# -----------------------------------------------------------------------------
echo "[3/6] Generating infra/cfn-params.json..."
compute_param_values
write_cfn_params_json "$SCRIPT_DIR/cfn-params.json"

# -----------------------------------------------------------------------------
# 4. Deploy CloudFormation stack (S3 + CloudFront)
# -----------------------------------------------------------------------------
PARAM_OVERRIDES=()
for key in "${PARAM_KEYS[@]}"; do
  PARAM_OVERRIDES+=("${key}=${PARAM_VALUES[$key]}")
done
if [ "$SKIP_CFN" = true ]; then
  echo "[4/6] Skipping CloudFormation deploy (--skip-cfn)"
else
  echo "[4/6] Deploying CloudFormation stack: $STACK_NAME..."
  "$AWS_BIN" cloudformation deploy \
    --template-file "$SCRIPT_DIR/cfn-frontend.yaml" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides "${PARAM_OVERRIDES[@]}" \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --no-fail-on-empty-changeset
fi

# -----------------------------------------------------------------------------
# 5. Resolve stack outputs and sync dist/ to S3
# -----------------------------------------------------------------------------
echo "[5/6] Resolving stack outputs..."
RESOLVED_BUCKET="$("$AWS_BIN" cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text --no-cli-pager)"
DISTRIBUTION_ID="$("$AWS_BIN" cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text --no-cli-pager)"
DISTRIBUTION_DOMAIN="$("$AWS_BIN" cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" --output text --no-cli-pager)"

if [ -z "$RESOLVED_BUCKET" ] || [ "$RESOLVED_BUCKET" = "None" ]; then
  RESOLVED_BUCKET="$BUCKET_NAME"
fi

if [ "$SKIP_BUILD" = true ]; then
  echo "Skipping dist/ sync (--skip-build) — no content changed."
else
  echo "Syncing dist/ to s3://${RESOLVED_BUCKET}..."
  # Hashed, immutable build assets: cache aggressively
  "$AWS_BIN" s3 sync "$DIST_DIR" "s3://${RESOLVED_BUCKET}" \
    --region "$AWS_REGION" \
    --delete \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html" \
    --no-cli-pager

  # index.html: never cache, so a new deploy is visible immediately
  if [ -f "$DIST_DIR/index.html" ]; then
    "$AWS_BIN" s3 cp "$DIST_DIR/index.html" "s3://${RESOLVED_BUCKET}/index.html" \
      --region "$AWS_REGION" \
      --cache-control "public,max-age=0,must-revalidate" \
      --no-cli-pager
  fi
fi

# -----------------------------------------------------------------------------
# 6. Invalidate CloudFront cache — only meaningful when content actually
#    changed (skipped entirely under --skip-build, where dist/ was never
#    re-synced, so there's nothing stale in the edge cache to bust).
# -----------------------------------------------------------------------------
if [ "$SKIP_BUILD" = true ]; then
  echo "[6/6] Skipping CloudFront invalidation (--skip-build, no content changed)"
elif [ -n "$DISTRIBUTION_ID" ] && [ "$DISTRIBUTION_ID" != "None" ]; then
  echo "[6/6] Invalidating CloudFront distribution $DISTRIBUTION_ID..."
  "$AWS_BIN" cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --no-cli-pager >/dev/null
fi

echo ""
echo "============================================="
echo " Deploy complete!"
echo "============================================="
echo "Environment:  $ENV"
echo "Bucket:       $RESOLVED_BUCKET"
echo "Distribution: $DISTRIBUTION_ID"
if [ -n "$DISTRIBUTION_DOMAIN" ] && [ "$DISTRIBUTION_DOMAIN" != "None" ]; then
  echo "URL:          https://$DISTRIBUTION_DOMAIN"
fi
if [ -n "$CUSTOM_DOMAIN_NAME" ]; then
  echo "Custom URL:   https://$CUSTOM_DOMAIN_NAME"
fi
