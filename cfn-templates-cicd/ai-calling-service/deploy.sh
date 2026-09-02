#!/bin/bash
set -euo pipefail

# =============================================================================
# AI Calling Service - CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>                   Deploy - records a new numbered build
#   ./deploy.sh list [dev|prod]              List recorded builds
#   ./deploy.sh show <build>                 Print one build's manifest.json
#   ./deploy.sh rollback-code <env> <build>  Point the Lambda at that build's
#                                             code (fast, code only - no CFN change)
#   ./deploy.sh rollback-full <env> <build>  Redeploy that build's saved template+
#                                             params (this also restores its code,
#                                             since LambdaCodeS3Key is a CFN param)
#
# Every deploy delegates the actual build/CFN work to the real script,
# ai-calling-service/infra/deploy.sh. This wrapper's only job is release
# bookkeeping, matching the design already used by
# cfn-templates-cicd/{server,reality-flow-authentication,backend_insta_sol_ms}.
#
# Build numbers are GLOBAL (one counter across dev AND prod, not one per env) -
# "build 0007" is unambiguous on its own; which env it targeted is recorded
# inside the manifest, not encoded by which counter produced it.
#
# S3 layout under the env's artifact bucket:
#   <prefix>/builds/<build>/<env>/cfn-ai-calling.yaml   permanent, never
#   <prefix>/builds/<build>/<env>/cfn-params.json        overwritten
#   <prefix>/builds/<build>/<env>/manifest.json
#
# Every object this script touches - the PRIMARY keys infra/deploy.sh actually
# uploaded and used for this deploy (read back from infra/.last-deploy-
# artifacts.json), AND the build-archive copies under builds/<build>/<env>/ -
# gets tagged Branch, DeployDate, Status, CommitId. Status is only known after
# the delegate returns, so tagging is always a follow-up put-object-tagging
# call, never done at upload time.
#
# NOTE: cfn-params.json carries real secret values (Exotel/ElevenLabs/CRM keys)
# because they are NoEcho CFN parameters feeding Secrets Manager. It is
# archived to S3 for rollback fidelity - that bucket must stay private, and the
# local copy under deploy-versions/ is gitignored.
#
# deploy-versions/ is a local index only and is gitignored. S3 is the durable,
# shareable source of truth.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../ai-calling-service" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSIONS_DIR="$SCRIPT_DIR/deploy-versions"
SERVICE_NAME="realestateflow-aicalling"
TEMPLATE_NAME="cfn-ai-calling.yaml"

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
  ./deploy.sh <dev|prod>                   Deploy - records a new numbered build
  ./deploy.sh list [dev|prod]              List recorded builds (optionally filtered)
  ./deploy.sh show <build>                 Print one build's manifest.json
  ./deploy.sh rollback-code <env> <build>  Roll back code only (fast, Lambda only)
  ./deploy.sh rollback-full <env> <build>  Roll back CFN template+params, then code
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
  echo " AI Calling Service - build $build -> $env"
  echo "============================================="
  echo "Branch:   $GIT_BRANCH ($GIT_COMMIT_SHORT, dirty=$GIT_DIRTY)"
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
  cp "$SERVICE_DIR/infra/$TEMPLATE_NAME" "$build_dir/" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/cfn-params.json" "$build_dir/" 2>/dev/null || true

  local code_key="unknown"
  local template_key="unknown"
  if [ -f "$SERVICE_DIR/infra/.last-deploy-artifacts.json" ]; then
    code_key="$(json_read "$SERVICE_DIR/infra/.last-deploy-artifacts.json" codeS3Key || echo unknown)"
    template_key="$(json_read "$SERVICE_DIR/infra/.last-deploy-artifacts.json" templateS3Key || echo unknown)"
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
  "templateS3Key": "${template_key}",
  "awsRegion": "${AWS_REGION}",
  "awsProfile": "${AWS_PROFILE}"
}
EOF

  # Tag the PRIMARY deployed artifacts - the actual keys infra/deploy.sh
  # uploaded and used for this deploy - not just the build-archive copies
  # below. This is what the checklist's "S3 object tagging" item actually
  # means: every object this script touches, not only its own archive copies.
  if [ "$code_key" != "unknown" ]; then
    tag_object "$ARTIFACT_BUCKET" "$code_key" "$status"
  fi
  if [ "$template_key" != "unknown" ]; then
    tag_object "$ARTIFACT_BUCKET" "$template_key" "$status"
  fi

  # Permanent, build+env-scoped archive in S3.
  local prefix="${ARTIFACT_PREFIX}/builds/${build}/${env}"
  for f in "$TEMPLATE_NAME" cfn-params.json manifest.json; do
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

verify_build_env() {
  # verify_build_env <build> <env> <manifest-file> - refuses to roll a prod
  # stack back to a dev build (or vice versa), same guard shape as
  # cfn-templates-cicd/{server,reality-flow-authentication,backend_insta_sol_ms}.
  local build="$1" env="$2" m="$3"
  local recorded_env
  recorded_env="$(json_read "$m" environment 2>/dev/null || echo "$env")"
  if [ "$recorded_env" != "$env" ]; then
    echo "ERROR: build $build was deployed to '$recorded_env', not '$env'."
    echo "       Rolling a prod stack back to a dev build (or vice versa) would"
    echo "       point it at the wrong tables and the wrong ElevenLabs agent."
    echo "       Refusing."
    exit 1
  fi
}

# =============================================================================
# rollback-code - fast path: point the Lambda at an old code artifact
# =============================================================================
cmd_rollback_code() {
  local env="${1:-}"
  local build="${2:-}"
  require_env_arg "$env"
  require_build_arg "$build"
  local build_dir="$VERSIONS_DIR/$build"
  local m="$build_dir/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no recorded build $build"
    exit 1
  fi
  verify_build_env "$build" "$env" "$m"
  load_env_file "$env"

  local bucket key
  bucket="$(json_read "$m" artifactBucket)"
  key="$(json_read "$m" codeS3Key)" || true

  if [ -z "${key:-}" ] || [ "$key" = "unknown" ]; then
    echo "ERROR: build $build has no recorded code key - cannot roll back code from it."
    exit 1
  fi

  echo "Checking archival status of s3://$bucket/$key ..."
  local storage_class
  storage_class="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$key" --region "$AWS_REGION" --profile "$AWS_PROFILE" --query StorageClass --output text 2>/dev/null || echo STANDARD)"
  [ "$storage_class" = "None" ] && storage_class="STANDARD"

  if [ "$storage_class" = "DEEP_ARCHIVE" ] || [ "$storage_class" = "GLACIER" ]; then
    cat <<EOF

This build's code is in $storage_class - it must be restored before Lambda can read it.
Run:
  $AWS_BIN s3api restore-object --bucket $bucket --key $key --region $AWS_REGION --profile $AWS_PROFILE \\
    --restore-request '{"Days":7,"GlacierJobParameters":{"Tier":"Standard"}}'

Then wait for the restore (~12h for Deep Archive Standard tier; check with):
  $AWS_BIN s3api head-object --bucket $bucket --key $key --region $AWS_REGION --profile $AWS_PROFILE --query Restore

Re-run this rollback-code command once that shows the restore is complete.
EOF
    exit 1
  fi

  echo "Rolling back code: s3://$bucket/$key"

  "$AWS_BIN" lambda update-function-code \
    --function-name "${env}-realestateflow-aicalling-lambda" \
    --s3-bucket "$bucket" \
    --s3-key "$key" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --no-cli-pager

  echo "Rolled back code to build $build ($key)."
}

# =============================================================================
# rollback-full - redeploy a build's saved CFN template + params (this also
# restores its code, since LambdaCodeS3Key is itself a CFN parameter)
# =============================================================================
cmd_rollback_full() {
  local env="${1:-}"
  local build="${2:-}"
  require_env_arg "$env"
  require_build_arg "$build"
  load_env_file "$env"

  local build_dir="$VERSIONS_DIR/$build"
  local tpl="$build_dir/$TEMPLATE_NAME"
  local prm="$build_dir/cfn-params.json"
  local m="$build_dir/manifest.json"
  local prefix="${ARTIFACT_PREFIX}/builds/${build}/${env}"

  if [ ! -f "$tpl" ] || [ ! -f "$prm" ]; then
    echo "Local snapshot missing; pulling build $build from S3..."
    mkdir -p "$build_dir"
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/${TEMPLATE_NAME}" "$tpl" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/cfn-params.json" "$prm" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
  fi

  # The env guard must run unconditionally, regardless of which files were
  # already cached locally - never let a missing-manifest-but-cached-snapshot
  # case skip straight to `cloudformation deploy` unchecked.
  if [ ! -f "$m" ]; then
    echo "Local manifest missing; pulling build $build's manifest from S3..."
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/manifest.json" "$m" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
  fi
  if [ ! -f "$m" ]; then
    echo "ERROR: no manifest for build $build found locally or in S3 - cannot verify which"
    echo "       environment it was deployed to. Refusing to roll back without that check."
    exit 1
  fi
  verify_build_env "$build" "$env" "$m"

  echo "Rolling $STACK_NAME back to build $build (template + params + code)..."

  # One Key=Value per line into an array, so a value containing a space cannot
  # split into two arguments.
  local overrides=()
  while IFS= read -r line; do
    [ -n "$line" ] && overrides+=("$line")
  done < <(node -e '
    const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    console.log(p.map(x => x.ParameterKey + "=" + x.ParameterValue).join("\n"));
  ' "$prm")

  "$AWS_BIN" cloudformation deploy \
    --template-file "$tpl" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset \
    --parameter-overrides "${overrides[@]}" \
    --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager

  echo "Rollback to build $build complete."
}

case "${1:-}" in
  dev|prod)       cmd_deploy "$1" ;;
  list)           cmd_list "${2:-}" ;;
  show)           cmd_show "${2:-}" ;;
  rollback-code)  cmd_rollback_code "${2:-}" "${3:-}" ;;
  rollback-full)  cmd_rollback_full "${2:-}" "${3:-}" ;;
  ""|-h|--help|help) usage ;;
  *) echo "ERROR: unknown command '${1}'"; usage; exit 1 ;;
esac
