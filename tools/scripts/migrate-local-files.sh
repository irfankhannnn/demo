#!/bin/bash
set -euo pipefail

# =============================================================================
# Move local-only files into the reorganised folder layout
# =============================================================================
# The 2026-09-17 reorgs (root folders -> apps/ + services/ -> platform/ +
# public-app/ + agency-app/) moved every service with `git mv`. Git only moves
# TRACKED files, so after pulling, each checkout still has its untracked,
# gitignored files sitting in whichever old folder it last used:
#
#   .env / .env.dev / .env.prod          deploy + runtime secrets
#   infra/cfn-params.json, .last-*.json  last-deploy bookkeeping
#   infra/cicd/<group>/<svc>/deploy-versions/  build counters + rollback snapshots
#     (was cfn-templates-cicd/<svc>/)          — lose these and build numbers restart
#   whatsapp-platform/auth_state/        linked WhatsApp session
#   node_modules/, dist/                 reinstallable, moved anyway to save time
#
# This script merges each old folder into its new home. It never overwrites:
# if the same path already exists at the destination, it is reported and left
# in the old folder for you to resolve by hand.
#
# Usage (from anywhere inside the checkout):
#   bash tools/scripts/migrate-local-files.sh          # dry run - prints the plan
#   bash tools/scripts/migrate-local-files.sh --apply   # actually move files
#
# Stop anything holding files open first (dev servers, `vite`, `nodemon`,
# WhatsApp workers, editors on .env files) - Windows refuses to move open files.
# =============================================================================

APPLY=false
if [ "${1:-}" = "--apply" ]; then APPLY=true; fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# old folder -> new folder (repo-relative). Two generations of old names: the
# pre-2026-09-17 root folders and the same-day apps/ + services/ layout. Each
# maps to its final home under platform/, public-app/ or agency-app/.
MAPPINGS=(
  # pre-reorg root folders
  "real-estate-crm-app:agency-app/web"
  "server:agency-app/api"
  "frontend_insta_sol_ms:agency-app/instagram-web"
  "backend_insta_sol_ms:agency-app/instagram-api"
  "landing-pages:agency-app/landing-pages"
  "property-pages-ms:public-app/property-pages"
  "reality-flow-authentication:platform/auth"
  "reality-flow-mcp:platform/mcp"
  "whatsapp-platform:platform/whatsapp-platform"
  "ai-calling-service:agency-app/ai-calling"
  "followup-agent-service:agency-app/followup-agent"
  "cfn-templates-cicd/server:infra/cicd/agency-app/api"
  "cfn-templates-cicd/real-estate-crm-app:infra/cicd/agency-app/web"
  "cfn-templates-cicd/launch-tables:infra/cicd/agency-app/launch-tables"
  "cfn-templates-cicd/backend_insta_sol_ms:infra/cicd/agency-app/instagram-api"
  "cfn-templates-cicd/frontend_insta_sol_ms:infra/cicd/agency-app/instagram-web"
  "cfn-templates-cicd/landing-pages:infra/cicd/agency-app/landing-pages"
  "cfn-templates-cicd/ai-calling-service:infra/cicd/agency-app/ai-calling"
  "cfn-templates-cicd/followup-agent-service:infra/cicd/agency-app/followup-agent"
  "cfn-templates-cicd/property-pages-ms:infra/cicd/public-app/property-pages"
  "cfn-templates-cicd/reality-flow-authentication:infra/cicd/platform/auth"
  "cfn-templates-cicd/reality-flow-mcp:infra/cicd/platform/mcp"
  "cfn-templates-cicd/whatsapp-platform:infra/cicd/platform/whatsapp-platform"
  "cfn-templates-cicd/common-infra:infra/cicd/common-infra"
  "kalim-sessions:tools/kalim-sessions"
  "claude-skills:tools/claude-skills"
  "huashu-design:tools/huashu-design"
  "openclaw_workspace_reference:tools/openclaw_workspace_reference"
  "videos:marketing-and-sales/video-projects"
  # apps/ + services/ layout (same day, superseded)
  "apps/crm/real-estate-crm-app:agency-app/web"
  "apps/crm/server:agency-app/api"
  "apps/instagram/frontend_insta_sol_ms:agency-app/instagram-web"
  "apps/instagram/backend_insta_sol_ms:agency-app/instagram-api"
  "apps/landing-pages:agency-app/landing-pages"
  "apps/property-pages-ms:public-app/property-pages"
  "services/reality-flow-authentication:platform/auth"
  "services/reality-flow-mcp:platform/mcp"
  "services/whatsapp-platform:platform/whatsapp-platform"
  "services/ai-calling-service:agency-app/ai-calling"
  "services/followup-agent-service:agency-app/followup-agent"
  "infra/cicd/server:infra/cicd/agency-app/api"
  "infra/cicd/real-estate-crm-app:infra/cicd/agency-app/web"
  "infra/cicd/launch-tables:infra/cicd/agency-app/launch-tables"
  "infra/cicd/backend_insta_sol_ms:infra/cicd/agency-app/instagram-api"
  "infra/cicd/frontend_insta_sol_ms:infra/cicd/agency-app/instagram-web"
  "infra/cicd/landing-pages:infra/cicd/agency-app/landing-pages"
  "infra/cicd/ai-calling-service:infra/cicd/agency-app/ai-calling"
  "infra/cicd/followup-agent-service:infra/cicd/agency-app/followup-agent"
  "infra/cicd/property-pages-ms:infra/cicd/public-app/property-pages"
  "infra/cicd/reality-flow-authentication:infra/cicd/platform/auth"
  "infra/cicd/reality-flow-mcp:infra/cicd/platform/mcp"
  "infra/cicd/whatsapp-platform:infra/cicd/platform/whatsapp-platform"
)

# Folders that were deleted rather than moved. Their local files are reported
# and left alone; delete them by hand once you have what you need from them.
DELETED=(
  "onboarding-page"
  "apps/onboarding"
)

moved=0
conflicts=0

# merge <src> <dst>: move src's children into dst without overwriting anything
merge() {
  local src="$1" dst="$2"
  local child name
  shopt -s dotglob nullglob
  for child in "$src"/*; do
    name="$(basename "$child")"
    if [ ! -e "$dst/$name" ]; then
      echo "  move  $child -> $dst/$name"
      if $APPLY; then
        mkdir -p "$dst"
        mv "$child" "$dst/$name"
      fi
      moved=$((moved + 1))
    elif [ -d "$child" ] && [ -d "$dst/$name" ] && [ ! -L "$child" ]; then
      merge "$child" "$dst/$name"
    else
      echo "  CONFLICT (left in place): $child  — $dst/$name already exists"
      conflicts=$((conflicts + 1))
    fi
  done
  shopt -u dotglob nullglob
}

for pair in "${MAPPINGS[@]}"; do
  old="${pair%%:*}"
  new="${pair#*:}"
  [ -d "$old" ] || continue
  # Before the reorg is pulled, the old folder still holds tracked files. Refuse
  # rather than move source code around behind git's back.
  if [ -n "$(git ls-files -- "$old" | head -1)" ]; then
    echo "ERROR: $old/ still has tracked files - pull/merge the reorg commit first."
    exit 1
  fi
  echo "$old/ -> $new/"
  merge "$old" "$new"
  if $APPLY; then
    find "$old" -depth -type d -empty -delete 2>/dev/null || true
    if [ -d "$old" ]; then
      echo "  (kept $old/ - it still contains conflicting files)"
    fi
  fi
done

for old in "${DELETED[@]}"; do
  if [ -d "$old" ] && [ -n "$(ls -A "$old" 2>/dev/null)" ]; then
    echo "NOTE: $old/ was deleted from the repo; its local files are untouched - remove by hand."
  fi
done

if $APPLY; then
  for parent in apps/crm apps/instagram apps services; do
    [ -d "$parent" ] && find "$parent" -depth -type d -empty -delete 2>/dev/null || true
  done
fi

echo ""
if $APPLY; then
  echo "Moved $moved item(s); $conflicts conflict(s)."
else
  echo "Dry run: $moved item(s) would move; $conflicts conflict(s). Re-run with --apply."
fi

cat <<'EOF'

Follow-ups this script cannot do for you:
  * Windows scheduled task "HP Insta Lead Automation" still points at the old
    kalim-sessions path. Re-register it from the new location:
      powershell -ExecutionPolicy Bypass -File tools\kalim-sessions\kalim-automations\hp-insta-lead-automation\scripts\register_schedule.ps1
  * Any shortcut, terminal profile or IDE workspace that opened an old folder
    (e.g. server/, apps/crm/server/) needs its path updated.
  * Once every machine has migrated, delete the "Pre-reorganisation folder
    names" block at the bottom of the root .gitignore.
EOF
