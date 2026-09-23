#!/usr/bin/env bash
#
# Promotes the image staging is running to the production stack, with backups and checks.
#
#   scripts/deploy-production.sh [--tag TAG] [--yes] [--skip-backup]
#
# The tag defaults to whatever staging currently runs. This script never builds, so
# production gets the same image that was tested locally and on staging.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"
load_deploy_env "$REPO_DIR"

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
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_stack "$PROD_DIR"

if [ -n "$TAG" ]; then
  require_image_repo
  IMAGE="${PLANKA_IMAGE_REPO}:${TAG}"
else
  IMAGE="$(current_image "$STAGING_DIR")"
  [ -n "$IMAGE" ] || die 'Staging has no image recorded. Pass --tag TAG.'
  info "Taking the image staging runs: ${IMAGE}"
fi

PREVIOUS_IMAGE="$(current_image "$PROD_DIR")"

log "Promoting ${IMAGE} to production (${PROD_DIR})"
ensure_image_present "$IMAGE"
[ -n "$PREVIOUS_IMAGE" ] && info "Currently deployed: ${PREVIOUS_IMAGE}"

log 'Checking the image against the production database'
ensure_db_running "$PROD_DIR"

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

  DUMP="${BACKUP_DIR}/planka-prod-${STAMP}.dump"
  TARBALL="${BACKUP_DIR}/planka_data-${STAMP}.tgz"

  compose_in "$PROD_DIR" exec -T postgres pg_dump -U postgres -Fc planka > "$DUMP" ||
    die "pg_dump failed; ${DUMP} is not a usable backup."
  assert_usable_dump "$PROD_DIR" "$DUMP"

  DATA_VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$(compose_in "$PROD_DIR" ps -q planka)")"
  [ -n "$DATA_VOLUME" ] || die 'Could not find the /app/data volume of the production container.'

  docker run --rm -v "${DATA_VOLUME}:/data:ro" -v "${BACKUP_DIR}:/backup" alpine \
    tar czf "/backup/planka_data-${STAMP}.tgz" -C /data . ||
    die "Could not archive the attachments volume; ${TARBALL} is not a usable backup."
  assert_usable_tarball "$TARBALL"

  cp "$PROD_DIR/docker-compose.yml" "${BACKUP_DIR}/docker-compose-${STAMP}.yml"
fi

log 'Deploying'
[ -n "$PREVIOUS_IMAGE" ] && printf 'PLANKA_PREVIOUS_IMAGE=%s\n' "$PREVIOUS_IMAGE" > "${PROD_DIR}/.env.previous"
set_image "$PROD_DIR" "$IMAGE"
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
[ -n "$PREVIOUS_IMAGE" ] && info "Roll back with: scripts/rollback-production.sh --image ${PREVIOUS_IMAGE}"
info 'Now check in the browser: log in, open a card, open an attachment, open the timeline.'
