#!/bin/bash
set -euo pipefail

# =============================================================================
# Instagram Solution backend - CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>                   Deploy - records a new numbered build
#   ./deploy.sh list [dev|prod]              List recorded builds
#   ./deploy.sh show <build>                 Print one build's manifest.json
#   ./deploy.sh rollback-code <env> <build>  Point the Lambda at that build's
#                                             code (fast, code only — no CFN change)
#   ./deploy.sh rollback-full <env> <build>  Redeploy that build's saved template+
#                                             params (this also restores its code,
#                                             since LambdaCodeS3Key is a CFN param)
#   ./deploy.sh config-deploy <dev|prod>     Config-only deploy — CFN parameter
#                                             update only, no npm/zip/upload. See
#                                             backend_insta_sol_ms/infra/
#                                             config-deploy.sh and
#                                             docs/proposals/config-only-deploy/
#                                             context.md.
#   ./deploy.sh list-config [dev|prod]       List recorded config revisions
#   ./deploy.sh show-config <config-version> Print one config revision's manifest.json
#   ./deploy.sh rollback-config <env> <config-version>
#                                             Reapply an old config revision's
#                                             allowlisted parameter values on top
#                                             of whatever code build is live
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
# Every object this script touches — the PRIMARY keys infra/deploy.sh actually
# uploaded and used for this deploy (read back from infra/.last-deploy-
# artifacts.json), AND the build-archive copies under builds/<build>/<env>/ —
# gets tagged Branch, DeployDate, Status, CommitId. Status is only known
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
CONFIG_VERSIONS_DIR="$SCRIPT_DIR/config-versions"
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
  ./deploy.sh <dev|prod>                   Deploy - records a new numbered build
  ./deploy.sh list [dev|prod]              List recorded builds (optionally filtered)
  ./deploy.sh show <build>                 Print one build's manifest.json
  ./deploy.sh rollback-code <env> <build>  Roll back code only (fast, Lambda only)
  ./deploy.sh rollback-full <env> <build>  Roll back CFN template+params, then code
  ./deploy.sh config-deploy <dev|prod>     Config-only deploy (CFN params only, no build)
  ./deploy.sh list-config [dev|prod]       List recorded config revisions
  ./deploy.sh show-config <config-version> Print one config revision's manifest.json
  ./deploy.sh rollback-config <env> <config-version>
                                            Reapply an old config revision's params
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

require_config_version_arg() {
  local c="${1:-}"
  if ! [[ "$c" =~ ^[0-9]{4}$ ]]; then
    echo "ERROR: config version must be 4 digits, e.g. 0007 (got: '${c}')"
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

# ---- config-version counter — SEPARATE track from the build counter above,
# also global across dev/prod (same design as cfn-templates-cicd/reality-
# flow-authentication and cfn-templates-cicd/server) ------------------------
next_config_version() {
  mkdir -p "$CONFIG_VERSIONS_DIR"
  local max=0
  shopt -s nullglob
  for d in "$CONFIG_VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -d "$d" ] || continue
    local n
    n="$(basename "$d")"
    n=$((10#$n))
    if [ "$n" -gt "$max" ]; then max="$n"; fi
  done
  shopt -u nullglob
  printf "%04d" $((max + 1))
}

# latest_build_for_env <env> — highest-numbered successfully-deployed build
# recorded for that specific env (build numbers are global).
latest_build_for_env() {
  local env="$1"
  local max=0
  shopt -s nullglob
  for d in "$VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -f "$d/manifest.json" ] || continue
    local e s n
    e="$(json_read "$d/manifest.json" environment 2>/dev/null || echo '')"
    s="$(json_read "$d/manifest.json" status 2>/dev/null || echo '')"
    if [ "$e" = "$env" ] && [ "$s" = "deployed" ]; then
      n="$(basename "$d")"
      n=$((10#$n))
      if [ "$n" -gt "$max" ]; then max="$n"; fi
    fi
  done
  shopt -u nullglob
  printf "%04d" "$max"
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

  # Tag the PRIMARY deployed artifacts — the actual keys infra/deploy.sh
  # uploaded and used for this deploy — not just the build-archive copies
  # below. This is what checklist item "S3 object tagging" actually means:
  # every object this script touches, not only its own archive copies.
  if [ "$code_key" != "unknown" ]; then
    tag_object "$ARTIFACT_BUCKET" "$code_key" "$status"
  fi
  if [ "$template_key" != "unknown" ]; then
    tag_object "$ARTIFACT_BUCKET" "$template_key" "$status"
  fi

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

# =============================================================================
# config-deploy — delegates to infra/config-deploy.sh, records a config
# revision on its OWN numbering track (config-versions/, not deploy-versions/)
# =============================================================================
cmd_config_deploy() {
  local env="$1"
  require_env_arg "$env"
  load_env_file "$env"

  echo "============================================="
  echo " Instagram backend - config-only deploy -> $env"
  echo "============================================="
  echo "Branch:  $GIT_BRANCH ($GIT_COMMIT_SHORT, dirty=$GIT_DIRTY)"
  echo ""

  local diff_file="$SERVICE_DIR/infra/.last-config-diff.json"
  rm -f "$diff_file"

  if ! ( cd "$SERVICE_DIR" && ./infra/config-deploy.sh "$env" ); then
    echo ""
    echo "Config-only deploy failed or was refused — see output above. No config revision recorded."
    exit 1
  fi

  if [ ! -f "$diff_file" ] || [ "$(cat "$diff_file")" = "{}" ]; then
    echo ""
    echo "No allowlisted parameter actually differed from the live stack — no config revision recorded."
    return 0
  fi

  local build
  build="$(latest_build_for_env "$env")"

  local cfg
  cfg="$(next_config_version)"
  local cfg_dir="$CONFIG_VERSIONS_DIR/$cfg"
  mkdir -p "$cfg_dir"
  cp "$diff_file" "$cfg_dir/changed-params.json"
  if [ -f "$SERVICE_DIR/infra/.last-config-params.json" ]; then
    cp "$SERVICE_DIR/infra/.last-config-params.json" "$cfg_dir/params-snapshot.json"
  fi

  cat > "$cfg_dir/manifest.json" <<EOF
{
  "configVersion": "${cfg}",
  "appliedToBuild": "${build}",
  "service": "${SERVICE_NAME}",
  "environment": "${env}",
  "status": "applied",
  "deployDate": "${DEPLOY_DATE}",
  "deployer": "${DEPLOYER}",
  "gitBranch": "${GIT_BRANCH}",
  "gitCommit": "${GIT_COMMIT}",
  "gitCommitShort": "${GIT_COMMIT_SHORT}",
  "gitDirty": ${GIT_DIRTY},
  "changedParams": $(cat "$cfg_dir/changed-params.json"),
  "rollbackOf": null
}
EOF

  echo "$cfg" > "$CONFIG_VERSIONS_DIR/LATEST"
  echo ""
  echo "Config revision #$cfg recorded (env: $env, applied to build #$build): $cfg_dir/manifest.json"
}

# =============================================================================
# list-config / show-config
# =============================================================================
cmd_list_config() {
  local filter="${1:-}"
  mkdir -p "$CONFIG_VERSIONS_DIR"
  printf "%-9s %-6s %-11s %-9s %-22s %-10s %s\n" CONFIG_V ENV APPLIED_TO STATUS DATE COMMIT ROLLBACK_OF
  shopt -s nullglob
  for d in "$CONFIG_VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -f "$d/manifest.json" ] || continue
    local m="$d/manifest.json"
    local e s dt c b ro
    e="$(json_read "$m" environment || echo '?')"
    if [ -n "$filter" ] && [ "$e" != "$filter" ]; then continue; fi
    s="$(json_read "$m" status || echo '?')"
    dt="$(json_read "$m" deployDate || echo '?')"
    c="$(json_read "$m" gitCommitShort || echo '?')"
    b="$(json_read "$m" appliedToBuild || echo '?')"
    ro="$(json_read "$m" rollbackOf 2>/dev/null || echo '-')"
    printf "%-9s %-6s %-11s %-9s %-22s %-10s %s\n" "$(basename "$d")" "$e" "build#$b" "$s" "$dt" "$c" "$ro"
  done
  shopt -u nullglob
  echo ""
  echo "Latest config revision (any env): $(cat "$CONFIG_VERSIONS_DIR/LATEST" 2>/dev/null || echo none)"
}

cmd_show_config() {
  local cfg="$1"
  require_config_version_arg "$cfg"
  local m="$CONFIG_VERSIONS_DIR/$cfg/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no config revision manifest at $m"
    exit 1
  fi
  cat "$m"
}

# verify_config_env <configVersion> <env> <manifest-file>
verify_config_env() {
  local cfg="$1" env="$2" m="$3"
  local recorded_env
  recorded_env="$(json_read "$m" environment 2>/dev/null || echo "$env")"
  if [ "$recorded_env" != "$env" ]; then
    echo "ERROR: config revision #$cfg was applied to '$recorded_env', not '$env' — refusing to roll back the wrong environment with it."
    exit 1
  fi
}

# =============================================================================
# rollback-config — reapply an old config revision's ALLOWLISTED parameter
# values on top of whatever code build is CURRENTLY live (never rolls code
# back — see docs/proposals/config-only-deploy/context.md's "Versioning"
# section). Recorded as a new forward config revision.
# =============================================================================
cmd_rollback_config() {
  local env="$1" cfg="$2"
  require_env_arg "$env"
  require_config_version_arg "$cfg"
  local cfg_dir="$CONFIG_VERSIONS_DIR/$cfg"
  local m="$cfg_dir/manifest.json"
  if [ ! -f "$m" ]; then
    echo "ERROR: no recorded config revision #$cfg"
    exit 1
  fi
  verify_config_env "$cfg" "$env" "$m"
  if [ ! -f "$cfg_dir/params-snapshot.json" ]; then
    echo "ERROR: config revision #$cfg has no params-snapshot.json — cannot roll back to it."
    exit 1
  fi

  load_env_file "$env"

  echo "Rolling back config to revision #$cfg ($env) — reapplying its allowlisted parameter"
  echo "values on top of whatever code build is currently live."

  local allowlist_file="$SERVICE_DIR/infra/config-only-allowed-params.json"
  local live_params_json
  if ! live_params_json="$("$AWS_BIN" cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager \
        --query "Stacks[0].Parameters" --output json 2>/dev/null)"; then
    echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable)."
    exit 1
  fi

  local overrides_file="$cfg_dir/.rollback-overrides.json"
  node -e "
    const fs = require('fs');
    const live = JSON.parse(process.argv[1]);
    const liveMap = {};
    for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;
    const snapshot = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const snapshotMap = {};
    for (const p of snapshot) snapshotMap[p.ParameterKey] = p.ParameterValue;
    const allowed = new Set(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).allowedParams);
    const out = [];
    for (const key of Object.keys(liveMap)) {
      if (allowed.has(key) && key in snapshotMap) { out.push(key + '=' + snapshotMap[key]); continue; }
      if (liveMap[key] === '****') continue; // NoEcho mask — omit, CFN keeps previous value
      out.push(key + '=' + liveMap[key]);
    }
    fs.writeFileSync(process.argv[4], JSON.stringify(out));
  " "$live_params_json" "$cfg_dir/params-snapshot.json" "$allowlist_file" "$overrides_file"

  mapfile -t PARAM_OVERRIDES < <(node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).forEach(x=>console.log(x))" "$overrides_file")
  rm -f "$overrides_file"

  "$AWS_BIN" cloudformation deploy \
    --template-file "$SERVICE_DIR/infra/cfn-insta-sol-ms.yaml" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset \
    --tags Environment="$env" Service=realestateflow-insta \
    --parameter-overrides "${PARAM_OVERRIDES[@]}" \
    --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager

  local build
  build="$(latest_build_for_env "$env")"
  local new_cfg
  new_cfg="$(next_config_version)"
  local new_dir="$CONFIG_VERSIONS_DIR/$new_cfg"
  mkdir -p "$new_dir"
  cp "$cfg_dir/params-snapshot.json" "$new_dir/params-snapshot.json"

  node -e "
    const fs = require('fs');
    const snapshot = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const allowed = new Set(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).allowedParams);
    const changed = {};
    for (const p of snapshot) if (allowed.has(p.ParameterKey)) changed[p.ParameterKey] = { from: null, to: p.ParameterValue, note: 'restored via rollback-config from #${cfg}' };
    fs.writeFileSync(process.argv[3], JSON.stringify(changed, null, 2) + '\n');
  " "$cfg_dir/params-snapshot.json" "$allowlist_file" "$new_dir/changed-params.json"

  cat > "$new_dir/manifest.json" <<EOF
{
  "configVersion": "${new_cfg}",
  "appliedToBuild": "${build}",
  "service": "${SERVICE_NAME}",
  "environment": "${env}",
  "status": "applied",
  "deployDate": "${DEPLOY_DATE}",
  "deployer": "${DEPLOYER}",
  "gitBranch": "${GIT_BRANCH}",
  "gitCommit": "${GIT_COMMIT}",
  "gitCommitShort": "${GIT_COMMIT_SHORT}",
  "gitDirty": ${GIT_DIRTY},
  "changedParams": $(cat "$new_dir/changed-params.json"),
  "rollbackOf": "${cfg}"
}
EOF

  echo "$new_cfg" > "$CONFIG_VERSIONS_DIR/LATEST"
  echo ""
  echo "Rolled back to config revision #$cfg's parameter values. Recorded as new config revision #$new_cfg (rollbackOf: #$cfg)."
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
  # verify_build_env <build> <env> <manifest-file> — refuses to roll a prod
  # stack back to a dev build (or vice versa), same guard shape as
  # cfn-templates-cicd/server and reality-flow-authentication.
  local build="$1" env="$2" m="$3"
  local recorded_env
  recorded_env="$(json_read "$m" environment 2>/dev/null || echo "$env")"
  if [ "$recorded_env" != "$env" ]; then
    echo "ERROR: build $build was deployed to '$recorded_env', not '$env'."
    echo "       Rolling a prod stack back to a dev build (or vice versa) would"
    echo "       point it at the wrong tables. Refusing."
    exit 1
  fi
}

# =============================================================================
# rollback-code — fast path: point the Lambda at an old code artifact
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
    echo "ERROR: build $build has no recorded code key — cannot roll back code from it."
    exit 1
  fi

  echo "Checking archival status of s3://$bucket/$key ..."
  local storage_class
  storage_class="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$key" --region "$AWS_REGION" --profile "$AWS_PROFILE" --query StorageClass --output text 2>/dev/null || echo STANDARD)"
  [ "$storage_class" = "None" ] && storage_class="STANDARD"

  if [ "$storage_class" = "DEEP_ARCHIVE" ] || [ "$storage_class" = "GLACIER" ]; then
    cat <<EOF

This build's code is in $storage_class — it must be restored before Lambda can read it.
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
    --function-name "${env}-realestateflow-insta-lambda" \
    --s3-bucket "$bucket" \
    --s3-key "$key" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --no-cli-pager

  echo "Rolled back code to build $build ($key)."
}

# =============================================================================
# rollback-full — redeploy a build's saved CFN template + params (this also
# restores its code, since LambdaCodeS3Key is itself a CFN parameter)
# =============================================================================
cmd_rollback_full() {
  local env="${1:-}"
  local build="${2:-}"
  require_env_arg "$env"
  require_build_arg "$build"
  load_env_file "$env"

  local build_dir="$VERSIONS_DIR/$build"
  local tpl="$build_dir/cfn-insta-sol-ms.yaml"
  local prm="$build_dir/cfn-params.json"
  local m="$build_dir/manifest.json"
  local prefix="${ARTIFACT_PREFIX}/builds/${build}/${env}"

  if [ ! -f "$tpl" ] || [ ! -f "$prm" ]; then
    echo "Local snapshot missing; pulling build $build from S3..."
    mkdir -p "$build_dir"
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/cfn-insta-sol-ms.yaml" "$tpl" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/cfn-params.json" "$prm" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
  fi

  # The env guard must run unconditionally, regardless of which files were
  # already cached locally — never let a missing-manifest-but-cached-
  # snapshot case skip straight to `cloudformation deploy` unchecked.
  if [ ! -f "$m" ]; then
    echo "Local manifest missing; pulling build $build's manifest from S3..."
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/manifest.json" "$m" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
  fi
  if [ ! -f "$m" ]; then
    echo "ERROR: no manifest for build $build found locally or in S3 — cannot verify which"
    echo "       environment it was deployed to. Refusing to roll back without that check."
    exit 1
  fi
  verify_build_env "$build" "$env" "$m"

  echo "Rolling $STACK_NAME back to build $build (template + params + code)..."
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
  dev|prod)         cmd_deploy "$1" ;;
  list)             cmd_list "${2:-}" ;;
  show)             cmd_show "${2:-}" ;;
  rollback-code)    cmd_rollback_code "${2:-}" "${3:-}" ;;
  rollback-full)    cmd_rollback_full "${2:-}" "${3:-}" ;;
  config-deploy)    cmd_config_deploy "${2:-}" ;;
  list-config)      cmd_list_config "${2:-}" ;;
  show-config)      cmd_show_config "${2:-}" ;;
  rollback-config)  cmd_rollback_config "${2:-}" "${3:-}" ;;
  ""|-h|--help|help) usage ;;
  *) echo "ERROR: unknown command '${1}'"; usage; exit 1 ;;
esac
