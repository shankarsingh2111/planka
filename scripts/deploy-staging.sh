#!/usr/bin/env bash
#
# Builds the fork's image from the current checkout and deploys it to the staging stack.
#
#   scripts/deploy-staging.sh [--yes] [--tag TAG]
#
# The tag defaults to <date>-<git short sha>, e.g. 2026-09-23-65661e9.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"

STAGING_DIR="${PLANKA_STAGING_DIR:-$REPO_DIR}"
TAG=''
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1; shift ;;
    --tag) TAG="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_stack "$STAGING_DIR"

if [ -z "$TAG" ]; then
  TAG="$(date +%F)-$(git -C "$REPO_DIR" rev-parse --short HEAD)"

  if [ -n "$(git -C "$REPO_DIR" status --porcelain)" ]; then
    TAG="${TAG}-dirty"
    warn 'Working tree has uncommitted changes; tagging the image as -dirty.'
  fi
fi

IMAGE="planka-jugnoo:${TAG}"

log "Building ${IMAGE}"
docker build -t "$IMAGE" "$REPO_DIR"

log "Deploying to staging (${STAGING_DIR})"
assert_image_covers_db "$STAGING_DIR" "$IMAGE"

BEFORE="$(record_counts "$STAGING_DIR")"
info 'Before:'; print_counts "$BEFORE"

set_image_tag "$STAGING_DIR" "$TAG"
compose_in "$STAGING_DIR" up -d

log 'Waiting for the app'
wait_until_healthy "$STAGING_DIR"

log 'Applied migrations (newest first)'
db_migrations "$STAGING_DIR" | sort -r | head -5 | sed 's/^/    /'

log 'Result'
AFTER="$(record_counts "$STAGING_DIR")"
info 'After: '; print_counts "$AFTER"
info "Staging is running ${IMAGE} on port $(published_port "$STAGING_DIR")"
info "Promote it with: scripts/deploy-production.sh --tag ${TAG}"
