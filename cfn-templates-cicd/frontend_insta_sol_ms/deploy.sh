#!/bin/bash
set -euo pipefail

# =============================================================================
# Instagram Solution frontend - CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>              Deploy - records a new numbered build
#   ./deploy.sh list [dev|prod]         List recorded builds
#   ./deploy.sh show <build>            Print one build's manifest.json
#   ./deploy.sh rollback <env> <build>  Redeploy that build's saved template+params
#
# Every deploy delegates the actual build/CFN work to the real script,
# frontend_insta_sol_ms/infra/deploy.sh. This wrapper's only job is release
# bookkeeping, matching the design already used by
# cfn-templates-cicd/{server,reality-flow-authentication,real-estate-crm-app}.
#
# Build numbers are GLOBAL (one counter across dev AND prod, not one per env) -
# "build 0007" is unambiguous on its own; which env it targeted is recorded
# inside the manifest, not encoded by which counter produced it.
#
# S3 layout under the env's artifact bucket:
#   <prefix>/builds/<build>/<env>/cfn-insta-frontend.yaml   permanent, never
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
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../frontend_insta_sol_ms" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSIONS_DIR="$SCRIPT_DIR/deploy-versions"
CONFIG_VERSIONS_DIR="$SCRIPT_DIR/config-versions"
SERVICE_NAME="realestateflow-insta-frontend"

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
  ./deploy.sh content-deploy <env>    VITE_*-only change (rebuild+sync, no CFN)
  ./deploy.sh config-deploy <env>     CrmDistributionId-only change (no build)
  ./deploy.sh list-config [env]       List recorded config revisions
  ./deploy.sh show-config <config-version>
                                       Print one config revision's manifest.json
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

require_config_version_arg() {
  local c="${1:-}"
  if ! [[ "$c" =~ ^[0-9]{4}$ ]]; then
    echo "ERROR: config version must be 4 digits, e.g. 0007 (got: '${c}')"
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
  # delegate_script: which infra/ script does the work. Defaults to the
  # full deploy.sh; cmd_content_deploy passes content-deploy.sh, which runs
  # its own safety check (verifies no CFN parameter differs from live)
  # before calling deploy.sh --skip-cfn itself.
  local delegate_script="${2:-deploy.sh}"
  require_env_arg "$env"
  load_env_file "$env"

  local build
  build="$(next_build_number)"
  local build_dir="$VERSIONS_DIR/$build"
  mkdir -p "$build_dir"

  echo "============================================="
  echo " Instagram frontend - build $build -> $env"
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
  ( cd "$SERVICE_DIR" && "./infra/$delegate_script" "$env" )
  local rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    status="failed"
  fi

  # Snapshot template + params locally for instant rollback access.
  cp "$SERVICE_DIR/infra/cfn-insta-frontend.yaml" "$build_dir/" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/cfn-params.json" "$build_dir/" 2>/dev/null || true

  # A static site has no single versioned "code object" the way a Lambda service
  # does - the live bucket IS the deployed artifact, and `s3 sync --delete`
  # removes files a later build no longer ships. So archive the actual dist/
  # output per build, otherwise an older build becomes unrecoverable.
  if [ -d "$SERVICE_DIR/dist" ] && command -v tar >/dev/null 2>&1; then
    tar -czf "$build_dir/dist.tar.gz" -C "$SERVICE_DIR" dist 2>/dev/null || \
      echo "  WARNING: could not archive dist/"
  fi

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
  for f in cfn-insta-frontend.yaml cfn-params.json manifest.json dist.tar.gz; do
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
# content-deploy — a pure VITE_*-only change: rebuild + re-sync content,
# skip the CloudFormation update. Records a normal numbered build, not a
# config revision (see cmd_config_deploy below for the CFN-parameter-only
# axis).
# =============================================================================
cmd_content_deploy() {
  local env="$1"
  require_env_arg "$env"
  cmd_deploy "$env" content-deploy.sh
}

# =============================================================================
# config-deploy — CFN-parameter-only change (CrmDistributionId). Delegates
# to infra/config-deploy.sh, records a config revision on its OWN numbering
# track (config-versions/, not deploy-versions/).
# =============================================================================
cmd_config_deploy() {
  local env="$1"
  require_env_arg "$env"
  load_env_file "$env"

  echo "============================================="
  echo " Instagram frontend - config-only deploy -> $env"
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
# values on top of whatever content build is CURRENTLY live. Recorded as a
# new forward config revision.
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

  load_env_file "$env"

  echo "Rolling back config to revision #$cfg ($env) — reapplying its allowlisted parameter"
  echo "values on top of whatever content build is currently live."

  local allowlist_file="$SERVICE_DIR/infra/config-only-allowed-params.json"
  local live_params_json
  if ! live_params_json="$("$AWS_BIN" cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager \
        --query "Stacks[0].Parameters" --output json 2>/dev/null)"; then
    echo "ERROR: stack $STACK_NAME does not exist (or isn't reachable)."
    exit 1
  fi

  # This service's config-versions manifest carries the diff (from/to), not
  # a full params-snapshot.json the way the other services' wrappers do —
  # with only one allowlisted key (CrmDistributionId) total, restoring
  # straight from the diff's "to" values recorded at revision time is
  # equivalent and needs no separate snapshot file.
  local overrides_file="$cfg_dir/.rollback-overrides.json"
  node -e "
    const fs = require('fs');
    const live = JSON.parse(process.argv[1]);
    const liveMap = {};
    for (const p of live) liveMap[p.ParameterKey] = p.ParameterValue;
    const changed = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const allowed = new Set(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).allowedParams);
    const out = [];
    for (const key of Object.keys(liveMap)) {
      if (allowed.has(key) && key in changed) { out.push(key + '=' + changed[key].to); continue; }
      if (liveMap[key] === '****') continue;
      out.push(key + '=' + liveMap[key]);
    }
    fs.writeFileSync(process.argv[4], JSON.stringify(out));
  " "$live_params_json" "$cfg_dir/changed-params.json" "$allowlist_file" "$overrides_file"

  mapfile -t PARAM_OVERRIDES < <(node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).forEach(x=>console.log(x))" "$overrides_file")
  rm -f "$overrides_file"

  "$AWS_BIN" cloudformation deploy \
    --template-file "$SERVICE_DIR/infra/cfn-insta-frontend.yaml" \
    --stack-name "$STACK_NAME" \
    --no-fail-on-empty-changeset \
    --tags Environment="$env" Service=realestateflow-insta-frontend \
    --parameter-overrides "${PARAM_OVERRIDES[@]}" \
    --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager

  local build
  build="$(latest_build_for_env "$env")"
  local new_cfg
  new_cfg="$(next_config_version)"
  local new_dir="$CONFIG_VERSIONS_DIR/$new_cfg"
  mkdir -p "$new_dir"

  node -e "
    const fs = require('fs');
    const changed = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const out = {};
    for (const [k, v] of Object.entries(changed)) out[k] = { from: null, to: v.to, note: 'restored via rollback-config from #${cfg}' };
    fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
  " "$cfg_dir/changed-params.json" "$new_dir/changed-params.json"

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

cmd_rollback() {
  local env="${1:-}"
  local build="${2:-}"
  require_env_arg "$env"
  require_build_arg "$build"
  load_env_file "$env"

  local build_dir="$VERSIONS_DIR/$build"
  local tpl="$build_dir/cfn-insta-frontend.yaml"
  local prm="$build_dir/cfn-params.json"

  if [ ! -f "$tpl" ] || [ ! -f "$prm" ]; then
    echo "Local snapshot missing; pulling build $build from S3..."
    mkdir -p "$build_dir"
    local prefix="${ARTIFACT_PREFIX}/builds/${build}/${env}"
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${prefix}/cfn-insta-frontend.yaml" "$tpl" \
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

  # A CFN rollback alone changes nothing a user can see - the bucket still holds
  # the newest build's files. Restoring the archived dist/ is the part that
  # actually rolls the site back.
  local archive="$build_dir/dist.tar.gz"
  if [ ! -f "$archive" ]; then
    echo "Pulling build $build dist archive from S3..."
    "$AWS_BIN" s3 cp "s3://${ARTIFACT_BUCKET}/${ARTIFACT_PREFIX}/builds/${build}/${env}/dist.tar.gz" "$archive" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager || true
  fi

  if [ -f "$archive" ]; then
    local tmp
    tmp="$(mktemp -d)"
    tar -xzf "$archive" -C "$tmp"
    echo "Restoring build $build content to s3://${BUCKET_NAME}/insta/ ..."
    "$AWS_BIN" s3 sync "$tmp/dist/" "s3://${BUCKET_NAME}/insta/" \
      --delete --exclude "index.html" \
      --cache-control "public,max-age=31536000,immutable" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
    "$AWS_BIN" s3 cp "$tmp/dist/index.html" "s3://${BUCKET_NAME}/insta/index.html" \
      --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html" \
      --region "$AWS_REGION" --profile "$AWS_PROFILE" --no-cli-pager
    rm -rf "$tmp"

    if [ -n "${CRM_DISTRIBUTION_ID:-}" ]; then
      "$AWS_BIN" cloudfront create-invalidation \
        --distribution-id "$CRM_DISTRIBUTION_ID" --paths "/insta/*" \
        --profile "$AWS_PROFILE" --no-cli-pager >/dev/null
      echo "Invalidated /insta/* on ${CRM_DISTRIBUTION_ID}."
    fi
  else
    echo "WARNING: no dist archive for build $build - CFN rolled back but the"
    echo "         live content is unchanged."
  fi

  echo "Rollback to build $build complete."
}

case "${1:-}" in
  dev|prod)         cmd_deploy "$1" ;;
  list)             cmd_list "${2:-}" ;;
  show)             cmd_show "${2:-}" ;;
  rollback)         cmd_rollback "${2:-}" "${3:-}" ;;
  content-deploy)   cmd_content_deploy "${2:-}" ;;
  config-deploy)    cmd_config_deploy "${2:-}" ;;
  list-config)      cmd_list_config "${2:-}" ;;
  show-config)      cmd_show_config "${2:-}" ;;
  rollback-config)  cmd_rollback_config "${2:-}" "${3:-}" ;;
  ""|-h|--help|help) usage ;;
  *) echo "ERROR: unknown command '${1}'"; usage; exit 1 ;;
esac
