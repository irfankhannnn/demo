#!/bin/bash
set -euo pipefail

# =============================================================================
# Instagram Solution backend - CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>              Deploy - records a new numbered build
#   ./deploy.sh list [dev|prod]         List recorded builds
#   ./deploy.sh show <build>            Print one build's manifest.json
#   ./deploy.sh rollback <env> <build>  Redeploy that build's saved template+params
#
# Every deploy delegates the actual build/CFN work to the real script,
# backend_insta_sol_ms/infra/deploy.sh. This wrapper's only job is release
# bookkeeping, matching the design already used by
# cfn-templates-cicd/{server,reality-flow-authentication,real-estate-crm-app}.
#
# Build numbers are GLOBAL (one counter across dev AND prod, not one per env) -
# "build 0007" is unambiguous on its own; which env it targeted is recorded
# inside the manifest, not encoded by which counter produced it.
#
# S3 layout under the env's artifact bucket:
#   <prefix>/builds/<build>/<env>/cfn-insta-sol-ms.yaml   permanent, never
#   <prefix>/builds/<build>/<env>/cfn-params.json          overwritten
#   <prefix>/builds/<build>/<env>/manifest.json
#
# Objects are tagged Branch, DeployDate, Status, CommitId. Status is only known
# after the delegate returns, so tagging is always a follow-up
# put-object-tagging call, never done at upload time.
#
# deploy-versions/ is a local index only and is gitignored. S3 is the durable,
# shareable source of truth.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../backend_insta_sol_ms" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSIONS_DIR="$SCRIPT_DIR/deploy-versions"
SERVICE_NAME="realestateflow-insta"

OS_UNAME="$(uname -s || echo '')"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

for bin in "$AWS_BIN" node; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "ERROR: $bin not found in PATH"
    exit 1
  fi
done

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh <dev|prod>              Deploy - records a new numbered build
  ./deploy.sh list [dev|prod]         List recorded builds (optionally filtered)
  ./deploy.sh show <build>            Print one build's manifest.json
  ./deploy.sh rollback <env> <build>  Redeploy that build's saved template+params
USAGE
}

require_env_arg() {
  local e="${1:-}"
  if [ "$e" != "dev" ] && [ "$e" != "prod" ]; then
    echo "ERROR: environment must be dev or prod (got: '${e}')"
    usage
    exit 1
  fi
}

require_build_arg() {
  local b="${1:-}"
  if ! [[ "$b" =~ ^[0-9]{4}$ ]]; then
    echo "ERROR: build number must be 4 digits, e.g. 0007 (got: '${b}')"
    exit 1
  fi
}

json_read() {
  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    let v = data;
    for (const k of process.argv[2].split(".")) { v = v == null ? v : v[k]; }
    if (v === undefined || v === null) process.exit(1);
    console.log(v);
  ' "$1" "$2"
}

# ---- git metadata (best-effort - never fails the script) --------------------
GIT_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
GIT_COMMIT_SHORT="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
GIT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
if [ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)" ]; then
  GIT_DIRTY="true"
else
  GIT_DIRTY="false"
fi
DEPLOYER="$(git config user.name 2>/dev/null || whoami 2>/dev/null || echo unknown)"
DEPLOY_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

next_build_number() {
  mkdir -p "$VERSIONS_DIR"
  local max=0
  shopt -s nullglob
  for d in "$VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -d "$d" ] || continue
    local n
    n="$(basename "$d")"
    n=$((10#$n))
    if [ "$n" -gt "$max" ]; then max="$n"; fi
  done
  shopt -u nullglob
  printf "%04d" $((max + 1))
}

load_env_file() {
  local env="$1"
  local f="$SERVICE_DIR/.env.${env}"
  if [ ! -f "$f" ]; then
    echo "ERROR: env file not found: $f"
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

tag_object() {
  # tag_object <bucket> <key> <status>
  "$AWS_BIN" s3api put-object-tagging \
    --bucket "$1" --key "$2" \
    --tagging "TagSet=[{Key=Branch,Value=${GIT_BRANCH}},{Key=DeployDate,Value=${DEPLOY_DATE}},{Key=Status,Value=$3},{Key=CommitId,Value=${GIT_COMMIT_SHORT}}]" \
    --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager >/dev/null 2>&1 || \
    echo "  WARNING: could not tag s3://$1/$2"
}

cmd_deploy() {
  local env="$1"
  require_env_arg "$env"
  load_env_file "$env"

  local build
  build="$(next_build_number)"
  local build_dir="$VERSIONS_DIR/$build"
  mkdir -p "$build_dir"

  echo "============================================="
  echo " Instagram backend - build $build -> $env"
  echo "============================================="
  echo "Branch:  $GIT_BRANCH ($GIT_COMMIT_SHORT, dirty=$GIT_DIRTY)"
  echo "Deployer: $DEPLOYER"
  echo ""

  if [ "$GIT_DIRTY" = "true" ]; then
    echo "NOTE: working tree is dirty. The recorded commit will not fully describe"
    echo "      what was deployed. This is allowed but worth knowing."
    echo ""
  fi

  local status="deployed"
  set +e
  ( cd "$SERVICE_DIR" && ./infra/deploy.sh "$env" )
  local rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    status="failed"
  fi

  # Snapshot template + params locally for instant rollback access.
  cp "$SERVICE_DIR/infra/cfn-insta-sol-ms.yaml" "$build_dir/" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/cfn-params.json" "$build_dir/" 2>/dev/null || true

  local code_key="unknown"
  if [ -f "$SERVICE_DIR/infra/.last-deploy-artifacts.json" ]; then
    code_key="$(json_read "$SERVICE_DIR/infra/.last-deploy-artifacts.json" codeS3Key || echo unknown)"
    cp "$SERVICE_DIR/infra/.last-deploy-artifacts.json" "$build_dir/artifacts.json"
  fi

  cat > "$build_dir/manifest.json" <<EOF
{
  "build": "${build}",
  "service": "${SERVICE_NAME}",
  "environment": "${env}",
  "stackName": "${STACK_NAME}",
  "status": "${status}",
  "deployDate": "${DEPLOY_DATE}",
  "deployer": "${DEPLOYER}",
  "gitBranch": "${GIT_BRANCH}",
  "gitCommit": "${GIT_COMMIT}",
  "gitCommitShort": "${GIT_COMMIT_SHORT}",
  "gitDirty": ${GIT_DIRTY},
  "artifactBucket": "${ARTIFACT_BUCKET}",
  "codeS3Key": "${code_key}",
  "awsRegion": "${AWS_REGION}",
  "awsProfile": "${AWS_PROFILE}"
}
EOF

  # Permanent, build+env-scoped archive in S3.
  local prefix="${ARTIFACT_PREFIX}/builds/${build}/${env}"
  for f in cfn-insta-sol-ms.yaml cfn-params.json manifest.json; do
    if [ -f "$build_dir/$f" ]; then
      "$AWS_BIN" s3 cp "$build_dir/$f" "s3://${ARTIFACT_BUCKET}/${prefix}/${f}" \
        --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager >/dev/null
      tag_object "$ARTIFACT_BUCKET" "${prefix}/${f}" "$status"
    fi
  done

  echo ""
  echo "Build $build recorded: status=$status"
  echo "  local:  $build_dir"
  echo "  s3:     s3://${ARTIFACT_BUCKET}/${prefix}/"

  if [ "$status" = "failed" ]; then
    echo ""
    echo "DEPLOY FAILED - the build is recorded with status=failed so the attempt"
    echo "is still auditable. Fix the error and deploy again."
    exit $rc
  fi
}

cmd_list() {
  local filter="${1:-}"
  mkdir -p "$VERSIONS_DIR"
  printf "%-7s %-6s %-10s %-22s %-10s %s\n" BUILD ENV STATUS DATE COMMIT STACK
  shopt -s nullglob
  for d in "$VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    local m="$d/manifest.json"
    [ -f "$m" ] || continue
    local e s dt c st
    e="$(json_read "$m" environment || echo '?')"
    if [ -n "$filter" ] && [ "$e" != "$filter" ]; then continue; fi
    s="$(json_read "$m" status || echo '?')"
    dt="$(json_read "$m" deployDate || echo '?')"
    c="$(json_read "$m" gitCommitShort || echo '?')"
    st="$(json_read "$m" stackName || echo '?')"
    printf "%-7s %-6s %-10s %-22s %-10s %s\n" "$(basename "$d")" "$e" "$s" "$dt" "$c" "$st"
  done
  shopt -u nullglob
}

cmd_show() {
  local build="${1:-}"
  require_build_arg "$build"
  local m="$VERSIONS_DIR/$build/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no local record for build $build"
    exit 1
  fi
  cat "$m"
}

cmd_rollback() {
  local env="${1:-}"
  local build="${2:-}"
  require_env_arg "$env"
  require_build_arg "$build"
  load_env_file "$env"

  local build_dir="$VERSIONS_DIR/$build"
  local tpl="$build_dir/cfn-insta-sol-ms.yaml"
  local prm="$build_dir/cfn-params.json"

  if [ ! -f "$tpl" ] || [ ! -f "$prm" ]; then
    echo "Local snapshot missing; pulling build $build from S3..."
    mkdir -p "$build_dir"
    local prefix="${ARTIFACT_PREFIX}/builds/${build}/${env}"
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/cfn-insta-sol-ms.yaml" "$tpl" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/cfn-params.json" "$prm" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
  fi

  local recorded_env
  recorded_env="$(json_read "$build_dir/manifest.json" environment 2>/dev/null || echo "$env")"
  if [ "$recorded_env" != "$env" ]; then
    echo "ERROR: build $build was deployed to '$recorded_env', not '$env'."
    echo "       Rolling a prod stack back to a dev build (or vice versa) would"
    echo "       point it at the wrong tables. Refusing."
    exit 1
  fi

  echo "Rolling $STACK_NAME back to build $build..."
  local overrides
  overrides="$(node -e '
    const p = require(process.argv[1]);
    console.log(p.map(x => x.ParameterKey + "=" + x.ParameterValue).join(" "));
  ' "$prm")"

  # shellcheck disable=SC2086
  "$AWS_BIN" cloudformation deploy \
    --template-file "$tpl" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset \
    --parameter-overrides $overrides \
    --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager

  echo "Rollback to build $build complete."
}

case "${1:-}" in
  dev|prod)  cmd_deploy "$1" ;;
  list)      cmd_list "${2:-}" ;;
  show)      cmd_show "${2:-}" ;;
  rollback)  cmd_rollback "${2:-}" "${3:-}" ;;
  ""|-h|--help|help) usage ;;
  *) echo "ERROR: unknown command '${1}'"; usage; exit 1 ;;
esac
