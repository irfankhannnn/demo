#!/bin/bash
set -euo pipefail

# =============================================================================
# WhatsApp Platform — CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|staging|prod>          Deploy — records a new numbered build
#   ./deploy.sh list [env]                   List recorded builds (optionally filtered)
#   ./deploy.sh show <build>                 Print one build's manifest.json
#   ./deploy.sh rollback-code <env> <build>  Point ECS at that build's exact image
#                                             (fast — skips docker build/push)
#   ./deploy.sh rollback-full <env> <build>  Redeploy that build's saved CFN
#                                             template + params (also pins the image)
#   ./deploy.sh start|stop|status|endpoint <env>
#                                             Pure ECS service control, no build
#                                             recorded — passthrough to infra/deploy.sh
#   ./deploy.sh config-deploy <dev|staging|prod>
#                                             Config-only deploy — skips the Docker
#                                             build/ECR push, pins the image tag to
#                                             whatever is live, applies only
#                                             allowlisted CFN parameter changes. See
#                                             infra/config-deploy.sh and
#                                             docs/proposals/config-only-deploy/
#                                             context.md.
#   ./deploy.sh list-config [env]            List recorded config revisions
#   ./deploy.sh show-config <config-version> Print one config revision's manifest.json
#   ./deploy.sh rollback-config <env> <config-version>
#                                             Reapply an old config revision's
#                                             allowlisted parameter values on top
#                                             of whatever image build is live
#
# Every deploy call delegates the actual build/packaging/CFN work to the real
# script: platform/whatsapp-platform/infra/deploy.sh. This wrapper's only job is
# release bookkeeping — see README.md in this folder for the full design.
# Design mirrors infra/cicd/platform/auth and
# infra/cicd/agency-app/api (same manifest shape, same global build counter,
# same rollback philosophy — a rollback is a new forward build, never an edit
# to history), with structural differences driven by this service being a
# Docker/ECS/Fargate app rather than a Lambda:
#
#   1. No S3 code artifact — the "code" is a Docker image in ECR. Every
#      deploy is pushed under a unique, immutable tag (git short SHA + UTC
#      timestamp) computed inside infra/deploy.sh, at a point this wrapper
#      can't independently reconstruct — so, exactly like server/deploy.sh
#      does for its timestamped S3 key, it writes the exact identity it used
#      to infra/.last-deploy-artifacts.json (gitignored, a build artifact)
#      right after resolving it, and this wrapper reads that file back.
#   2. No S3 object tagging — there's no per-image equivalent of S3 object
#      tags in ECR (only whole-repository resource tags), so the immutable
#      image tag itself is the sole historical marker, the same way server's
#      timestamped S3 key needs no additional versioning to stay unique.
#   3. ECS/Fargate task definitions are CloudFormation-managed — there is no
#      code-only update path like Lambda's `update-function-code`. Both
#      rollback-code and rollback-full go through `aws cloudformation
#      deploy`; rollback-code just skips the docker build/push step and
#      pins IMAGE_TAG at the old build's image via infra/deploy.sh's own
#      SKIP_BUILD support, so it's still the fast path.
#   4. Three environments (dev/staging/prod), not two — this service also
#      supports `staging`, matching infra/deploy.sh.
#   5. dev's stack name is a historical exception. Every other service uses
#      "${env}-realestateflow-*"; this service's live dev stack was created
#      before that convention existed (dev-realestate-flow-whatsapp-platform,
#      hyphenated, deployed 2026-07-04) and dev keeps that literal name so a
#      deploy updates the running stack instead of creating an orphan next
#      to it. staging/prod (no live stack yet) use the correct convention
#      from the start — see stack_name_for_env() below and the matching
#      comment in infra/deploy.sh.
#
# Build numbers are GLOBAL (one counter across all envs, not one per env) —
# "build #7" is unambiguous on its own; which env it targeted is recorded
# inside it, not encoded by which counter produced it.
#
# Build history lives locally in ./deploy-versions/ — gitignored (see the
# root .gitignore and README.md in this folder). Unlike auth/server, there
# is no separate durable S3 archive to fall back on for the CFN
# template/params — this local snapshot IS the only historical copy, so
# never delete deploy-versions/ if you might need rollback-full later.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../../../platform/whatsapp-platform" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
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

# Convert a POSIX path to a Windows-style path when running under Git Bash/MSYS/Cygwin.
# AWS CLI (a Windows process) cannot read /c/... paths, so file:// URLs need C:/... paths.
# Same helper as agency-app/api/infra/deploy.sh and platform/whatsapp-platform/infra/deploy.sh.
winpath() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  elif command -v wslpath >/dev/null 2>&1; then
    wslpath -m "$1"
  else
    echo "$1"
  fi
}

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh <dev|staging|prod>           Deploy — records a new numbered build
  ./deploy.sh list [env]                    List recorded builds (optionally filtered by env)
  ./deploy.sh show <build>                  Print one build's manifest.json
  ./deploy.sh rollback-code <env> <build>   Roll back to a build's exact image (fast)
  ./deploy.sh rollback-full <env> <build>   Roll back CFN template+params, pinning that image
  ./deploy.sh start <env>                   Set ECS desired count to 1 (no build recorded)
  ./deploy.sh stop <env>                    Set ECS desired count to 0 (no build recorded)
  ./deploy.sh status <env>                  Show current service status (no build recorded)
  ./deploy.sh endpoint <env>                Show current task public IP (no build recorded)
  ./deploy.sh config-deploy <dev|staging|prod>
                                             Config-only deploy (skip Docker build/push)
  ./deploy.sh list-config [env]             List recorded config revisions
  ./deploy.sh show-config <config-version>  Print one config revision's manifest.json
  ./deploy.sh rollback-config <env> <config-version>
                                             Reapply an old config revision's params
USAGE
}

require_env_arg() {
  local e="${1:-}"
  case "$e" in
    dev|staging|prod) ;;
    *)
      echo "ERROR: environment must be dev, staging, or prod (got: '${e}')"
      usage
      exit 1
      ;;
  esac
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

# stack_name_for_env <env> — must exactly match the formula in
# infra/deploy.sh (the delegate script actually creates/updates the stack;
# this wrapper only needs to know its name for manifests and rollback-full's
# direct CFN calls). dev keeps its pre-existing literal name (the live
# dev-realestate-flow-whatsapp-platform stack predates the repo-wide
# "${env}-realestateflow-*" convention) — see infra/deploy.sh's comment.
stack_name_for_env() {
  local env="$1"
  case "$env" in
    dev) echo "${env}-realestate-flow-whatsapp-platform" ;;
    *)   echo "${env}-realestateflow-whatsapp-platform" ;;
  esac
}

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
# also global across all envs, mirroring platform/auth/server's
# identical design for the same reasons -------------------------------------
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
# recorded for that specific env.
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
      changedParams,
      rollbackOf: rollbackOf === 'null' ? null : rollbackOf,
    };
    fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
    fs.appendFileSync(require('path').dirname(out) + '/../history.jsonl', JSON.stringify(manifest) + '\n');
  " "$@"
}

write_manifest() {
  # write_manifest <out-file> <buildNumber> <env> <status> <stackName>
  #   <rollbackOf|null> <rollbackKind|null>
  #   <ecrRepoName> <ecrRepo> <imageTag> <imageUri> <imageDigest>
  #   <region> <accountId>
  #   <commit> <commitShort> <branch> <dirty> <deployer> <deployDate>
  node -e "
    const fs = require('fs');
    const [ , out, buildNumber, env, status, stackName, rollbackOf, rollbackKind,
            ecrRepoName, ecrRepo, imageTag, imageUri, imageDigest,
            region, accountId,
            commit, commitShort, branch, dirty, deployer, deployDate ] = process.argv;
    const manifest = {
      buildNumber, env, status,
      timestamp: new Date().toISOString(),
      deployDate,
      git: { commit, commitShort, branch, dirty: dirty === 'true' },
      deployer, stackName, region,
      artifact: {
        ecrRepoName, ecrRepo, accountId,
        // The immutable tag+digest ARE the historical reference — no S3
        // versioning or object-tagging equivalent exists for ECR images.
        imageTag, imageUri, imageDigest,
      },
      rollbackOf: rollbackOf === 'null' ? null : rollbackOf,
      rollbackKind: rollbackKind === 'null' ? null : rollbackKind,
    };
    fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
    fs.appendFileSync(require('path').dirname(out) + '/history.jsonl', JSON.stringify(manifest) + '\n');
  " "$@"
}

# record_build <build> <build_dir> <env> <status> <rollbackOf|null> <rollbackKind|null>
# Shared by deploy and rollback-code — both delegate to infra/deploy.sh and
# need the same post-run bookkeeping: snapshot the template/params used,
# read back the resolved image identity, write the manifest.
record_build() {
  local build="$1" build_dir="$2" env="$3" status="$4" rollback_of="$5" rollback_kind="$6"

  # Snapshot the exact template/params used, regardless of outcome — a
  # failed build's attempted config is still worth keeping for debugging.
  cp "$SERVICE_DIR/infra/cfn-platform.yaml" "$build_dir/cfn-platform.yaml" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/cfn-params-${env}.json" "$build_dir/cfn-params-${env}.json" 2>/dev/null || true

  local ecr_repo_name="unknown" ecr_repo="unknown" image_tag="unknown"
  local image_uri="unknown" image_digest="unknown" region="${AWS_REGION:-ap-south-1}" account_id="unknown"

  if [ "$status" = "deployed" ]; then
    local artifacts_file="$SERVICE_DIR/infra/.last-deploy-artifacts.json"
    if [ -f "$artifacts_file" ]; then
      ecr_repo_name="$(json_read "$artifacts_file" ecrRepoName)"
      ecr_repo="$(json_read "$artifacts_file" ecrRepo)"
      image_tag="$(json_read "$artifacts_file" imageTag)"
      image_uri="$(json_read "$artifacts_file" imageUri)"
      image_digest="$(json_read "$artifacts_file" imageDigest)"
      region="$(json_read "$artifacts_file" region)"
      account_id="$(json_read "$artifacts_file" accountId)"
    else
      echo "WARNING: deploy reported success but $artifacts_file was not written — infra/deploy.sh may be an older version missing this. Artifact fields will be recorded as 'unknown'."
    fi
  fi

  write_manifest "$build_dir/manifest.json" \
    "$build" "$env" "$status" "$(stack_name_for_env "$env")" "$rollback_of" "$rollback_kind" \
    "$ecr_repo_name" "$ecr_repo" "$image_tag" "$image_uri" "$image_digest" "$region" "$account_id" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "$DEPLOY_DATE"

  echo "$build" > "$VERSIONS_DIR/LATEST"
  echo ""
  echo "Build #$build recorded: $build_dir/manifest.json (status: $status)"

  if [ "$status" != "deployed" ]; then
    echo "Deploy failed — see output above. This build is recorded as 'failed' and is not a valid rollback target."
    exit 1
  fi
}

# =============================================================================
# deploy — delegates to infra/deploy.sh, then records a build
# =============================================================================
cmd_deploy() {
  local env="$1"
  require_env_arg "$env"

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
  if "$SERVICE_DIR/infra/deploy.sh" deploy "$env"; then
    status="deployed"
  fi

  record_build "$build" "$build_dir" "$env" "$status" "null" "null"
}

# =============================================================================
# config-deploy — delegates to infra/config-deploy.sh, records a config
# revision on its OWN numbering track (config-versions/, not deploy-versions/)
# =============================================================================
cmd_config_deploy() {
  local env="$1"
  require_env_arg "$env"

  echo "============================================="
  echo " Config-only deploy ($env) — starting"
  echo " commit: $GIT_COMMIT_SHORT  branch: $GIT_BRANCH  dirty: $GIT_DIRTY  by: $DEPLOYER"
  echo "============================================="

  local diff_file="$SERVICE_DIR/infra/.last-config-diff.json"
  rm -f "$diff_file"

  if ! ( cd "$SERVICE_DIR" && bash infra/config-deploy.sh "$env" ); then
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
    chmod 600 "$cfg_dir/params-snapshot.json" 2>/dev/null || true
  fi

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

  printf "%-9s %-8s %-11s %-9s %-21s %-9s %-20s %-11s\n" "CONFIG_V" "ENV" "APPLIED_TO" "STATUS" "TIMESTAMP" "COMMIT" "BRANCH" "ROLLBACK_OF"
  shopt -s nullglob
  for d in "$CONFIG_VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -f "$d/manifest.json" ] || continue
    node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const filterEnv = process.argv[2];
      if (filterEnv && m.env !== filterEnv) process.exit(0);
      const row = [m.configVersion, m.env, 'build#' + m.appliedToBuild, m.status, m.timestamp, m.git.commitShort, m.git.branch, m.rollbackOf || '-'];
      console.log(row.map((v,i)=>String(v).padEnd([9,8,11,9,21,9,20,11][i])).join(' '));
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
# rollback-config — reapply an old config revision's ALLOWLISTED parameter
# values on top of whatever image build is CURRENTLY live (never rolls the
# image back — config and code rollback are independent concerns by
# default, per docs/proposals/config-only-deploy/context.md). Recorded as a
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
  if [ ! -f "$cfg_dir/params-snapshot.json" ]; then
    echo "ERROR: config revision #$cfg has no params-snapshot.json — cannot roll back to it."
    exit 1
  fi

  local stack_name
  stack_name="$(stack_name_for_env "$env")"

  echo "Rolling back config to revision #$cfg ($env) — reapplying its allowlisted parameter"
  echo "values on top of whatever image build is currently live."

  local allowlist_file="$SERVICE_DIR/infra/config-only-allowed-params.json"
  local live_params_json
  if ! live_params_json="$("$AWS_BIN" cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "${AWS_REGION:-ap-south-1}" --no-cli-pager \
        --query "Stacks[0].Parameters" --output json 2>/dev/null)"; then
    echo "ERROR: stack $stack_name does not exist (or isn't reachable)."
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
      if (liveMap[key] === '****') continue;
      out.push(key + '=' + liveMap[key]);
    }
    fs.writeFileSync(process.argv[4], JSON.stringify(out));
  " "$live_params_json" "$cfg_dir/params-snapshot.json" "$allowlist_file" "$overrides_file"

  mapfile -t PARAM_OVERRIDES < <(node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).forEach(x=>console.log(x))" "$overrides_file")
  rm -f "$overrides_file"

  "$AWS_BIN" cloudformation deploy \
    --template-file "$(winpath "$SERVICE_DIR/infra/cfn-platform.yaml")" \
    --stack-name "$stack_name" \
    --parameter-overrides "${PARAM_OVERRIDES[@]}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${AWS_REGION:-ap-south-1}" \
    --no-cli-pager \
    --no-fail-on-empty-changeset

  local build
  build="$(latest_build_for_env "$env")"
  local new_cfg
  new_cfg="$(next_config_version)"
  local new_dir="$CONFIG_VERSIONS_DIR/$new_cfg"
  mkdir -p "$new_dir"
  cp "$cfg_dir/params-snapshot.json" "$new_dir/params-snapshot.json"
  chmod 600 "$new_dir/params-snapshot.json" 2>/dev/null || true

  node -e "
    const fs = require('fs');
    const snapshot = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const allowed = new Set(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).allowedParams);
    const changed = {};
    for (const p of snapshot) if (allowed.has(p.ParameterKey)) changed[p.ParameterKey] = { from: null, to: p.ParameterValue, note: 'restored via rollback-config from #${cfg}' };
    fs.writeFileSync(process.argv[3], JSON.stringify(changed, null, 2) + '\n');
  " "$cfg_dir/params-snapshot.json" "$allowlist_file" "$new_dir/changed-params.json"

  write_config_manifest "$new_dir/manifest.json" \
    "$new_cfg" "$build" "$env" "applied" "$cfg" "$new_dir/changed-params.json" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "$DEPLOY_DATE"

  echo "$new_cfg" > "$CONFIG_VERSIONS_DIR/LATEST"
  echo ""
  echo "Rolled back to config revision #$cfg's parameter values. Recorded as new config revision #$new_cfg (rollbackOf: #$cfg)."
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

  printf "%-7s %-8s %-9s %-21s %-9s %-20s %-10s\n" "BUILD" "ENV" "STATUS" "TIMESTAMP" "COMMIT" "BRANCH" "ROLLBACK_OF"
  shopt -s nullglob
  for d in "$VERSIONS_DIR"/[0-9][0-9][0-9][0-9]; do
    [ -f "$d/manifest.json" ] || continue
    node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const filterEnv = process.argv[2];
      if (filterEnv && m.env !== filterEnv) process.exit(0);
      const row = [m.buildNumber, m.env, m.status, m.timestamp, m.git.commitShort, m.git.branch, m.rollbackOf || '-'];
      console.log(row.map((v,i)=>String(v).padEnd([7,8,9,21,9,20,10][i])).join(' '));
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
# rollback-code — fast path: redeploy pinned to an old build's exact image
# =============================================================================
# "Fast" here means "skips the docker build/push step", not "skips
# CloudFormation" — ECS/Fargate task definitions are CFN-managed, so there is
# no Lambda-style code-only update path. infra/deploy.sh's own SKIP_BUILD
# support does the pinning; this just delegates to it with the old tag.
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

  local image_tag
  image_tag="$(json_read "$m" artifact.imageTag)" || true
  if [ -z "${image_tag:-}" ] || [ "$image_tag" = "unknown" ]; then
    echo "ERROR: build #$build has no recorded image tag — cannot roll back to it."
    exit 1
  fi

  echo "Rolling back: redeploying pinned to build #$build's image (tag: $image_tag) — no rebuild."

  rm -f "$SERVICE_DIR/infra/.last-deploy-artifacts.json"

  local new_build
  new_build="$(next_build_number)"
  local new_dir="$VERSIONS_DIR/$new_build"
  mkdir -p "$new_dir"

  local status="failed"
  if SKIP_BUILD=true IMAGE_TAG="$image_tag" "$SERVICE_DIR/infra/deploy.sh" deploy "$env"; then
    status="deployed"
  fi

  record_build "$new_build" "$new_dir" "$env" "$status" "$build" "code-only"
}

# =============================================================================
# rollback-full — redeploy a build's saved CFN template + params directly
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
  if [ ! -f "$build_dir/cfn-platform.yaml" ] || [ ! -f "$build_dir/cfn-params-${env}.json" ]; then
    echo "ERROR: build #$build is missing its template/params snapshot — cannot do a full rollback."
    echo "(rollback-code may still work if it has a recorded image tag.)"
    exit 1
  fi

  local stack_name
  stack_name="$(stack_name_for_env "$env")"
  local region="${AWS_REGION:-ap-south-1}"

  echo "Full rollback to build #$build: redeploying its saved CFN template + params directly."
  echo "That params snapshot's ContainerImageUri already points at build #$build's exact"
  echo "image, so this one CFN deploy restores both the infrastructure and the code."

  "$AWS_BIN" cloudformation deploy \
    --template-file "$(winpath "$build_dir/cfn-platform.yaml")" \
    --stack-name "$stack_name" \
    --parameter-overrides "file://$(winpath "$build_dir/cfn-params-${env}.json")" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$region" \
    --no-cli-pager \
    --no-fail-on-empty-changeset

  local new_build
  new_build="$(next_build_number)"
  local new_dir="$VERSIONS_DIR/$new_build"
  mkdir -p "$new_dir"
  cp "$build_dir/cfn-platform.yaml" "$new_dir/cfn-platform.yaml"
  cp "$build_dir/cfn-params-${env}.json" "$new_dir/cfn-params-${env}.json"

  write_manifest "$new_dir/manifest.json" \
    "$new_build" "$env" "deployed" "$stack_name" "$build" "full" \
    "$(json_read "$m" artifact.ecrRepoName)" "$(json_read "$m" artifact.ecrRepo)" \
    "$(json_read "$m" artifact.imageTag)" "$(json_read "$m" artifact.imageUri)" "$(json_read "$m" artifact.imageDigest)" \
    "$region" "$(json_read "$m" artifact.accountId)" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "$DEPLOY_DATE"

  echo "$new_build" > "$VERSIONS_DIR/LATEST"
  echo "Recorded as build #$new_build (rollbackOf: #$build, full)."
}

# =============================================================================
# start / stop / status / endpoint — pure ECS control, passthrough, no build
# recorded (these don't change what's deployed, just whether it's running)
# =============================================================================
cmd_passthrough() {
  local action="$1" env="${2:-}"
  require_env_arg "$env"
  exec "$SERVICE_DIR/infra/deploy.sh" "$action" "$env"
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
  start|stop|status|endpoint)
    cmd_passthrough "$1" "${2:-}"
    ;;
  dev|staging|prod)
    cmd_deploy "$1"
    ;;
  *)
    usage
    exit 1
    ;;
esac
