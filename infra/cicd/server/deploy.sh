#!/bin/bash
set -euo pipefail

# =============================================================================
# CRM Backend — CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>                  Deploy — records a new numbered build
#   ./deploy.sh list [dev|prod]              List recorded builds (optionally filtered)
#   ./deploy.sh show <build>                 Print one build's manifest.json
#   ./deploy.sh rollback-code <env> <build>  Point both Lambdas at that build's
#                                             code (fast, code only — no CFN change)
#   ./deploy.sh rollback-full <env> <build>  Redeploy that build's saved CFN
#                                             template(s) + params, then its code
#   ./deploy.sh config-deploy <dev|prod>     Config-only deploy — SSM Parameter
#                                             Store sync + Lambda cold-start
#                                             touch only, no CFN/build/zip. See
#                                             apps/crm/server/infra/config-deploy.sh and
#                                             docs/proposals/config-only-deploy/
#                                             context.md.
#   ./deploy.sh list-config [dev|prod]       List recorded config revisions
#   ./deploy.sh show-config <config-version> Print one config revision's manifest.json
#   ./deploy.sh rollback-config <env> <config-version>
#                                             Restore that revision's SSM keys to
#                                             their value immediately before it,
#                                             using SSM's own parameter version
#                                             history (this repo's manifests
#                                             never store actual SSM values —
#                                             most are real secrets — only key
#                                             names and timestamps; SSM already
#                                             keeps every value it ever held).
#
# Every deploy call delegates the actual packaging/CFN work to the real
# script: apps/crm/server/infra/deploy.sh. This wrapper's only job is release
# bookkeeping. Design mirrors infra/cicd/reality-flow-authentication
# (same manifest shape, same global build counter, same S3 tagging, same
# rollback philosophy — a rollback is a new forward build, never an edit to
# history) with two structural differences:
#
#   1. Server's code artifact is already uploaded to a TIMESTAMPED, unique-
#      per-deploy key (`${ARTIFACT_PREFIX}/function-<timestamp>.zip`) by
#      apps/crm/server/infra/deploy.sh itself — never overwritten, no S3 versioning
#      needed to reach an old one. That timestamp is computed inside that
#      script, at a point this wrapper can't independently reconstruct — so
#      it writes the exact keys it used to infra/.last-deploy-artifacts.json
#      (gitignored, a build artifact like cfn-params.json) right after
#      uploading, and this wrapper reads that file back.
#   2. Two Lambdas share that one code artifact (API + call-recording
#      worker) — rollback-code updates both. Two nested route templates
#      (part1/part2) instead of auth's one.
#
# Build numbers are GLOBAL (one counter across dev AND prod, not one per
# env) — "build #7" is unambiguous on its own; which env it targeted is
# recorded inside it.
#
# S3 layout under the artifact bucket (dev-realestateflow-artifacts /
# prod-realestateflow-artifacts — one bucket per environment, per
# infra/cicd/common-infra/vpc-networking.yaml):
#   ${ARTIFACT_PREFIX}/function-<timestamp>.zip          "latest" code — the
#   ${ARTIFACT_PREFIX}/cfn-backend.yaml                  ONE set of keys the
#   ${ARTIFACT_PREFIX}/apigw-explicit-routes-part1.yaml  Lambdas/CFN actually
#   ${ARTIFACT_PREFIX}/apigw-explicit-routes-part2.yaml  read; templates get
#                                                         overwritten each
#                                                         deploy, the zip key
#                                                         is always new
#   ${ARTIFACT_PREFIX}/builds/<build>/<env>/cfn-backend.yaml
#   ${ARTIFACT_PREFIX}/builds/<build>/<env>/apigw-explicit-routes-part1.yaml
#   ${ARTIFACT_PREFIX}/builds/<build>/<env>/apigw-explicit-routes-part2.yaml
#   ${ARTIFACT_PREFIX}/builds/<build>/<env>/code/function.zip
#     (code/ is a directory, not a fixed filename — if server ever splits
#     into more than one deployable artifact, each just gets its own file
#     here with no structural change)
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
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../../apps/crm/server" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
VERSIONS_DIR="$SCRIPT_DIR/deploy-versions"
CONFIG_VERSIONS_DIR="$SCRIPT_DIR/config-versions"

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
  ./deploy.sh rollback-code <env> <build>  Roll back code only (fast, both Lambdas)
  ./deploy.sh rollback-full <env> <build>  Roll back CFN template(s)+params, then code
  ./deploy.sh config-deploy <dev|prod>     Config-only deploy (SSM sync, no build)
  ./deploy.sh list-config [dev|prod]       List recorded config revisions
  ./deploy.sh show-config <config-version> Print one config revision's manifest.json
  ./deploy.sh rollback-config <env> <config-version>
                                            Restore that revision's SSM keys via
                                            SSM's own version history
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

# require_custom_domain_endpoints <env> — caller must already have sourced
# apps/crm/server/.env.<env>. Every API endpoint server owns or calls must be an API
# Gateway custom domain + base path pair (<STEM>_DOMAIN_NAME +
# <STEM>_BASE_PATH), never a raw execute-api URL. Shared with
# apps/crm/server/infra/deploy.sh and config-deploy.sh.
require_custom_domain_endpoints() {
  local env="$1"
  # shellcheck disable=SC1091
  source "$SERVICE_DIR/infra/lib/validate-service-endpoints.sh"
  if ! validate_service_endpoints "apps/crm/server/.env.$env"; then
    echo "Refusing to deploy: fix the custom-domain settings in apps/crm/server/.env.$env first."
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

# ---- config-version counter — SEPARATE track from the build counter above,
# also global across dev/prod, mirroring infra/cicd/reality-flow-
# authentication's identical design for the same reasons -------------------
next_config_version() {
  mkdir -p "$CONFIG_VERSIONS_DIR"
  local max=0
  shopt -s nullglob
  for d in "$CONFIG_VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -d "$d" ] || continue
    local n
    n="$(basename "$d")"
    n=$((10#$n))
    if [ "$n" -gt "$max" ]; then max=$n; fi
  done
  shopt -u nullglob
  printf "%04d" "$((max + 1))"
}

# latest_build_for_env <env> — highest-numbered successfully-deployed build
# recorded for that specific env (build numbers are global, so this scans
# and filters rather than trusting deploy-versions/LATEST, which tracks the
# latest build across BOTH envs).
latest_build_for_env() {
  local env="$1"
  local max=0
  shopt -s nullglob
  for d in "$VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -f "$d/manifest.json" ] || continue
    local e s n
    e="$(json_read "$d/manifest.json" env 2>/dev/null || echo '')"
    s="$(json_read "$d/manifest.json" status 2>/dev/null || echo '')"
    if [ "$e" = "$env" ] && [ "$s" = "deployed" ]; then
      n="$(basename "$d")"
      n=$((10#$n))
      if [ "$n" -gt "$max" ]; then max=$n; fi
    fi
  done
  shopt -u nullglob
  printf "%04d" "$max"
}

# write_config_manifest <out-file> <configVersion> <appliedToBuild> <env> <status> <rollbackOf|null> <changedParamsFile> <commit> <commitShort> <branch> <dirty> <deployer> <deployDate>
write_config_manifest() {
  node -e "
    const fs = require('fs');
    const [ , out, configVersion, appliedToBuild, env, status, rollbackOf, changedParamsFile,
            commit, commitShort, branch, dirty, deployer, deployDate ] = process.argv;
    const changedParams = JSON.parse(fs.readFileSync(changedParamsFile, 'utf8'));
    const manifest = {
      configVersion, appliedToBuild, env, status,
      timestamp: new Date().toISOString(),
      deployDate,
      git: { commit, commitShort, branch, dirty: dirty === 'true' },
      deployer,
      // Key NAMES only (created/updated/deleted, or restored on a
      // rollback) — never values. Most of this service's ~100 SSM-synced
      // keys are real secrets; SSM itself already keeps every value it
      // ever held (see rollback-config, which restores from SSM's own
      // parameter version history instead of from this file).
      changedParams,
      rollbackOf: rollbackOf === 'null' ? null : rollbackOf,
    };
    fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
    fs.appendFileSync(require('path').dirname(out) + '/../history.jsonl', JSON.stringify(manifest) + '\n');
  " "$@"
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
  #   <rollbackOf|null> <rollbackKind|null> <bucket> <codeKey>
  #   <mainTemplateKey> <mainTemplateVersionId>
  #   <routesPart1Key> <routesPart1VersionId>
  #   <routesPart2Key> <routesPart2VersionId>
  #   <buildCodeKey> <buildTemplateKey> <buildRoutesPart1Key> <buildRoutesPart2Key>
  #   <commit> <commitShort> <branch> <dirty> <deployer> <region> <deployDate>
  node -e "
    const fs = require('fs');
    const [ , out, buildNumber, env, status, stackName, rollbackOf, rollbackKind,
            bucket, codeKey,
            mainTemplateKey, mainTemplateVersionId,
            routesPart1Key, routesPart1VersionId,
            routesPart2Key, routesPart2VersionId,
            buildCodeKey, buildTemplateKey, buildRoutesPart1Key, buildRoutesPart2Key,
            commit, commitShort, branch, dirty, deployer, region, deployDate ] = process.argv;
    const manifest = {
      buildNumber, env, status,
      timestamp: new Date().toISOString(),
      deployDate,
      git: { commit, commitShort, branch, dirty: dirty === 'true' },
      deployer, stackName, region,
      artifact: {
        bucket,
        // Unique, never-overwritten key — no VersionId needed for this one;
        // the key itself IS the permanent historical reference.
        codeKey,
        mainTemplateKey, mainTemplateVersionId,
        routesPart1Key, routesPart1VersionId,
        routesPart2Key, routesPart2VersionId,
        buildCodeKey: buildCodeKey || null,
        buildTemplateKey: buildTemplateKey || null,
        buildRoutesPart1Key: buildRoutesPart1Key || null,
        buildRoutesPart2Key: buildRoutesPart2Key || null,
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
  ENVIRONMENT_NAME="$env"

  # Fail before recording a build if any API endpoint is not a custom domain
  # + base path pair (same guard apps/crm/server/infra/deploy.sh runs again itself).
  require_custom_domain_endpoints "$env"

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

  rm -f "$SERVICE_DIR/infra/.last-deploy-artifacts.json"

  local status="failed"
  if "$SERVICE_DIR/infra/deploy.sh" "$env"; then
    status="deployed"
  fi

  # Snapshot the exact templates/params used, regardless of outcome — a
  # failed build's attempted config is still worth keeping for debugging.
  cp "$SERVICE_DIR/infra/cfn-backend.yaml" "$build_dir/cfn-backend.yaml" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/apigw-explicit-routes-part1.yaml" "$build_dir/apigw-explicit-routes-part1.yaml" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/apigw-explicit-routes-part2.yaml" "$build_dir/apigw-explicit-routes-part2.yaml" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/cfn-params.json" "$build_dir/cfn-params.json" 2>/dev/null || true

  local bucket="${ARTIFACT_BUCKET:-unknown}"
  local code_key="unknown"
  local main_key="unknown" main_version="unknown"
  local part1_key="unknown" part1_version="unknown"
  local part2_key="unknown" part2_version="unknown"
  local build_prefix="${ARTIFACT_PREFIX}/builds/${build}/${env}"
  local build_code_key="" build_template_key="" build_part1_key="" build_part2_key=""

  if [ "$status" = "deployed" ]; then
    local artifacts_file="$SERVICE_DIR/infra/.last-deploy-artifacts.json"
    if [ -f "$artifacts_file" ]; then
      bucket="$(json_read "$artifacts_file" artifactBucket)"
      code_key="$(json_read "$artifacts_file" codeS3Key)" || code_key="unknown"
      main_key="$(json_read "$artifacts_file" mainTemplateS3Key)"
      part1_key="$(json_read "$artifacts_file" routesTemplatePart1S3Key)"
      part2_key="$(json_read "$artifacts_file" routesTemplatePart2S3Key)"

      main_version="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$main_key" --region "$AWS_REGION" --query VersionId --output text 2>/dev/null || echo unknown)"
      part1_version="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$part1_key" --region "$AWS_REGION" --query VersionId --output text 2>/dev/null || echo unknown)"
      part2_version="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$part2_key" --region "$AWS_REGION" --query VersionId --output text 2>/dev/null || echo unknown)"
      [ "$main_version" = "None" ] && main_version="unknown"
      [ "$part1_version" = "None" ] && part1_version="unknown"
      [ "$part2_version" = "None" ] && part2_version="unknown"

      # Permanent build+env archive copies. The code key is already unique/
      # timestamped, so this copy is a convenience path, not a rollback
      # necessity — but keeps the same builds/<build>/<env>/ shape as auth.
      build_code_key="${build_prefix}/code/$(basename "$code_key")"
      build_template_key="${build_prefix}/cfn-backend.yaml"
      build_part1_key="${build_prefix}/apigw-explicit-routes-part1.yaml"
      build_part2_key="${build_prefix}/apigw-explicit-routes-part2.yaml"

      "$AWS_BIN" s3 cp "s3://${bucket}/${code_key}" "s3://${bucket}/${build_code_key}" --region "$AWS_REGION" --no-cli-pager
      "$AWS_BIN" s3 cp "$build_dir/cfn-backend.yaml" "s3://${bucket}/${build_template_key}" --region "$AWS_REGION" --no-cli-pager
      "$AWS_BIN" s3 cp "s3://${bucket}/${part1_key}" "s3://${bucket}/${build_part1_key}" --region "$AWS_REGION" --no-cli-pager
      "$AWS_BIN" s3 cp "s3://${bucket}/${part2_key}" "s3://${bucket}/${build_part2_key}" --region "$AWS_REGION" --no-cli-pager

      tag_object "$bucket" "$code_key" "$status"
      tag_object "$bucket" "$main_key" "$status"
      tag_object "$bucket" "$part1_key" "$status"
      tag_object "$bucket" "$part2_key" "$status"
      tag_object "$bucket" "$build_code_key" "$status"
      tag_object "$bucket" "$build_template_key" "$status"
      tag_object "$bucket" "$build_part1_key" "$status"
      tag_object "$bucket" "$build_part2_key" "$status"
    else
      echo "WARNING: deploy reported success but $artifacts_file was not written — apps/crm/server/infra/deploy.sh may be an older version missing this. Artifact keys will be recorded as 'unknown'."
    fi
  fi

  write_manifest "$build_dir/manifest.json" \
    "$build" "$env" "$status" "${STACK_NAME:-unknown}" "null" "null" \
    "$bucket" "$code_key" \
    "$main_key" "$main_version" \
    "$part1_key" "$part1_version" \
    "$part2_key" "$part2_version" \
    "$build_code_key" "$build_template_key" "$build_part1_key" "$build_part2_key" \
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
# config-deploy — delegates to infra/config-deploy.sh, records a config
# revision on its OWN numbering track (config-versions/, not deploy-versions/)
# =============================================================================
cmd_config_deploy() {
  local env="$1"
  require_env_arg "$env"

  set -a
  # shellcheck disable=SC1090
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENVIRONMENT_NAME="$env"

  require_custom_domain_endpoints "$env"

  echo "============================================="
  echo " Config-only deploy ($env) — starting"
  echo " commit: $GIT_COMMIT_SHORT  branch: $GIT_BRANCH  dirty: $GIT_DIRTY  by: $DEPLOYER"
  echo "============================================="

  local plan_file="$SERVICE_DIR/infra/.last-ssm-sync-plan.json"
  rm -f "$plan_file"

  if ! "$SERVICE_DIR/infra/config-deploy.sh" "$env"; then
    echo ""
    echo "Config-only deploy failed or was refused — see output above. No config revision recorded."
    exit 1
  fi

  if [ ! -f "$plan_file" ]; then
    echo ""
    echo "No SSM parameter actually changed — no config revision recorded."
    return 0
  fi

  local changed_count
  changed_count="$(node -e "
    const p = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    process.stdout.write(String(p.created.length + p.updated.length + p.deleted.length));
  " "$plan_file")"
  if [ "$changed_count" -eq 0 ]; then
    echo ""
    echo "No SSM parameter actually changed — no config revision recorded."
    return 0
  fi

  local build
  build="$(latest_build_for_env "$env")"

  local cfg
  cfg="$(next_config_version)"
  local cfg_dir="$CONFIG_VERSIONS_DIR/$cfg"
  mkdir -p "$cfg_dir"
  cp "$plan_file" "$cfg_dir/changed-params.json"

  write_config_manifest "$cfg_dir/manifest.json" \
    "$cfg" "$build" "$env" "applied" "null" "$cfg_dir/changed-params.json" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "$DEPLOY_DATE"

  echo "$cfg" > "$CONFIG_VERSIONS_DIR/LATEST"

  echo ""
  echo "Config revision #$cfg recorded (env: $env, applied to build #$build): $cfg_dir/manifest.json"
}

# =============================================================================
# list-config / show-config
# =============================================================================
cmd_list_config() {
  local filter_env="${1:-}"
  if [ ! -d "$CONFIG_VERSIONS_DIR" ]; then
    echo "No config revisions recorded yet."
    return 0
  fi

  printf "%-9s %-6s %-11s %-9s %-21s %-9s %-20s %-11s\n" "CONFIG_V" "ENV" "APPLIED_TO" "STATUS" "TIMESTAMP" "COMMIT" "BRANCH" "ROLLBACK_OF"
  shopt -s nullglob
  for d in "$CONFIG_VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -f "$d/manifest.json" ] || continue
    node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const filterEnv = process.argv[2];
      if (filterEnv && m.env !== filterEnv) process.exit(0);
      const row = [m.configVersion, m.env, 'build#' + m.appliedToBuild, m.status, m.timestamp, m.git.commitShort, m.git.branch, m.rollbackOf || '-'];
      console.log(row.map((v,i)=>String(v).padEnd([9,6,11,9,21,9,20,11][i])).join(' '));
    " "$d/manifest.json" "$filter_env"
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

# verify_config_env <configVersion> <env> <manifest-path>
verify_config_env() {
  local cfg="$1" env="$2" m="$3"
  local actual_env
  actual_env="$(json_read "$m" env)"
  if [ "$actual_env" != "$env" ]; then
    echo "ERROR: config revision #$cfg was applied to '$actual_env', not '$env' — refusing to roll back the wrong environment with it."
    exit 1
  fi
}

# =============================================================================
# rollback-config — restore a prior config revision's SSM keys to whatever
# value they held immediately before that revision, using SSM's OWN
# parameter version history (get-parameter-history) rather than any value
# this repo stores itself (changed-params.json only ever holds key NAMES —
# most of these ~100 keys are real secrets, and SSM already keeps every
# value it ever held, which is a strictly better rollback source: no risk of
# this repo's own records going stale or leaking a secret onto disk here).
# A key the target revision CREATED (no prior version to restore) is
# deleted instead. Recorded as a new forward config revision, same
# principle rollback-code/rollback-full already use for the build track.
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

  set -a
  # shellcheck disable=SC1090
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENVIRONMENT_NAME="$env"

  local before_timestamp
  before_timestamp="$(json_read "$m" timestamp)"
  local prefix="/${env}/realestateflow/server/"

  echo "Rolling back config revision #$cfg's SSM keys to their value immediately before ${before_timestamp}..."

  local RESTORED_KEYS_FILE="$cfg_dir/.rollback-restored.json"
  node -e "console.log(JSON.stringify([]))" > "$RESTORED_KEYS_FILE"

  restore_one_key() {
    local key="$1"
    local name="${prefix}${key}"
    local history_json
    history_json="$("$AWS_BIN" ssm get-parameter-history \
      --name "$name" --with-decryption --region "$AWS_REGION" \
      --query "Parameters[].[Version,LastModifiedDate,Value]" \
      --output json --no-cli-pager 2>/dev/null || echo '[]')"

    local prior_value
    prior_value="$(node -e "
      const rows = JSON.parse(process.argv[1]);
      const cutoff = new Date(process.argv[2]).getTime();
      let best = null;
      for (const [version, lastModified, value] of rows) {
        const t = new Date(lastModified).getTime();
        if (t < cutoff && (best === null || t > best.t)) best = { t, value };
      }
      if (best) process.stdout.write(JSON.stringify(best.value));
    " "$history_json" "$before_timestamp")"

    if [ -z "$prior_value" ]; then
      echo "  $key: no version before this revision — deleting (it did not exist prior to #${cfg})."
      "$AWS_BIN" ssm delete-parameter --name "$name" --region "$AWS_REGION" --no-cli-pager 2>/dev/null || true
    else
      local real_value
      real_value="$(node -e "process.stdout.write(JSON.parse(process.argv[1]))" "$prior_value")"
      echo "  $key: restoring version prior to #${cfg}."
      "$AWS_BIN" ssm put-parameter --name "$name" --value "$real_value" --type SecureString --overwrite --region "$AWS_REGION" --no-cli-pager
    fi
    node -e "
      const fs = require('fs');
      const arr = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      arr.push(process.argv[2]);
      fs.writeFileSync(process.argv[1], JSON.stringify(arr));
    " "$RESTORED_KEYS_FILE" "$key"
  }

  for key in $(node -e "
    const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    const c = m.changedParams || {};
    [...(c.created||[]), ...(c.updated||[]), ...(c.deleted||[])].forEach(k => console.log(k));
  " "$m"); do
    restore_one_key "$key"
  done

  echo "Forcing fresh execution environments..."
  for fn in "${ENVIRONMENT_NAME}-realestateflow-api" "${ENVIRONMENT_NAME}-realestateflow-call-recording-worker" "${ENVIRONMENT_NAME}-realestateflow-meeting-reminder"; do
    local current_env
    if ! current_env="$("$AWS_BIN" lambda get-function-configuration --function-name "$fn" --region "$AWS_REGION" --query "Environment.Variables" --output json --no-cli-pager 2>/dev/null)"; then
      echo "  Skipping $fn (not found)."
      continue
    fi
    local merged
    merged="$(node -e "
      const vars = JSON.parse(process.argv[1] === 'null' ? '{}' : process.argv[1]);
      vars.CONFIG_APPLIED_AT = new Date().toISOString();
      process.stdout.write(JSON.stringify({ Variables: vars }));
    " "$current_env")"
    echo "  Touching $fn..."
    "$AWS_BIN" lambda update-function-configuration --function-name "$fn" --environment "$merged" --region "$AWS_REGION" --no-cli-pager >/dev/null
  done

  local build
  build="$(latest_build_for_env "$env")"
  local new_cfg
  new_cfg="$(next_config_version)"
  local new_dir="$CONFIG_VERSIONS_DIR/$new_cfg"
  mkdir -p "$new_dir"

  node -e "
    const fs = require('fs');
    const restored = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    fs.writeFileSync(process.argv[2], JSON.stringify({ restored }, null, 2) + '\n');
  " "$RESTORED_KEYS_FILE" "$new_dir/changed-params.json"
  rm -f "$RESTORED_KEYS_FILE"

  write_config_manifest "$new_dir/manifest.json" \
    "$new_cfg" "$build" "$env" "applied" "$cfg" "$new_dir/changed-params.json" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "$DEPLOY_DATE"

  echo "$new_cfg" > "$CONFIG_VERSIONS_DIR/LATEST"
  echo ""
  echo "Rolled back config revision #$cfg. Recorded as new config revision #$new_cfg (rollbackOf: #$cfg)."
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
# rollback-code — fast path: point both Lambdas at an old code artifact
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
  ENVIRONMENT_NAME="$env"

  local bucket key
  bucket="$(json_read "$m" artifact.bucket)"
  key="$(json_read "$m" artifact.codeKey)" || true

  if [ -z "${key:-}" ] || [ "$key" = "unknown" ]; then
    echo "ERROR: build #$build has no recorded code key — cannot roll back code from it."
    exit 1
  fi

  echo "Checking archival status of s3://$bucket/$key ..."
  local storage_class
  storage_class="$("$AWS_BIN" s3api head-object --bucket "$bucket" --key "$key" --region "$AWS_REGION" --query StorageClass --output text 2>/dev/null || echo STANDARD)"
  [ "$storage_class" = "None" ] && storage_class="STANDARD"

  if [ "$storage_class" = "DEEP_ARCHIVE" ] || [ "$storage_class" = "GLACIER" ]; then
    cat <<EOF

This build's code is in $storage_class — it must be restored before Lambda can read it.
Run:
  $AWS_BIN s3api restore-object --bucket $bucket --key $key --region $AWS_REGION \\
    --restore-request '{"Days":7,"GlacierJobParameters":{"Tier":"Standard"}}'

Then wait for the restore (~12h for Deep Archive Standard tier; check with):
  $AWS_BIN s3api head-object --bucket $bucket --key $key --region $AWS_REGION --query Restore

Re-run this rollback-code command once that shows the restore is complete.
EOF
    exit 1
  fi

  echo "Rolling back code: s3://$bucket/$key"

  "$AWS_BIN" lambda update-function-code \
    --function-name "${ENVIRONMENT_NAME}-realestateflow-api" \
    --s3-bucket "$bucket" \
    --s3-key "$key" \
    --region "$AWS_REGION" \
    --no-cli-pager

  # The call-recording worker ships the same zip with a different handler —
  # a code-only rollback has to refresh it too or the two drift apart, same
  # reasoning as the direct-update path in apps/crm/server/infra/deploy.sh itself.
  local worker_name="${ENVIRONMENT_NAME}-realestateflow-call-recording-worker"
  if "$AWS_BIN" lambda get-function --function-name "$worker_name" --region "$AWS_REGION" > /dev/null 2>&1; then
    "$AWS_BIN" lambda update-function-code \
      --function-name "$worker_name" \
      --s3-bucket "$bucket" \
      --s3-key "$key" \
      --region "$AWS_REGION" \
      --no-cli-pager
  else
    echo "Note: call-recording worker Lambda ($worker_name) not found — skipped (not deployed in this env, or Call Intelligence not provisioned)."
  fi

  echo "Rolled back code to build #$build ($key)."

  tag_object "$bucket" "$key" "deployed"

  # Record the rollback as its own new build — a rollback is a new forward
  # release, not an edit to history, per standard CI/CD release practice.
  local new_build
  new_build="$(next_build_number)"
  local new_dir="$VERSIONS_DIR/$new_build"
  mkdir -p "$new_dir"
  cp "$build_dir"/*.yaml "$new_dir/" 2>/dev/null || true
  cp "$build_dir/cfn-params.json" "$new_dir/" 2>/dev/null || true

  write_manifest "$new_dir/manifest.json" \
    "$new_build" "$env" "deployed" "${STACK_NAME:-unknown}" "$build" "code-only" \
    "$bucket" "$key" \
    "$(json_read "$m" artifact.mainTemplateKey)" "$(json_read "$m" artifact.mainTemplateVersionId)" \
    "$(json_read "$m" artifact.routesPart1Key)" "$(json_read "$m" artifact.routesPart1VersionId)" \
    "$(json_read "$m" artifact.routesPart2Key)" "$(json_read "$m" artifact.routesPart2VersionId)" \
    "$(json_read "$m" artifact.buildCodeKey 2>/dev/null || echo '')" \
    "$(json_read "$m" artifact.buildTemplateKey 2>/dev/null || echo '')" \
    "$(json_read "$m" artifact.buildRoutesPart1Key 2>/dev/null || echo '')" \
    "$(json_read "$m" artifact.buildRoutesPart2Key 2>/dev/null || echo '')" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "${AWS_REGION:-unknown}" "$DEPLOY_DATE"

  echo "$new_build" > "$VERSIONS_DIR/LATEST"
  echo "Recorded as build #$new_build (rollbackOf: #$build, code-only)."
}

# =============================================================================
# rollback-full — redeploy a build's saved CFN template(s) + params, then code
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
    echo "(rollback-code may still work if it has a recorded code key.)"
    exit 1
  fi

  set -a
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENVIRONMENT_NAME="$env"

  echo "Full rollback to build #$build: redeploying its saved CFN template(s) + params, then its code."
  echo "This runs a normal 'aws cloudformation deploy' with historical files."

  local bucket
  bucket="$(json_read "$m" artifact.bucket)"

  # Re-upload nested route templates AND the main template from the LOCAL
  # snapshot, not from S3 — the S3 copies may have moved to Deep Archive by
  # now and take hours to restore; the local snapshots are instant and
  # identical content.
  local part1_key part2_key main_key
  part1_key="$(json_read "$m" artifact.routesPart1Key)"
  part2_key="$(json_read "$m" artifact.routesPart2Key)"
  main_key="$(json_read "$m" artifact.mainTemplateKey)"

  if [ -f "$build_dir/apigw-explicit-routes-part1.yaml" ]; then
    "$AWS_BIN" s3 cp "$build_dir/apigw-explicit-routes-part1.yaml" "s3://$bucket/$part1_key" --region "$AWS_REGION" --no-cli-pager
    tag_object "$bucket" "$part1_key" "deployed"
  fi
  if [ -f "$build_dir/apigw-explicit-routes-part2.yaml" ]; then
    "$AWS_BIN" s3 cp "$build_dir/apigw-explicit-routes-part2.yaml" "s3://$bucket/$part2_key" --region "$AWS_REGION" --no-cli-pager
    tag_object "$bucket" "$part2_key" "deployed"
  fi
  "$AWS_BIN" s3 cp "$build_dir/cfn-backend.yaml" "s3://$bucket/$main_key" --region "$AWS_REGION" --no-cli-pager
  tag_object "$bucket" "$main_key" "deployed"

  "$AWS_BIN" cloudformation deploy \
    --template-file "$build_dir/cfn-backend.yaml" \
    --stack-name "${STACK_NAME}" \
    --s3-bucket "$bucket" \
    --s3-prefix "${ARTIFACT_PREFIX}" \
    --parameter-overrides "file://$build_dir/cfn-params.json" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --no-fail-on-empty-changeset

  echo "CFN template(s)/params restored from build #$build. Rolling back code next..."
  cmd_rollback_code "$env" "$build"
}

# =============================================================================
# dispatch
# =============================================================================
mkdir -p "$VERSIONS_DIR" "$CONFIG_VERSIONS_DIR"

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
  config-deploy)
    cmd_config_deploy "${2:-}"
    ;;
  list-config)
    cmd_list_config "${2:-}"
    ;;
  show-config)
    cmd_show_config "${2:-}"
    ;;
  rollback-config)
    cmd_rollback_config "${2:-}" "${3:-}"
    ;;
  dev|prod)
    cmd_deploy "$1"
    ;;
  *)
    usage
    exit 1
    ;;
esac
