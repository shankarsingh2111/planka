#!/usr/bin/env bash
#
# Stops the production stack, taking the company's board offline. Volumes are kept.
#
#   scripts/stop-production.sh [--stop] [--yes]
#
#   --stop   only stop the containers instead of removing them
#
# Redeploy with: scripts/deploy-production.sh, or bring the same image back with
# cd ~/planka && docker compose up -d

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"

PROD_DIR="${PLANKA_PROD_DIR:-$HOME/planka}"
MODE='down'
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --stop) MODE='stop'; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_stack "$PROD_DIR"

log "Stopping PRODUCTION (${PROD_DIR})"
warn 'This takes planka.jugnoo.in offline for everyone.'
info "Currently running: $(current_image "$PROD_DIR")"
confirm 'Really stop production?'

stop_stack "$PROD_DIR" 'Production' "$MODE" "cd ${PROD_DIR} && docker compose up -d"
