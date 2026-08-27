#!/bin/bash
set -euo pipefail

# =============================================================================
# Reality Flow Auth — CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>                       Deploy — records a new numbered build
#   ./deploy.sh list <dev|prod>                   List recorded builds for that env
#   ./deploy.sh show <dev|prod> <build>           Print one build's manifest.json
#   ./deploy.sh rollback-code <dev|prod> <build>  Point the Lambda at that build's
#                                                  code (fast, code only — no CFN change)
#   ./deploy.sh rollback-full <dev|prod> <build>  Redeploy that build's saved CFN
#                                                  template + params, then its code
#
# Every deploy call delegates the actual packaging/CFN work to the real
# script: reality-flow-authentication/infra/deploy.sh. This wrapper's only
# job is release bookkeeping — see README.md in this folder for the full
# design (why S3 versioning + local snapshots, why rollback = a new forward
# build rather than history editing, and the Deep Archive retrieval caveat).
#
# Build history lives in ./deploy-versions/ — gitignored (see .gitignore in
# this folder and the root README's "CI/CD build directories" section). The
# durable source of truth for actual artifacts is S3 (versioned); this
# folder is a local, human-readable index into that history plus quick
# local template/param snapshots for instant (non-Glacier-wait) CFN rollback.
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
  ./deploy.sh <dev|prod>                       Deploy — records a new numbered build
  ./deploy.sh list <dev|prod>                   List recorded builds for that env
  ./deploy.sh show <dev|prod> <build>           Print one build's manifest.json
  ./deploy.sh rollback-code <dev|prod> <build>  Roll back code only (fast)
  ./deploy.sh rollback-full <dev|prod> <build>  Roll back CFN template+params, then code
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

next_build_number() {
  local env="$1"
  local dir="$VERSIONS_DIR/$env"
  mkdir -p "$dir"
  local max=0
  shopt -s nullglob
  for d in "$dir"/[0-9][0-9][0-9][0-9]; do
    [ -d "$d" ] || continue
    local n
    n="$(basename "$d")"
    n=$((10#$n))
    if [ "$n" -gt "$max" ]; then max=$n; fi
  done
  shopt -u nullglob
  printf "%04d" "$((max + 1))"
}

write_manifest() {
  # write_manifest <out-file> <buildNumber> <env> <status> <stackName> <rollbackOf|null> <rollbackKind|null> <codeBucket> <codeKey> <codeVersionId> <codeStorageClass> <routesKey> <routesVersionId> <branchCodeKey|''> <branchRoutesKey|''> <commit> <commitShort> <branch> <dirty> <deployer> <region> <serviceName>
  node -e "
    const fs = require('fs');
    const [ , out, buildNumber, env, status, stackName, rollbackOf, rollbackKind,
            bucket, codeKey, codeVersionId, codeStorageClass, routesKey, routesVersionId,
            branchCodeKey, branchRoutesKey,
            commit, commitShort, branch, dirty, deployer, region, serviceName ] = process.argv;
    const manifest = {
      buildNumber, env, status,
      timestamp: new Date().toISOString(),
      git: { commit, commitShort, branch, dirty: dirty === 'true' },
      deployer, stackName, region, serviceName,
      artifact: {
        bucket, codeKey, codeVersionId, codeStorageClassAtDeployTime: codeStorageClass,
        routesTemplateKey: routesKey, routesTemplateVersionId: routesVersionId,
        // Stable, never-overwritten copies scoped to this git branch + build
        // number — S3 versioning (above) is the primary rollback mechanism,
        // this is a second, human-browsable path for 'what did branch X
        // build N actually ship'. Empty string when the deploy failed
        // before an artifact existed to copy.
        branchArtifactKey: branchCodeKey || null,
        branchTemplateKey: branchRoutesKey || null,
      },
      rollbackOf: rollbackOf === 'null' ? null : rollbackOf,
      rollbackKind: rollbackKind === 'null' ? null : rollbackKind,
    };
    fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
    fs.appendFileSync(require('path').dirname(out) + '/../history.jsonl', JSON.stringify(manifest) + '\n');
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
  build="$(next_build_number "$env")"
  local build_dir="$VERSIONS_DIR/$env/$build"
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

  local code_key="${SERVICE_NAME}/function.zip"
  local routes_key="${SERVICE_NAME}/auth-explicit-routes.yaml"
  local code_version="unknown"
  local routes_version="unknown"
  local code_storage_class="STANDARD"
  local branch_code_key=""
  local branch_routes_key=""

  if [ "$status" = "deployed" ]; then
    code_version="$("$AWS_BIN" s3api head-object --bucket "$LAMBDA_PACKAGES_BUCKET_NAME" --key "$code_key" --region "$AWS_REGION" --query VersionId --output text 2>/dev/null || echo unknown)"
    routes_version="$("$AWS_BIN" s3api head-object --bucket "$LAMBDA_PACKAGES_BUCKET_NAME" --key "$routes_key" --region "$AWS_REGION" --query VersionId --output text 2>/dev/null || echo unknown)"
    code_storage_class="$("$AWS_BIN" s3api head-object --bucket "$LAMBDA_PACKAGES_BUCKET_NAME" --key "$code_key" --region "$AWS_REGION" --query StorageClass --output text 2>/dev/null || echo STANDARD)"
    [ "$code_storage_class" = "None" ] && code_storage_class="STANDARD"

    # Stable, branch+build-scoped copies (server-side, no re-upload) — this
    # git branch gets its own never-overwritten artifact history in S3,
    # independent of S3 object versioning on the "latest" key above.
    local branch_prefix="${SERVICE_NAME}/branches/${GIT_BRANCH}/builds/${build}"
    branch_code_key="${branch_prefix}/function.zip"
    branch_routes_key="${branch_prefix}/auth-explicit-routes.yaml"
    "$AWS_BIN" s3 cp "s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${code_key}" "s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${branch_code_key}" --region "$AWS_REGION" --no-cli-pager
    "$AWS_BIN" s3 cp "s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${routes_key}" "s3://${LAMBDA_PACKAGES_BUCKET_NAME}/${branch_routes_key}" --region "$AWS_REGION" --no-cli-pager
  fi

  write_manifest "$build_dir/manifest.json" \
    "$build" "$env" "$status" "${ENV}-${SERVICE_NAME}-stack" "null" "null" \
    "${LAMBDA_PACKAGES_BUCKET_NAME:-unknown}" "$code_key" "$code_version" "$code_storage_class" "$routes_key" "$routes_version" \
    "$branch_code_key" "$branch_routes_key" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "${AWS_REGION:-unknown}" "$SERVICE_NAME"

  echo "$build" > "$VERSIONS_DIR/$env/LATEST"

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
  local env="$1"
  require_env_arg "$env"
  local dir="$VERSIONS_DIR/$env"
  if [ ! -d "$dir" ]; then
    echo "No builds recorded for $env yet."
    return 0
  fi

  printf "%-7s %-9s %-21s %-9s %-20s %-10s\n" "BUILD" "STATUS" "TIMESTAMP" "COMMIT" "BRANCH" "ROLLBACK_OF"
  shopt -s nullglob
  for d in "$dir"/[0-9][0-9][0-9][0-9]; do
    [ -f "$d/manifest.json" ] || continue
    node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const row = [m.buildNumber, m.status, m.timestamp, m.git.commitShort, m.git.branch, m.rollbackOf || '-'];
      console.log(row.map((v,i)=>String(v).padEnd([7,9,21,9,20,10][i])).join(' '));
    " "$d/manifest.json"
  done
  shopt -u nullglob
  echo ""
  echo "Latest: $(cat "$dir/LATEST" 2>/dev/null || echo none)"
}

cmd_show() {
  local env="$1" build="$2"
  require_env_arg "$env"
  require_build_arg "$build"
  local m="$VERSIONS_DIR/$env/$build/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no manifest at $m"
    exit 1
  fi
  cat "$m"
}

# =============================================================================
# rollback-code — fast path: point the live Lambda at an old S3 object version
# =============================================================================
cmd_rollback_code() {
  local env="$1" build="$2"
  require_env_arg "$env"
  require_build_arg "$build"
  local build_dir="$VERSIONS_DIR/$env/$build"
  local m="$build_dir/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no recorded build #$build for $env"
    exit 1
  fi

  set -a
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENV="$env"

  local bucket key version
  bucket="$(json_read "$m" artifact.bucket)"
  key="$(json_read "$m" artifact.codeKey)"
  version="$(json_read "$m" artifact.codeVersionId)" || true

  if [ -z "${version:-}" ] || [ "$version" = "unknown" ]; then
    echo "ERROR: build #$build has no recorded code version id — cannot roll back code from it."
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
  new_build="$(next_build_number "$env")"
  local new_dir="$VERSIONS_DIR/$env/$new_build"
  mkdir -p "$new_dir"
  cp "$build_dir"/*.yaml "$new_dir/" 2>/dev/null || true
  cp "$build_dir/cfn-params.json" "$new_dir/" 2>/dev/null || true

  write_manifest "$new_dir/manifest.json" \
    "$new_build" "$env" "deployed" "${ENV}-${SERVICE_NAME}-stack" "$build" "code-only" \
    "$bucket" "$key" "$version" "$storage_class" \
    "$(json_read "$m" artifact.routesTemplateKey)" "$(json_read "$m" artifact.routesTemplateVersionId)" \
    "$(json_read "$m" artifact.branchArtifactKey 2>/dev/null || echo '')" "$(json_read "$m" artifact.branchTemplateKey 2>/dev/null || echo '')" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "${AWS_REGION:-unknown}" "$SERVICE_NAME"

  echo "$new_build" > "$VERSIONS_DIR/$env/LATEST"
  echo "Recorded as build #$new_build (rollbackOf: #$build, code-only)."
}

# =============================================================================
# rollback-full — redeploy a build's saved CFN template + params, then code
# =============================================================================
cmd_rollback_full() {
  local env="$1" build="$2"
  require_env_arg "$env"
  require_build_arg "$build"
  local build_dir="$VERSIONS_DIR/$env/$build"
  local m="$build_dir/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no recorded build #$build for $env"
    exit 1
  fi
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
    cmd_show "${2:-}" "${3:-}"
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
