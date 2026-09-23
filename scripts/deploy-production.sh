#!/usr/bin/env bash
#
# Promotes an already-built image to the production stack, with backups and checks.
#
#   scripts/deploy-production.sh [--tag TAG] [--yes] [--skip-backup]
#
# The tag defaults to whatever staging is currently running. The image must exist
# locally; this script never builds, so production runs the exact bits staging ran.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"

STAGING_DIR="${PLANKA_STAGING_DIR:-$REPO_DIR}"
PROD_DIR="${PLANKA_PROD_DIR:-$HOME/planka}"
TAG=''
ASSUME_YES=0
SKIP_BACKUP=0

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --skip-backup) SKIP_BACKUP=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_stack "$PROD_DIR"

[ -n "$TAG" ] || TAG="$(current_image_tag "$STAGING_DIR")"
[ -n "$TAG" ] || die 'No tag given and staging has none recorded. Pass --tag TAG.'

IMAGE="planka-jugnoo:${TAG}"
PREVIOUS_TAG="$(current_image_tag "$PROD_DIR")"

log "Promoting ${IMAGE} to production (${PROD_DIR})"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "Image not found locally: ${IMAGE}. Build it with deploy-staging.sh first."
[ -n "$PREVIOUS_TAG" ] && info "Currently deployed: planka-jugnoo:${PREVIOUS_TAG}"

log 'Checking the image against the production database'
assert_image_covers_db "$PROD_DIR" "$IMAGE"

NEW_MIGRATIONS="$(comm -13 <(db_migrations "$PROD_DIR") <(image_migrations "$IMAGE") || true)"
if [ -n "$NEW_MIGRATIONS" ]; then
  info 'Migrations that will be applied on startup:'
  printf '      %s\n' $NEW_MIGRATIONS
else
  info 'No new migrations.'
fi

BEFORE="$(record_counts "$PROD_DIR")"
info 'Row counts before:'; print_counts "$BEFORE"

confirm "Deploy ${IMAGE} to production?"

if [ "$SKIP_BACKUP" = "1" ]; then
  warn 'Skipping backup (--skip-backup).'
else
  log 'Backing up'
  mkdir -p "$BACKUP_DIR"
  STAMP="$(date +%F-%H%M)"

  compose_in "$PROD_DIR" exec -T postgres pg_dump -U postgres -Fc planka > "${BACKUP_DIR}/planka-prod-${STAMP}.dump"
  info "Database:    ${BACKUP_DIR}/planka-prod-${STAMP}.dump ($(du -h "${BACKUP_DIR}/planka-prod-${STAMP}.dump" | cut -f1))"

  DATA_VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$(compose_in "$PROD_DIR" ps -q planka)")"
  [ -n "$DATA_VOLUME" ] || die 'Could not find the /app/data volume of the production container.'

  docker run --rm -v "${DATA_VOLUME}:/data:ro" -v "${BACKUP_DIR}:/backup" alpine \
    tar czf "/backup/planka_data-${STAMP}.tgz" -C /data .
  info "Attachments: ${BACKUP_DIR}/planka_data-${STAMP}.tgz ($(du -h "${BACKUP_DIR}/planka_data-${STAMP}.tgz" | cut -f1))"

  cp "$PROD_DIR/docker-compose.yml" "${BACKUP_DIR}/docker-compose-${STAMP}.yml"
fi

log 'Deploying'
[ -n "$PREVIOUS_TAG" ] && printf 'PLANKA_PREVIOUS_IMAGE_TAG=%s\n' "$PREVIOUS_TAG" > "${PROD_DIR}/.env.previous"
set_image_tag "$PROD_DIR" "$TAG"
compose_in "$PROD_DIR" up -d

log 'Waiting for the app'
wait_until_healthy "$PROD_DIR"

log 'Verifying'
AFTER="$(record_counts "$PROD_DIR")"
info 'Row counts after: '; print_counts "$AFTER"

if [ "$BEFORE" != "$AFTER" ]; then
  warn 'Row counts changed during the deploy. Check whether people were using the app, then verify manually.'
fi

db_migrations "$PROD_DIR" | sort -r | head -3 | sed 's/^/    /'

log 'Done'
info "Production is running ${IMAGE} on port $(published_port "$PROD_DIR")"
[ -n "$PREVIOUS_TAG" ] && info "Roll back with: scripts/rollback-production.sh --tag ${PREVIOUS_TAG}"
info 'Now check in the browser: log in, open a card, open an attachment, open the timeline.'
