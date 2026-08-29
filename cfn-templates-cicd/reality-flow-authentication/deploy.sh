#!/bin/bash
set -euo pipefail

# =============================================================================
# Reality Flow Auth — CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>                       Deploy — records a new numbered build
#   ./deploy.sh list [dev|prod]                   List recorded builds (optionally filtered)
#   ./deploy.sh show <build>                      Print one build's manifest.json
#   ./deploy.sh rollback-code <env> <build>       Point the Lambda at that build's
#                                                  code (fast, code only — no CFN change)
#   ./deploy.sh rollback-full <env> <build>       Redeploy that build's saved CFN
#                                                  template + params, then its code
#
# Every deploy call delegates the actual packaging/CFN work to the real
# script: reality-flow-authentication/infra/deploy.sh. This wrapper's only
# job is release bookkeeping — see README.md in this folder for the full
# design.
#
# Build numbers are GLOBAL (one counter across dev AND prod, not one per
# env) — "build #7" is unambiguous on its own; which env it targeted is
# recorded inside it, not encoded by which counter produced it.
#
# S3 layout under the artifact bucket (dev-realestateflow-artifacts /
# prod-realestateflow-artifacts — one bucket per environment already, per
# cfn-templates-cicd/common-infra/vpc-networking.yaml):
#   ${SERVICE_NAME}/function.zip                       "latest" — the ONE
#   ${SERVICE_NAME}/auth-explicit-routes.yaml           key Lambda/CFN
#                                                        actually read; every
#                                                        deploy overwrites it
#   ${SERVICE_NAME}/builds/<build>/<env>/cfn-backend.yaml
#   ${SERVICE_NAME}/builds/<build>/<env>/auth-explicit-routes.yaml
#   ${SERVICE_NAME}/builds/<build>/<env>/code/function.zip
#     (code/ is a directory, not a fixed filename, so a service that ships
#     more than one Lambda artifact just adds more files there — see
#     cfn-templates-cicd/server/deploy.sh for a real two-zip-shared case)
#
# Every object this script touches (the "latest" keys AND every build-
# archive file) gets S3 tags: Branch, DeployDate, Status (deployed|failed —
# the actual script outcome), CommitId. Status is only known after the
# delegate script returns, so tagging always happens as a follow-up
# put-object-tagging call, never at upload time.
#
# Build history also lives locally in ./deploy-versions/ — gitignored (see
# .gitignore in this folder and the root README's ".gitignore best
# practices" section). S3 is the durable, shareable source of truth; this
# folder is a local index plus instant-access (non-Glacier-wait) template/
# param snapshots for rollback.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../reality-flow-authentication" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
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
  ./deploy.sh <dev|prod>                  Deploy — records a new numbered build
  ./deploy.sh list [dev|prod]              List recorded builds (optionally filtered by env)
  ./deploy.sh show <build>                 Print one build's manifest.json
  ./deploy.sh rollback-code <env> <build>  Roll back code only (fast)
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
  # json_read <file> <dotted.path> — prints a field from a JSON file via node,
  # so we never hand-parse JSON in bash.
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

# tag_object <bucket> <key> <status> — applies Branch/DeployDate/Status/CommitId.
# Best-effort: a tagging failure (e.g. object briefly not found) shouldn't
# fail the whole deploy, so errors are reported but not fatal.
tag_object() {
  local bucket="$1" key="$2" status="$3"
  "$AWS_BIN" s3api put-object-tagging \
    --bucket "$bucket" --key "$key" --region "$AWS_REGION" \
    --tagging "TagSet=[{Key=Branch,Value=${GIT_BRANCH}},{Key=DeployDate,Value=${DEPLOY_DATE}},{Key=Status,Value=${status}},{Key=CommitId,Value=${GIT_COMMIT}}]" \
    --no-cli-pager \
    || echo "WARNING: failed to tag s3://$bucket/$key (non-fatal)"
}

write_manifest() {
  # write_manifest <out-file> <buildNumber> <env> <status> <stackName> <rollbackOf|null> <rollbackKind|null> <bucket> <codeKey> <codeVersionId> <codeStorageClass> <routesKey> <routesVersionId> <buildCodeKey> <buildRoutesKey> <buildTemplateKey> <commit> <commitShort> <branch> <dirty> <deployer> <region> <serviceName> <deployDate>
  node -e "
    const fs = require('fs');
    const [ , out, buildNumber, env, status, stackName, rollbackOf, rollbackKind,
            bucket, codeKey, codeVersionId, codeStorageClass, routesKey, routesVersionId,
            buildCodeKey, buildRoutesKey, buildTemplateKey,
            commit, commitShort, branch, dirty, deployer, region, serviceName, deployDate ] = process.argv;
    const manifest = {
      buildNumber, env, status,
      timestamp: new Date().toISOString(),
      deployDate,
      git: { commit, commitShort, branch, dirty: dirty === 'true' },
      deployer, stackName, region, serviceName,
      artifact: {
        bucket, codeKey, codeVersionId, codeStorageClassAtDeployTime: codeStorageClass,
        routesTemplateKey: routesKey, routesTemplateVersionId: routesVersionId,
        // Permanent, build+env-scoped archive copies — S3 versioning on the
        // 'latest' key above is the primary rollback mechanism; these are a
        // second, human-browsable 'what did build N (env) actually ship' path.
        buildCodeKey: buildCodeKey || null,
        buildRoutesKey: buildRoutesKey || null,
        buildTemplateKey: buildTemplateKey || null,
      },
      rollbackOf: rollbackOf === 'null' ? null : rollbackOf,
      rollbackKind: rollbackKind === 'null' ? null : rollbackKind,
    };
    fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
    fs.appendFileSync(require('path').dirname(out) + '/history.jsonl', JSON.stringify(manifest) + '\n');
  " "$@"
}

# =============================================================================
# deploy — delegates to infra/deploy.sh, then records a build
# =============================================================================
cmd_deploy() {
  local env="$1"
  require_env_arg "$env"

  set -a
  # shellcheck disable=SC1090
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENV="$env"

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

  local status="failed"
  if "$SERVICE_DIR/infra/deploy.sh" "$env"; then
    status="deployed"
  fi

  # Snapshot the exact templates/params used, regardless of outcome — a
  # failed build's attempted config is still worth keeping for debugging.
  cp "$SERVICE_DIR/infra/cfn-backend.yaml" "$build_dir/cfn-backend.yaml" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/auth-explicit-routes.yaml" "$build_dir/auth-explicit-routes.yaml" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/cfn-params.json" "$build_dir/cfn-params.json" 2>/dev/null || true

  local bucket="${LAMBDA_PACKAGES_BUCKET_NAME:-unknown}"
  local code_key="${SERVICE_NAME}/function.zip"
  local routes_key="${SERVICE_NAME}/auth-explicit-routes.yaml"
  local code_version="unknown"
  local routes_version="unknown"
  local code_storage_class="STANDARD"
  local build_prefix="${SERVICE_NAME}/builds/${build}/${env}"
  local build_code_key="${build_prefix}/code/function.zip"
  local build_routes_key="${build_prefix}/auth-explicit-routes.yaml"
  local build_template_key="${build_prefix}/cfn-backend.yaml"

  if [ "$status" = "deployed" ]; then
    code_version="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$code_key" --region "$AWS_REGION" --query VersionId --output text 2>/dev/null || echo unknown)"
    routes_version="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$routes_key" --region "$AWS_REGION" --query VersionId --output text 2>/dev/null || echo unknown)"
    # AWS CLI prints the literal string "None" (not empty, not an error) when
    # the bucket doesn't have versioning enabled — normalize both that and a
    # query failure to the same "unknown" sentinel.
    [ "$code_version" = "None" ] && code_version="unknown"
    [ "$routes_version" = "None" ] && routes_version="unknown"
    code_storage_class="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$code_key" --region "$AWS_REGION" --query StorageClass --output text 2>/dev/null || echo STANDARD)"
    [ "$code_storage_class" = "None" ] && code_storage_class="STANDARD"

    # Permanent build+env archive copies (server-side copy where possible —
    # cfn-backend.yaml is a fresh upload since infra/deploy.sh never puts it
    # in S3 itself, it's only inline-deployed since it's under 51.2KB).
    "$AWS_BIN" s3 cp "s3://${bucket}/${code_key}" "s3://${bucket}/${build_code_key}" --region "$AWS_REGION" --no-cli-pager
    "$AWS_BIN" s3 cp "s3://${bucket}/${routes_key}" "s3://${bucket}/${build_routes_key}" --region "$AWS_REGION" --no-cli-pager
    "$AWS_BIN" s3 cp "$build_dir/cfn-backend.yaml" "s3://${bucket}/${build_template_key}" --region "$AWS_REGION" --no-cli-pager

    tag_object "$bucket" "$code_key" "$status"
    tag_object "$bucket" "$routes_key" "$status"
    tag_object "$bucket" "$build_code_key" "$status"
    tag_object "$bucket" "$build_routes_key" "$status"
    tag_object "$bucket" "$build_template_key" "$status"
  else
    build_code_key=""
    build_routes_key=""
    build_template_key=""
  fi

  write_manifest "$build_dir/manifest.json" \
    "$build" "$env" "$status" "${ENV}-${SERVICE_NAME}-stack" "null" "null" \
    "$bucket" "$code_key" "$code_version" "$code_storage_class" "$routes_key" "$routes_version" \
    "$build_code_key" "$build_routes_key" "$build_template_key" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "${AWS_REGION:-unknown}" "$SERVICE_NAME" "$DEPLOY_DATE"

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

# verify_build_env <build> <env> <manifest-path> — safety check: since build
# numbers are global, confirm the build you're targeting for rollback
# actually WAS a build for the env you're rolling back.
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
# rollback-code — fast path: point the live Lambda at an old S3 object version
# =============================================================================
cmd_rollback_code() {
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

  set -a
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENV="$env"

  local bucket key version
  bucket="$(json_read "$m" artifact.bucket)"
  key="$(json_read "$m" artifact.codeKey)"
  version="$(json_read "$m" artifact.codeVersionId)" || true

  if [ -z "${version:-}" ] || [ "$version" = "unknown" ] || [ "$version" = "None" ]; then
    echo "ERROR: build #$build has no recorded code version id — cannot roll back code from it."
    echo "(Means the artifact bucket didn't have S3 versioning enabled at deploy time. The"
    echo " current dev-realestateflow-artifacts / prod-realestateflow-artifacts buckets have"
    echo " versioning on from creation, so only builds recorded before that won't have one.)"
    exit 1
  fi

  echo "Rolling back code: function=${ENV}-${SERVICE_NAME}-lambda  s3://$bucket/$key  version=$version"

  local storage_class
  storage_class="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$key" --version-id "$version" --region "$AWS_REGION" --query StorageClass --output text 2>/dev/null || echo STANDARD)"
  [ "$storage_class" = "None" ] && storage_class="STANDARD"

  if [ "$storage_class" = "DEEP_ARCHIVE" ] || [ "$storage_class" = "GLACIER" ]; then
    cat <<EOF

This version is in $storage_class — it must be restored before Lambda can read it.
Run:
  $AWS_BIN s3api restore-object --bucket $bucket --key $key --version-id $version --region $AWS_REGION \\
    --restore-request '{"Days":7,"GlacierJobParameters":{"Tier":"Standard"}}'

Then wait for the restore (~12h for Deep Archive Standard tier; check with):
  $AWS_BIN s3api head-object --bucket $bucket --key $key --version-id $version --region $AWS_REGION --query Restore

Re-run this rollback-code command once that shows the restore is complete.
EOF
    exit 1
  fi

  "$AWS_BIN" lambda update-function-code \
    --function-name "${ENV}-${SERVICE_NAME}-lambda" \
    --s3-bucket "$bucket" \
    --s3-key "$key" \
    --s3-object-version "$version" \
    --region "$AWS_REGION" \
    --no-cli-pager

  echo "Rolled back code to build #$build ($version)."

  # Record the rollback as its own new build — a rollback is a new forward
  # release, not an edit to history, per standard CI/CD release practice.
  local new_build
  new_build="$(next_build_number)"
  local new_dir="$VERSIONS_DIR/$new_build"
  mkdir -p "$new_dir"
  cp "$build_dir"/*.yaml "$new_dir/" 2>/dev/null || true
  cp "$build_dir/cfn-params.json" "$new_dir/" 2>/dev/null || true

  tag_object "$bucket" "$key" "deployed"

  write_manifest "$new_dir/manifest.json" \
    "$new_build" "$env" "deployed" "${ENV}-${SERVICE_NAME}-stack" "$build" "code-only" \
    "$bucket" "$key" "$version" "$storage_class" \
    "$(json_read "$m" artifact.routesTemplateKey)" "$(json_read "$m" artifact.routesTemplateVersionId)" \
    "$(json_read "$m" artifact.buildCodeKey 2>/dev/null || echo '')" \
    "$(json_read "$m" artifact.buildRoutesKey 2>/dev/null || echo '')" \
    "$(json_read "$m" artifact.buildTemplateKey 2>/dev/null || echo '')" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "${AWS_REGION:-unknown}" "$SERVICE_NAME" "$DEPLOY_DATE"

  echo "$new_build" > "$VERSIONS_DIR/LATEST"
  echo "Recorded as build #$new_build (rollbackOf: #$build, code-only)."
}

# =============================================================================
# rollback-full — redeploy a build's saved CFN template + params, then code
# =============================================================================
cmd_rollback_full() {
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
  if [ ! -f "$build_dir/cfn-backend.yaml" ] || [ ! -f "$build_dir/cfn-params.json" ]; then
    echo "ERROR: build #$build is missing its template/params snapshot — cannot do a full rollback."
    echo "(rollback-code may still work if it has a recorded code version.)"
    exit 1
  fi

  set -a
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENV="$env"

  echo "Full rollback to build #$build: redeploying its saved CFN template + params, then its code."
  echo "This runs a normal 'aws cloudformation deploy' with historical files."

  local bucket
  bucket="$(json_read "$m" artifact.bucket)"

  if [ -f "$build_dir/auth-explicit-routes.yaml" ]; then
    local routes_key="${SERVICE_NAME}/auth-explicit-routes.yaml"
    # Re-upload from the LOCAL snapshot, not from S3 — the S3 copy may have
    # moved to Deep Archive by now and take hours to restore; the local
    # snapshot is instant and identical content.
    "$AWS_BIN" s3 cp "$build_dir/auth-explicit-routes.yaml" "s3://$bucket/$routes_key" --region "$AWS_REGION" --no-cli-pager
    tag_object "$bucket" "$routes_key" "deployed"
  fi

  "$AWS_BIN" cloudformation deploy \
    --template-file "$build_dir/cfn-backend.yaml" \
    --stack-name "${ENV}-${SERVICE_NAME}-stack" \
    --parameter-overrides "file://$build_dir/cfn-params.json" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --no-fail-on-empty-changeset

  echo "CFN template/params restored from build #$build. Rolling back code next..."
  cmd_rollback_code "$env" "$build"
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
  rollback-code)
    cmd_rollback_code "${2:-}" "${3:-}"
    ;;
  rollback-full)
    cmd_rollback_full "${2:-}" "${3:-}"
    ;;
  dev|prod)
    cmd_deploy "$1"
    ;;
  *)
    usage
    exit 1
    ;;
esac
