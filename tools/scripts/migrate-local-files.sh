#!/bin/bash
set -euo pipefail

# =============================================================================
# Move local-only files into the reorganised folder layout
# =============================================================================
# The 2026-09-17 reorg moved every service with `git mv`. Git only moves TRACKED
# files, so after pulling it each checkout still has its untracked, gitignored
# files sitting in the old top-level folders:
#
#   .env / .env.dev / .env.prod          deploy + runtime secrets
#   infra/cfn-params.json, .last-*.json  last-deploy bookkeeping
#   infra/cicd/<svc>/deploy-versions/    build counters + rollback snapshots
#     (was cfn-templates-cicd/<svc>/)    — lose these and build numbers restart
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

# old folder -> new folder (repo-relative)
MAPPINGS=(
  "real-estate-crm-app:apps/crm/real-estate-crm-app"
  "server:apps/crm/server"
  "frontend_insta_sol_ms:apps/instagram/frontend_insta_sol_ms"
  "backend_insta_sol_ms:apps/instagram/backend_insta_sol_ms"
  "onboarding-page:apps/onboarding"
  "landing-pages:apps/landing-pages"
  "property-pages-ms:apps/property-pages-ms"
  "reality-flow-authentication:services/reality-flow-authentication"
  "reality-flow-mcp:services/reality-flow-mcp"
  "whatsapp-platform:services/whatsapp-platform"
  "ai-calling-service:services/ai-calling-service"
  "followup-agent-service:services/followup-agent-service"
  "cfn-templates-cicd:infra/cicd"
  "kalim-sessions:tools/kalim-sessions"
  "claude-skills:tools/claude-skills"
  "huashu-design:tools/huashu-design"
  "openclaw_workspace_reference:tools/openclaw_workspace_reference"
  "videos:marketing-and-sales/video-projects"
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
    (e.g. server/, real-estate-crm-app/) needs its path updated.
  * Once every machine has migrated, delete the "Pre-reorganisation folder
    names" block at the bottom of the root .gitignore.
EOF
