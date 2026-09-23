#!/usr/bin/env bash
#
# Puts production back on a previous image tag.
#
#   scripts/rollback-production.sh [--tag TAG] [--yes]
#
# Defaults to the tag recorded by the last deploy. Refuses to roll back to an image
# that lacks migrations already applied to the database, and prints the SQL to undo
# them so you can decide deliberately.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"

PROD_DIR="${PLANKA_PROD_DIR:-$HOME/planka}"
TAG=''
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_stack "$PROD_DIR"

if [ -z "$TAG" ] && [ -f "${PROD_DIR}/.env.previous" ]; then
  TAG="$(cut -d= -f2- < "${PROD_DIR}/.env.previous")"
fi

[ -n "$TAG" ] || die 'No tag given and none recorded. Pass --tag TAG.'

IMAGE="planka-jugnoo:${TAG}"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "Image not found locally: ${IMAGE}"

log "Rolling production back to ${IMAGE}"

EXTRA="$(comm -23 <(db_migrations "$PROD_DIR") <(image_migrations "$IMAGE") || true)"
if [ -n "$EXTRA" ]; then
  warn 'The database has migrations this older image does not contain:'
  printf '      %s\n' $EXTRA
  warn 'It will not start until those are undone. Undo them by hand, for example:'
  echo
  echo "    docker compose -f ${PROD_DIR}/docker-compose.yml exec -T postgres \\"
  echo "      psql -U postgres -d planka -c \"DELETE FROM migration WHERE name IN (...);\""
  echo
  warn 'Dropping the matching columns or tables is a data loss, so do it deliberately.'
  die 'Rollback stopped.'
fi

confirm "Roll production back to ${IMAGE}?"

set_image_tag "$PROD_DIR" "$TAG"
compose_in "$PROD_DIR" up -d
wait_until_healthy "$PROD_DIR"

log 'Done'
info 'Row counts:'; print_counts "$(record_counts "$PROD_DIR")"
info "Production is back on ${IMAGE}"
