#!/bin/bash
set -euo pipefail

# =============================================================================
# RealEstateFlow Homes (marketplace-web) — Deployment Script (S3 + CloudFront)
# =============================================================================
# Usage: ./infra/deploy.sh <dev|prod> [--skip-build|--skip-cfn]
#   Loads .env.dev or .env.prod (never a plain .env) and forces ENV to match
#   the argument, so every physical resource is named
#   <dev|prod>-realestateflow-marketplace-web-*. dev and prod are separate
#   stacks, separate buckets, separate CloudFront distributions.
#
# Static-site deploy: build -> deploy the S3+CloudFront stack -> sync dist/
# -> invalidate cache. The live S3 bucket content IS the deployed artifact;
# bucket versioning (cfn-marketplace-web.yaml) is the content-level rollback.
#
# --skip-build : pure CFN-parameter change (domain, cert, price class, WAF) —
#                no npm ci / vite build / s3 sync. Gated by infra/config-deploy.sh.
# --skip-cfn   : pure VITE_*-only change — rebuild + re-sync, no CFN update.
#                Gated by infra/content-deploy.sh.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/params.sh"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/env-guard.sh"

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

# winpath <path> — Git Bash /c/... -> C:/... for tools that need a native path
winpath() {
  case "$OS_UNAME" in
    MINGW*|MSYS*|CYGWIN*)
      if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi
      ;;
    *) printf '%s' "$1" ;;
  esac
}

if ! command -v "$NPM_BIN" >/dev/null 2>&1; then
  echo "ERROR: $NPM_BIN not found in PATH"
  exit 1
fi

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi

echo "============================================="
echo " RealEstateFlow Homes (marketplace-web) — Deploy"
echo "============================================="

# -----------------------------------------------------------------------------
# 0. Flags + explicit dev|prod argument
# -----------------------------------------------------------------------------
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

# CLI argument is the source of truth — stops a dev deploy from silently
# reusing prod's bucket/distribution names if the file drifts.
ENV="$DEPLOY_ENV"

# Optional named profile — exported so every aws call below picks it up.
if [ -n "${AWS_PROFILE:-}" ]; then
  export AWS_PROFILE
else
  unset AWS_PROFILE
fi

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

# API base URLs baked into the bundle must be https, no trailing slash;
# raw execute-api is a warning on dev, an error on prod (lib/env-guard.sh).
validate_web_env_vars "$ENV" "$ENV_FILE"

resolve_web_vars

echo "Region:     $AWS_REGION"
echo "Profile:    ${AWS_PROFILE:-(default)}"
echo "Stack:      $STACK_NAME"
echo "Bucket:     $BUCKET_NAME"
echo "Service:    $SERVICE_NAME"
echo "Env:        $ENV"
echo "Domain:     ${WEB_DOMAIN_NAME:-(none — *.cloudfront.net, domain is a placeholder)}"
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

  echo "[2/6] Building (vite build --mode $ENV)..."
  rm -rf "$DIST_DIR"
  npx vite build --mode "$ENV"

  if [ ! -d "$DIST_DIR" ]; then
    echo "ERROR: build output not found at $DIST_DIR"
    exit 1
  fi
fi

# -----------------------------------------------------------------------------
# 3. Generate cfn-params.json from .env (archival/rollback snapshot only)
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
    --template-file "$(winpath "$SCRIPT_DIR/cfn-marketplace-web.yaml")" \
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
DISTRIBUTION_DOMAIN="$("$AWS_BIN" cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='DistributionDomain'].OutputValue" --output text --no-cli-pager)"

if [ -z "$RESOLVED_BUCKET" ] || [ "$RESOLVED_BUCKET" = "None" ]; then
  RESOLVED_BUCKET="$BUCKET_NAME"
fi

if [ "$SKIP_BUILD" = true ]; then
  echo "Skipping dist/ sync (--skip-build) — no content changed."
else
  echo "Syncing dist/ to s3://${RESOLVED_BUCKET}..."
  # Hashed, immutable build assets: cache aggressively. index.html and the
  # unhashed public/ files (robots.txt, favicon.svg) are re-uploaded below with
  # short cache so a deploy is visible immediately.
  "$AWS_BIN" s3 sync "$(winpath "$DIST_DIR")" "s3://${RESOLVED_BUCKET}" \
    --region "$AWS_REGION" \
    --delete \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html" \
    --exclude "robots.txt" \
    --exclude "favicon.svg" \
    --no-cli-pager

  for f in index.html robots.txt favicon.svg; do
    if [ -f "$DIST_DIR/$f" ]; then
      "$AWS_BIN" s3 cp "$(winpath "$DIST_DIR/$f")" "s3://${RESOLVED_BUCKET}/$f" \
        --region "$AWS_REGION" \
        --cache-control "public,max-age=0,must-revalidate" \
        --no-cli-pager
    fi
  done
fi

# -----------------------------------------------------------------------------
# 6. Invalidate CloudFront cache — only when content actually changed
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
if [ -n "$WEB_DOMAIN_NAME" ]; then
  echo "Custom URL:   https://$WEB_DOMAIN_NAME"
fi
