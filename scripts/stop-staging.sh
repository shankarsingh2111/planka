#!/usr/bin/env bash
#
# Stops the staging stack. Volumes are always kept.
#
#   scripts/stop-staging.sh [--stop]
#
#   --stop   only stop the containers instead of removing them
#
# Redeploy with: scripts/deploy-staging.sh --tag TAG

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"

STAGING_DIR="${PLANKA_STAGING_DIR:-$REPO_DIR}"
MODE='down'

while [ $# -gt 0 ]; do
  case "$1" in
    --stop) MODE='stop'; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

log "Stopping staging (${STAGING_DIR})"
stop_stack "$STAGING_DIR" 'Staging' "$MODE" "cd ${STAGING_DIR} && docker compose up -d"
