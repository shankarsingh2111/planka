#!/usr/bin/env bash
#
# Stops the local stack on this machine. Volumes are always kept.
#
#   scripts/stop-local.sh [--stop]
#
#   --stop   only stop the containers instead of removing them
#
# To wipe local data as well, use: scripts/deploy-local.sh --reset

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"

export COMPOSE_FILE='docker-compose-local.yml'
export COMPOSE_PROJECT_NAME='planka_local'

MODE='down'

while [ $# -gt 0 ]; do
  case "$1" in
    --stop) MODE='stop'; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

log 'Stopping the local stack'
stop_stack "$REPO_DIR" 'Local' "$MODE" 'scripts/deploy-local.sh'
