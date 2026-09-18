#!/bin/bash
set -euo pipefail

# =============================================================================
# RealtyFlow CRM Frontend — CI/CD entry point, with build/release tracking
# =============================================================================
# Usage:
#   ./deploy.sh <dev|prod>                        Deploy — records a new numbered build
#   ./deploy.sh list [dev|prod]                    List recorded builds (optionally filtered)
#   ./deploy.sh show <build>                       Print one build's manifest.json
#   ./deploy.sh rollback-content <env> <build>     Re-sync that build's dist/ archive to the
#                                                   live bucket + invalidate CloudFront (fast,
#                                                   content only — no CFN change)
#   ./deploy.sh rollback-full <env> <build>        Redeploy that build's saved CFN template +
#                                                   params, then its content
#   ./deploy.sh content-deploy <env>               VITE_*-only change — rebuild + re-sync,
#                                                   skip the CFN update (records a normal
#                                                   numbered build, verified safe first by
#                                                   infra/content-deploy.sh)
#   ./deploy.sh config-deploy <env>                CFN-parameter-only change — skip npm/
#                                                   build/sync entirely (records a config
#                                                   revision, verified safe first by
#                                                   infra/config-deploy.sh)
#   ./deploy.sh list-config [env]                  List recorded config revisions
#   ./deploy.sh show-config <config-version>       Print one config revision's manifest.json
#   ./deploy.sh rollback-config <env> <config-version>
#                                                   Reapply an old config revision's params
#
# content-deploy and config-deploy are two INDEPENDENT axes (category 1 vs.
# category 3 in docs/proposals/config-only-deploy/context.md) — a change
# touching both a VITE_* var and a CFN parameter uses neither, it's a normal
# `./deploy.sh <env>`.
#
# Every deploy call delegates the actual build/CFN work to the real script:
# agency-app/web/infra/deploy.sh. This wrapper's only job is release
# bookkeeping — see README.md in this folder for the full design.
#
# This is a STATIC SITE, not a Lambda service — unlike the backend wrappers
# in this repo, there is no single "latest" code object to version. The live
# frontend S3 bucket itself (versioned, per cfn-frontend.yaml) IS the
# deployed artifact. What this wrapper adds on top is a build-numbered,
# permanent ARCHIVE of each build's dist/ output + CFN template, so a build
# can be inspected or restored later even after the live bucket has moved on
# (S3 sync --delete removes files a later build no longer ships).
#
# Build numbers are GLOBAL (one counter across dev AND prod, not one per
# env) — "build #7" is unambiguous on its own; which env it targeted is
# recorded inside it, not encoded by which counter produced it.
#
# S3 layout under the artifact bucket (dev-realestateflow-artifacts /
# prod-realestateflow-artifacts — one bucket per environment already, per
# infra/cicd/common-infra/vpc-networking.yaml):
#   ${SERVICE_NAME}/builds/<build>/<env>/dist.tar.gz     permanent, build+env-
#   ${SERVICE_NAME}/builds/<build>/<env>/cfn-frontend.yaml  scoped archive
#                                                            (never overwritten)
#
# Every object this script uploads gets S3 tags: Branch, DeployDate, Status
# (deployed|failed — the actual script outcome), CommitId. Status is only
# known after the delegate script returns, so tagging always happens as a
# follow-up put-object-tagging call, never at upload time.
#
# Build history also lives locally in ./deploy-versions/ — gitignored (see
# .gitignore in this folder). S3 is the durable, shareable source of truth;
# this folder is a local index plus instant-access template/param snapshots
# for rollback.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../../../agency-app/web" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
VERSIONS_DIR="$SCRIPT_DIR/deploy-versions"
CONFIG_VERSIONS_DIR="$SCRIPT_DIR/config-versions"

# validate_api_domain_vars — shared with the infra/ scripts so the rules
# (custom domain + base path required, no raw execute-api) can't drift.
# shellcheck disable=SC1091
source "$SERVICE_DIR/infra/lib/api-domain-guard.sh"

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
if ! command -v tar >/dev/null 2>&1; then
  echo "ERROR: tar not found in PATH (used to archive dist/ for build tracking)"
  exit 1
fi

usage() {
  cat <<'USAGE'
Usage:
  ./deploy.sh <dev|prod>                     Deploy — records a new numbered build
  ./deploy.sh list [dev|prod]                 List recorded builds (optionally filtered by env)
  ./deploy.sh show <build>                    Print one build's manifest.json
  ./deploy.sh rollback-content <env> <build>  Roll back the live bucket's content only (fast)
  ./deploy.sh rollback-full <env> <build>     Roll back CFN template+params, then content
  ./deploy.sh content-deploy <env>            VITE_*-only change (rebuild+sync, no CFN)
  ./deploy.sh config-deploy <env>             CFN-parameter-only change (no build)
  ./deploy.sh list-config [env]               List recorded config revisions
  ./deploy.sh show-config <config-version>    Print one config revision's manifest.json
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

# ---- config-version counter — SEPARATE track from the build counter above.
# Only a CFN-parameter-only change (infra/config-deploy.sh) uses this — a
# content-only change (infra/content-deploy.sh) is a normal numbered build,
# see cmd_content_deploy above. ---------------------------------------------
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
  # write_manifest <out-file> <buildNumber> <env> <status> <stackName> <rollbackOf|null> <rollbackKind|null> <artifactBucket> <buildDistKey> <buildTemplateKey> <frontendBucket> <distributionId> <commit> <commitShort> <branch> <dirty> <deployer> <region> <serviceName> <deployDate>
  node -e "
    const fs = require('fs');
    const [ , out, buildNumber, env, status, stackName, rollbackOf, rollbackKind,
            artifactBucket, buildDistKey, buildTemplateKey,
            frontendBucket, distributionId,
            commit, commitShort, branch, dirty, deployer, region, serviceName, deployDate ] = process.argv;
    const manifest = {
      buildNumber, env, status,
      timestamp: new Date().toISOString(),
      deployDate,
      git: { commit, commitShort, branch, dirty: dirty === 'true' },
      deployer, stackName, region, serviceName,
      artifact: {
        bucket: artifactBucket,
        // Permanent, build+env-scoped archive copies — never overwritten.
        // There is no single 'latest' key the way Lambda services have one:
        // the live frontend bucket (below) IS the deployed content, and its
        // own S3 versioning is the primary content-rollback mechanism.
        buildDistKey: buildDistKey || null,
        buildTemplateKey: buildTemplateKey || null,
      },
      frontend: {
        bucket: frontendBucket,
        distributionId,
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
  # delegate_script: which infra/ script actually does the work. Defaults to
  # the full deploy.sh; cmd_content_deploy passes content-deploy.sh instead
  # — that script runs its OWN safety check (verifies no CFN parameter
  # differs from live) before calling deploy.sh --skip-cfn itself, so this
  # function never needs to know about --skip-cfn directly.
  local delegate_script="${2:-deploy.sh}"
  require_env_arg "$env"

  set -a
  # shellcheck disable=SC1090
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENV="$env"

  # Refuse raw execute-api / missing API custom-domain vars BEFORE allocating a
  # build number, so a misconfigured env file never records a build at all.
  # (The delegate infra/ scripts run the same guard again.)
  validate_api_domain_vars "$SERVICE_DIR/.env.$env"

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
  if "$SERVICE_DIR/infra/$delegate_script" "$env"; then
    status="deployed"
  fi

  # Snapshot the exact template/params used, regardless of outcome — a
  # failed build's attempted config is still worth keeping for debugging.
  cp "$SERVICE_DIR/infra/cfn-frontend.yaml" "$build_dir/cfn-frontend.yaml" 2>/dev/null || true
  cp "$SERVICE_DIR/infra/cfn-params.json" "$build_dir/cfn-params.json" 2>/dev/null || true

  local artifact_bucket="${ARTIFACT_BUCKET:-unknown}"
  local frontend_bucket="${FRONTEND_S3_BUCKET_NAME:-${ENV}-${SERVICE_NAME}}"
  local build_prefix="${SERVICE_NAME}/builds/${build}/${env}"
  local build_dist_key="${build_prefix}/dist.tar.gz"
  local build_template_key="${build_prefix}/cfn-frontend.yaml"
  local distribution_id="unknown"

  if [ "$status" = "deployed" ]; then
    distribution_id="$("$AWS_BIN" cloudformation describe-stacks --region "$AWS_REGION" --stack-name "${ENV}-${SERVICE_NAME}-stack" --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text --no-cli-pager 2>/dev/null || echo unknown)"
    [ "$distribution_id" = "None" ] && distribution_id="unknown"

    echo "Archiving dist/ for build tracking..."
    tar -czf "$build_dir/dist.tar.gz" -C "$SERVICE_DIR" dist

    "$AWS_BIN" s3 cp "$build_dir/dist.tar.gz" "s3://${artifact_bucket}/${build_dist_key}" --region "$AWS_REGION" --no-cli-pager
    "$AWS_BIN" s3 cp "$build_dir/cfn-frontend.yaml" "s3://${artifact_bucket}/${build_template_key}" --region "$AWS_REGION" --no-cli-pager

    tag_object "$artifact_bucket" "$build_dist_key" "$status"
    tag_object "$artifact_bucket" "$build_template_key" "$status"
  else
    build_dist_key=""
    build_template_key=""
  fi

  write_manifest "$build_dir/manifest.json" \
    "$build" "$env" "$status" "${ENV}-${SERVICE_NAME}-stack" "null" "null" \
    "$artifact_bucket" "$build_dist_key" "$build_template_key" \
    "$frontend_bucket" "$distribution_id" \
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
# content-deploy — a pure VITE_*-only change: rebuild + re-sync content,
# skip the CloudFormation update (infra/deploy.sh --skip-cfn). This still
# records a normal numbered BUILD (deploy-versions/), not a config revision
# — it ships new content, which is exactly what build tracking is for; a
# "config revision" in this wrapper specifically means a CFN-parameter-only
# change (see cmd_config_deploy below), which this is not.
# =============================================================================
cmd_content_deploy() {
  local env="$1"
  require_env_arg "$env"
  cmd_deploy "$env" content-deploy.sh
}

# =============================================================================
# config-deploy — CFN-parameter-only change. Delegates to infra/
# config-deploy.sh, records a config revision on its OWN numbering track
# (config-versions/, not deploy-versions/).
# =============================================================================
cmd_config_deploy() {
  local env="$1"
  require_env_arg "$env"

  set -a
  # shellcheck disable=SC1090
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENV="$env"

  echo "============================================="
  echo " Config-only deploy ($env) — starting"
  echo " commit: $GIT_COMMIT_SHORT  branch: $GIT_BRANCH  dirty: $GIT_DIRTY  by: $DEPLOYER"
  echo "============================================="

  local diff_file="$SERVICE_DIR/infra/.last-config-diff.json"
  rm -f "$diff_file"

  if ! "$SERVICE_DIR/infra/config-deploy.sh" "$env"; then
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
# values on top of whatever content build is CURRENTLY live (never rolls
# content back). Recorded as a new forward config revision.
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

  set -a
  # shellcheck disable=SC1090
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENV="$env"

  local stack_name="${ENV}-${SERVICE_NAME}-stack"
  echo "Rolling back config to revision #$cfg ($env) — reapplying its allowlisted parameter"
  echo "values on top of whatever content build is currently live."

  local allowlist_file="$SERVICE_DIR/infra/config-only-allowed-params.json"
  local live_params_json
  if ! live_params_json="$("$AWS_BIN" cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$AWS_REGION" --no-cli-pager \
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
    --template-file "$SERVICE_DIR/infra/cfn-frontend.yaml" \
    --stack-name "$stack_name" \
    --parameter-overrides "${PARAM_OVERRIDES[@]}" \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --no-fail-on-empty-changeset

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
# rollback-content — fast path: re-sync a build's archived dist/ to the live
# bucket and invalidate CloudFront (no CFN change)
# =============================================================================
cmd_rollback_content() {
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

  local artifact_bucket dist_key frontend_bucket distribution_id
  artifact_bucket="$(json_read "$m" artifact.bucket)"
  dist_key="$(json_read "$m" artifact.buildDistKey)" || true
  frontend_bucket="$(json_read "$m" frontend.bucket)"
  distribution_id="$(json_read "$m" frontend.distributionId)" || true

  if [ -z "${dist_key:-}" ] || [ "$dist_key" = "unknown" ]; then
    echo "ERROR: build #$build has no recorded dist archive — cannot roll back content from it (it may have been a failed build)."
    exit 1
  fi

  echo "Rolling back content: bucket=$frontend_bucket  from s3://$artifact_bucket/$dist_key"

  local storage_class
  storage_class="$("$AWS_BIN" s3api head-object --bucket "$artifact_bucket" --key "$dist_key" --region "$AWS_REGION" --query StorageClass --output text 2>/dev/null || echo STANDARD)"
  [ "$storage_class" = "None" ] && storage_class="STANDARD"

  if [ "$storage_class" = "DEEP_ARCHIVE" ] || [ "$storage_class" = "GLACIER" ]; then
    cat <<EOF

This archive is in $storage_class — it must be restored before it can be
downloaded. Run:
  $AWS_BIN s3api restore-object --bucket $artifact_bucket --key $dist_key --region $AWS_REGION \\
    --restore-request '{"Days":7,"GlacierJobParameters":{"Tier":"Standard"}}'

Then wait for the restore (~12h for Deep Archive Standard tier; check with):
  $AWS_BIN s3api head-object --bucket $artifact_bucket --key $dist_key --region $AWS_REGION --query Restore

Re-run this rollback-content command once that shows the restore is complete.
EOF
    exit 1
  fi

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  "$AWS_BIN" s3 cp "s3://${artifact_bucket}/${dist_key}" "$tmp_dir/dist.tar.gz" --region "$AWS_REGION" --no-cli-pager
  tar -xzf "$tmp_dir/dist.tar.gz" -C "$tmp_dir"

  "$AWS_BIN" s3 sync "$tmp_dir/dist" "s3://${frontend_bucket}" \
    --region "$AWS_REGION" --delete \
    --cache-control "public,max-age=31536000,immutable" --exclude "index.html" --no-cli-pager
  if [ -f "$tmp_dir/dist/index.html" ]; then
    "$AWS_BIN" s3 cp "$tmp_dir/dist/index.html" "s3://${frontend_bucket}/index.html" \
      --region "$AWS_REGION" --cache-control "public,max-age=0,must-revalidate" --no-cli-pager
  fi
  rm -rf "$tmp_dir"

  if [ -n "${distribution_id:-}" ] && [ "$distribution_id" != "unknown" ]; then
    "$AWS_BIN" cloudfront create-invalidation --distribution-id "$distribution_id" --paths "/*" --no-cli-pager >/dev/null
  fi

  echo "Rolled back content to build #$build."

  # Record the rollback as its own new build — a rollback is a new forward
  # release, not an edit to history, per standard CI/CD release practice.
  local new_build
  new_build="$(next_build_number)"
  local new_dir="$VERSIONS_DIR/$new_build"
  mkdir -p "$new_dir"
  cp "$build_dir/dist.tar.gz" "$new_dir/" 2>/dev/null || true
  cp "$build_dir/cfn-frontend.yaml" "$new_dir/" 2>/dev/null || true
  cp "$build_dir/cfn-params.json" "$new_dir/" 2>/dev/null || true

  tag_object "$artifact_bucket" "$dist_key" "deployed"

  write_manifest "$new_dir/manifest.json" \
    "$new_build" "$env" "deployed" "${ENV}-${SERVICE_NAME}-stack" "$build" "content-only" \
    "$artifact_bucket" "$dist_key" "$(json_read "$m" artifact.buildTemplateKey 2>/dev/null || echo '')" \
    "$frontend_bucket" "$distribution_id" \
    "$GIT_COMMIT" "$GIT_COMMIT_SHORT" "$GIT_BRANCH" "$GIT_DIRTY" "$DEPLOYER" "${AWS_REGION:-unknown}" "$SERVICE_NAME" "$DEPLOY_DATE"

  echo "$new_build" > "$VERSIONS_DIR/LATEST"
  echo "Recorded as build #$new_build (rollbackOf: #$build, content-only)."
}

# =============================================================================
# rollback-full — redeploy a build's saved CFN template + params, then content
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
  if [ ! -f "$build_dir/cfn-frontend.yaml" ] || [ ! -f "$build_dir/cfn-params.json" ]; then
    echo "ERROR: build #$build is missing its template/params snapshot — cannot do a full rollback."
    echo "(rollback-content may still work if it has a recorded dist archive.)"
    exit 1
  fi

  set -a
  source "$SERVICE_DIR/.env.$env"
  set +a
  ENV="$env"

  echo "Full rollback to build #$build: redeploying its saved CFN template + params, then its content."

  local overrides=()
  while IFS= read -r line; do
    overrides+=("$line")
  done < <(node -e "
    const params = require('$build_dir/cfn-params.json');
    for (const p of params) console.log(\`\${p.ParameterKey}=\${p.ParameterValue}\`);
  ")

  "$AWS_BIN" cloudformation deploy \
    --template-file "$build_dir/cfn-frontend.yaml" \
    --stack-name "${ENV}-${SERVICE_NAME}-stack" \
    --parameter-overrides "${overrides[@]}" \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --no-fail-on-empty-changeset

  echo "CFN template/params restored from build #$build. Rolling back content next..."
  cmd_rollback_content "$env" "$build"
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
  rollback-content)
    cmd_rollback_content "${2:-}" "${3:-}"
    ;;
  rollback-full)
    cmd_rollback_full "${2:-}" "${3:-}"
    ;;
  content-deploy)
    cmd_content_deploy "${2:-}"
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
