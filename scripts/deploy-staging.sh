#!/usr/bin/env bash
#
# Pulls an image from Docker Hub and deploys it to the staging stack. Never builds:
# staging runs the exact image built and pushed from the development machine.
#
#   scripts/deploy-staging.sh --tag TAG [--yes]
#
# The tag is the one scripts/deploy-local.sh printed, e.g. 2026-09-23-abc1234.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"
load_deploy_env "$REPO_DIR"

STAGING_DIR="${PLANKA_STAGING_DIR:-$REPO_DIR}"
TAG=''
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_image_repo
[ -n "$TAG" ] || die 'Pass the tag to deploy, e.g. --tag 2026-09-23-abc1234'

require_stack "$STAGING_DIR"
IMAGE="${PLANKA_IMAGE_REPO}:${TAG}"

log "Deploying ${IMAGE} to staging (${STAGING_DIR})"
ensure_image_present "$IMAGE"

ensure_db_running "$STAGING_DIR"

assert_image_covers_db "$STAGING_DIR" "$IMAGE"

NEW_MIGRATIONS="$(comm -13 <(db_migrations "$STAGING_DIR") <(image_migrations "$IMAGE") || true)"
if [ -n "$NEW_MIGRATIONS" ]; then
  info 'Migrations that will be applied on startup:'
  printf '      %s\n' $NEW_MIGRATIONS
fi

BEFORE="$(record_counts "$STAGING_DIR")"
info 'Row counts before:'; print_counts "$BEFORE"

set_image "$STAGING_DIR" "$IMAGE"
compose_in "$STAGING_DIR" up -d

log 'Waiting for the app'
wait_until_healthy "$STAGING_DIR"

log 'Result'
info 'Row counts after: '; print_counts "$(record_counts "$STAGING_DIR")"
info "Staging is running ${IMAGE} on port $(published_port "$STAGING_DIR")"
info "Promote it with: scripts/deploy-production.sh --tag ${TAG}"
