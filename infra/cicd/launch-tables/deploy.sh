#!/bin/bash
set -euo pipefail

# =============================================================================
# RealEstateFlow Launch Tables — CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>              Deploy — records a new numbered build
#   ./deploy.sh list [dev|prod]          List recorded builds (optionally filtered)
#   ./deploy.sh show <build>             Print one build's manifest.json
#   ./deploy.sh rollback <env> <build>   Redeploy that build's saved CFN template
#
# Every deploy call delegates the actual CFN work to the real script:
# apps/crm/server/infra/deploy-launch-tables.sh. This wrapper's only job is release
# bookkeeping — see README.md in this folder for the full design.
#
# Unlike every other infra/cicd/<service> wrapper, this stack has no
# application code (no Lambda, no container) — it's pure
# AWS::DynamoDB::Table resources (apps/crm/server/infra/launch-tables-cfn.yaml). So
# there is no rollback-code path, and "rollback" here always means "redeploy
# an older template" (there's nothing else that can drift).
#
# Build numbers are GLOBAL (one counter across dev AND prod, not one per
# env) — "build #7" is unambiguous on its own; which env it targeted is
# recorded inside it, matching every other wrapper in this repo.
#
# S3 layout under the artifact bucket (dev-realestateflow-artifacts /
# prod-realestateflow-artifacts — one bucket per environment, per
# infra/cicd/common-infra/vpc-networking.yaml):
#   realestateflow-launch-tables/launch-tables-cfn-<hash>.yaml   content-
#     hashed, one new key per template change (same reasoning as auth's
#     nested-template key — see apps/crm/server/infra/deploy-launch-tables.sh)
#   realestateflow-launch-tables/builds/<build>/<env>/launch-tables-cfn.yaml
#     permanent, build+env-scoped archive copy (never overwritten)
#
# Every object this script touches gets S3 tags: Branch, DeployDate, Status
# (deployed|failed), CommitId. Status is only known after the delegate
# script returns, so tagging always happens as a follow-up
# put-object-tagging call, never at upload time.
#
# Build history also lives locally in ./deploy-versions/ — gitignored. S3 is
# the durable, shareable source of truth; this folder is a local index plus
# instant-access template snapshots for rollback.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../../apps/crm/server" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
VERSIONS_DIR="$SCRIPT_DIR/deploy-versions"

OS_UNAME="$(uname -s || echo '')"
AWS_BIN="aws"
case "$OS_UNAME" in
  MINGW*|MSYS*|CYGWIN*)
    if command -v aws.exe >/dev/null 2>&1; then AWS_BIN="aws.exe"; fi
    ;;
esac

if ! command -v "$AWS_BIN" >/dev/null 2>&1; then
  echo "ERROR: $AWS_BIN not found in PATH (AWS CLI required)"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found in PATH (used here only for safe JSON read/write — no build step)"
  exit 1
fi

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh <dev|prod>              Deploy — records a new numbered build
  ./deploy.sh list [dev|prod]          List recorded builds (optionally filtered by env)
  ./deploy.sh show <build>             Print one build's manifest.json
  ./deploy.sh rollback <env> <build>   Redeploy that build's saved CFN template
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
  # json_read <file> <dotted.path> — prints a field from a JSON file via node.
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const path = process.argv[2].split('.');
    let v = data;
    for (const k of path) { v = v == null ? v : v[k]; }
    if (v === undefined || v === null) process.exit(1);
    console.log(v);
  " "$1" "$2"
}

# ---- git metadata (best-effort — never fails the script) -------------------
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

# ---- global (not per-env) build counter -------------------------------------
next_build_number() {
  mkdir -p "$VERSIONS_DIR"
  local max=0
  shopt -s nullglob
  for d in "$VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -d "$d" ] || continue
    local n
    n="$(basename "$d")"
    n=$((10#$n))
    if [ "$n" -gt "$max" ]; then max=$n; fi
  done
  shopt -u nullglob
  printf "%04d" "$((max + 1))"
}

tag_object() {
  local bucket="$1" key="$2" status="$3"
  "$AWS_BIN" s3api put-object-tagging \
    --bucket "$bucket" --key "$key" --region "$AWS_REGION" \
    --tagging "TagSet=[{Key=Branch,Value=${GIT_BRANCH}},{Key=DeployDate,Value=${DEPLOY_DATE}},{Key=Status,Value=${status}},{Key=CommitId,Value=${GIT_COMMIT}}]" \
    --no-cli-pager \
    || echo "WARNING: failed to tag s3://$bucket/$key (non-fatal)"
}

write_manifest() {
  # write_manifest <out-file> <buildNumber> <env> <status> <stackName>
  #   <rollbackOf|null> <bucket> <templateKey> <buildTemplateKey>
  #   <commit> <commitShort> <branch> <dirty> <deployer> <region> <deployDate>
  node -e "
    const fs = require('fs');
    const [ , out, buildNumber, env, status, stackName, rollbackOf,
            bucket, templateKey, buildTemplateKey,
            commit, commitShort, branch, dirty, deployer, region, deployDate ] = process.argv;
    const manifest = {
      buildNumber, env, status,
      timestamp: new Date().toISOString(),
      deployDate,
      git: { commit, commitShort, branch, dirty: dirty === 'true' },
      deployer, stackName, region,
      artifact: {
        bucket, templateKey,
        buildTemplateKey: buildTemplateKey || null,
      },
      rollbackOf: rollbackOf === 'null' ? null : rollbackOf,
    };
    fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
    fs.appendFileSync(require('path').dirname(out) + '/history.jsonl', JSON.stringify(manifest) + '\n');
  " "$@"
}

# =============================================================================
# deploy — delegates to infra/deploy-launch-tables.sh, then records a build
# =============================================================================
cmd_deploy() {
  local env="$1"
  require_env_arg "$env"

  set -a
  # shellcheck disable=SC1090
  source "$SERVICE_DIR/.env.launch-tables.$env"
  set +a

  local build
  build="$(next_build_number)"
  local build_dir="$VERSIONS_DIR/$build"
  mkdir -p "$build_dir"

  echo "============================================="
  echo " Build #$build ($env) — starting"
  echo " commit: $GIT_COMMIT_SHORT  branch: $GIT_BRANCH  dirty: $GIT_DIRTY  by: $DEPLOYER"
  echo "============================================="
  if [ "$GIT_DIRTY" = "true" ]; then
    echo "WARNING: working tree has uncommitted changes — this build won't be exactly reproducible from git history alone."
  fi

  rm -f "$SERVICE_DIR/infra/.last-launch-tables-deploy-artifacts.json"

  local status="failed"
  if "$SERVICE_DIR/infra/deploy-launch-tables.sh" "$env"; then
    status="deployed"
  fi

  # Snapshot the exact template used, regardless of outcome — a failed
  # build's attempted config is still worth keeping for debugging.
  cp "$SERVICE_DIR/infra/launch-tables-cfn.yaml" "$build_dir/launch-tables-cfn.yaml" 2>/dev/null || true

  local bucket="unknown"
  local template_key="unknown"
  local build_prefix="realestateflow-launch-tables/builds/${build}/${env}"
  local build_template_key=""

  if [ "$status" = "deployed" ]; then
    local artifacts_file="$SERVICE_DIR/infra/.last-launch-tables-deploy-artifacts.json"
    if [ -f "$artifacts_file" ]; then
      bucket="$(json_read "$artifacts_file" artifactBucket)"
      template_key="$(json_read "$artifacts_file" templateS3Key)"

      build_template_key="${build_prefix}/launch-tables-cfn.yaml"
      "$AWS_BIN" s3 cp "s3://${bucket}/${template_key}" "s3://${bucket}/${build_template_key}" --region "$AWS_REGION" --no-cli-pager

      tag_object "$bucket" "$template_key" "$status"
      tag_object "$bucket" "$build_template_key" "$status"
    else
      echo "WARNING: deploy reported success but $artifacts_file was not written — apps/crm/server/infra/deploy-launch-tables.sh may be an older version missing this. Artifact keys will be recorded as 'unknown'."
    fi
  fi

  write_manifest "$build_dir/manifest.json" \
    "$build" "$env" "$status" "${env}-realestateflow-tables-stack" "null" \
    "$bucket" "$template_key" "$build_template_key" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "${AWS_REGION:-unknown}" "$DEPLOY_DATE"

  echo "$build" > "$VERSIONS_DIR/LATEST"

  echo ""
  echo "Build #$build recorded: $build_dir/manifest.json (status: $status)"

  if [ "$status" != "deployed" ]; then
    echo "Deploy failed — see output above. This build is recorded as 'failed' and is not a valid rollback target."
    exit 1
  fi
}

# =============================================================================
# list / show
# =============================================================================
cmd_list() {
  local filter_env="${1:-}"
  if [ ! -d "$VERSIONS_DIR" ]; then
    echo "No builds recorded yet."
    return 0
  fi

  printf "%-7s %-6s %-9s %-21s %-9s %-20s %-10s\n" "BUILD" "ENV" "STATUS" "TIMESTAMP" "COMMIT" "BRANCH" "ROLLBACK_OF"
  shopt -s nullglob
  for d in "$VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -f "$d/manifest.json" ] || continue
    node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const filterEnv = process.argv[2];
      if (filterEnv && m.env !== filterEnv) process.exit(0);
      const row = [m.buildNumber, m.env, m.status, m.timestamp, m.git.commitShort, m.git.branch, m.rollbackOf || '-'];
      console.log(row.map((v,i)=>String(v).padEnd([7,6,9,21,9,20,10][i])).join(' '));
    " "$d/manifest.json" "$filter_env"
  done
  shopt -u nullglob
  echo ""
  echo "Latest (any env): $(cat "$VERSIONS_DIR/LATEST" 2>/dev/null || echo none)"
}

cmd_show() {
  local build="$1"
  require_build_arg "$build"
  local m="$VERSIONS_DIR/$build/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no manifest at $m"
    exit 1
  fi
  cat "$m"
}

verify_build_env() {
  local build="$1" env="$2" m="$3"
  local actual_env
  actual_env="$(json_read "$m" env)"
  if [ "$actual_env" != "$env" ]; then
    echo "ERROR: build #$build was a '$actual_env' build, not '$env' — refusing to roll back the wrong environment with it."
    exit 1
  fi
}

# =============================================================================
# rollback — redeploy a build's saved CFN template
# =============================================================================
cmd_rollback() {
  local env="$1" build="$2"
  require_env_arg "$env"
  require_build_arg "$build"
  local build_dir="$VERSIONS_DIR/$build"
  local m="$build_dir/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no recorded build #$build"
    exit 1
  fi
  verify_build_env "$build" "$env" "$m"
  if [ ! -f "$build_dir/launch-tables-cfn.yaml" ]; then
    echo "ERROR: build #$build is missing its template snapshot — cannot roll back to it."
    exit 1
  fi

  set -a
  source "$SERVICE_DIR/.env.launch-tables.$env"
  set +a

  echo "Rollback to build #$build: redeploying its saved CFN template."
  echo "This runs a normal 'aws cloudformation deploy' with the historical file."
  echo "Note: DynamoDB tables are DeletionPolicy: Retain — rolling back the"
  echo "template does not touch existing table data, only the CFN-managed"
  echo "schema (indexes, TTL, etc)."

  "$AWS_BIN" cloudformation deploy \
    --template-file "$build_dir/launch-tables-cfn.yaml" \
    --stack-name "${env}-realestateflow-tables-stack" \
    --parameter-overrides "EnvironmentName=${env}" \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --no-fail-on-empty-changeset

  local bucket template_key
  bucket="$(json_read "$m" artifact.bucket)"
  template_key="$(json_read "$m" artifact.templateKey)"
  "$AWS_BIN" s3 cp "$build_dir/launch-tables-cfn.yaml" "s3://$bucket/$template_key" --region "$AWS_REGION" --no-cli-pager
  tag_object "$bucket" "$template_key" "deployed"

  # Record the rollback as its own new build — a rollback is a new forward
  # release, not an edit to history, per standard CI/CD release practice.
  local new_build
  new_build="$(next_build_number)"
  local new_dir="$VERSIONS_DIR/$new_build"
  mkdir -p "$new_dir"
  cp "$build_dir/launch-tables-cfn.yaml" "$new_dir/launch-tables-cfn.yaml"

  # Archive+tag a new build-scoped S3 key too, same as cmd_deploy does, so
  # this rollback shows up in the permanent per-build archive, not just the
  # "latest" key.
  local new_build_template_key="realestateflow-launch-tables/builds/${new_build}/${env}/launch-tables-cfn.yaml"
  "$AWS_BIN" s3 cp "$new_dir/launch-tables-cfn.yaml" "s3://$bucket/$new_build_template_key" --region "$AWS_REGION" --no-cli-pager
  tag_object "$bucket" "$new_build_template_key" "deployed"

  write_manifest "$new_dir/manifest.json" \
    "$new_build" "$env" "deployed" "${env}-realestateflow-tables-stack" "$build" \
    "$bucket" "$template_key" "$new_build_template_key" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "${AWS_REGION:-unknown}" "$DEPLOY_DATE"

  echo "$new_build" > "$VERSIONS_DIR/LATEST"
  echo "Recorded as build #$new_build (rollbackOf: #$build)."
}

# =============================================================================
# dispatch
# =============================================================================
mkdir -p "$VERSIONS_DIR"

case "${1:-}" in
  list)
    cmd_list "${2:-}"
    ;;
  show)
    cmd_show "${2:-}"
    ;;
  rollback)
    cmd_rollback "${2:-}" "${3:-}"
    ;;
  dev|prod)
    cmd_deploy "$1"
    ;;
  *)
    usage
    exit 1
    ;;
esac
