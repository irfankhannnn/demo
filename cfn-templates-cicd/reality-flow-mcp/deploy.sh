#!/bin/bash
set -euo pipefail

# =============================================================================
# RealtyFlow MCP Microservice — CI/CD entry point
#
# Usage: ./deploy.sh [OPTIONS] [dev|test|prod]   (run from cfn-templates-cicd/reality-flow-mcp/)
#
# Options (all handled by the delegate script):
#   --skip-package        Skip npm/build/zip/upload; CFN deploy only.
#   --skip-cfn            Package + upload + Lambda code update only.
#   --skip-lambda-update  Skip the direct update-function-code call.
#   --config-only         Config-only deploy — ../../reality-flow-mcp/infra/
#                         deploy.sh hands this to infra/config-deploy.sh, which
#                         refuses if a changed parameter isn't on
#                         infra/config-only-allowed-params.json's allowlist.
#                         See docs/proposals/config-only-deploy/context.md.
#   -h, --help            Show the delegate script's help.
#
# Examples:
#   ./deploy.sh dev                   # Full deploy (package + CFN)
#   ./deploy.sh dev --skip-package    # CFN only
#   ./deploy.sh prod --config-only    # CFN only, gated by the allowlist
#
# This wrapper used to be a byte-for-byte copy of infra/deploy.sh plus its
# own copy of cfn-backend.yaml (identical to the service's, and to the live
# dev-realestateflow-mcp-stack template as of 2026-09-14). Two copies of the
# template meant every change had to be made twice, so it now delegates to the
# service's own script, which deploys reality-flow-mcp/infra/cfn-backend.yaml
# — the single source of truth — and writes reality-flow-mcp/infra/
# cfn-params.json. Same stack name (<env>-<SERVICE_NAME>-stack), same params,
# so an existing stack is UPDATED, never replaced.
#
# There is still no build-tracking layer (deploy-versions/, rollback-*) for
# this service, unlike auth/server; adding one is separate work.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../reality-flow-mcp" && pwd)"

exec "$SERVICE_DIR/infra/deploy.sh" "$@"
