#!/usr/bin/env bash
# Shared helpers for the staging and production deployment scripts.

set -euo pipefail

BACKUP_DIR="${PLANKA_BACKUP_DIR:-$HOME/backups}"

log()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[33m    %s\033[0m\n' "$*"; }
die()  { printf '\n\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

confirm() {
  # confirm <question>; skipped when ASSUME_YES=1
  [ "${ASSUME_YES:-0}" = "1" ] && return 0

  local answer
  read -r -p "    $1 [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || die 'Aborted.'
}

compose_in() {
  # docker compose inside a stack directory
  local dir="$1"; shift
  (cd "$dir" && docker compose "$@")
}

require_stack() {
  local dir="$1"
  [ -d "$dir" ] || die "Stack directory not found: $dir"
  [ -f "$dir/docker-compose.yml" ] || die "No docker-compose.yml in $dir"
}

# Migrations applied in the stack's database, one per line, sorted
db_migrations() {
  compose_in "$1" exec -T postgres psql -U postgres -d planka -t -A \
    -c 'SELECT name FROM migration ORDER BY name;' | sed '/^$/d' | sort
}

# Migration files baked into an image, one per line, sorted
image_migrations() {
  docker run --rm --entrypoint ls "$1" /app/db/migrations | sed '/^$/d' | sort
}

# Fails when the image is missing a migration the database has already applied,
# which makes knex refuse to start ("the migration directory is corrupt").
assert_image_covers_db() {
  local dir="$1" image="$2" missing
  missing="$(comm -23 <(db_migrations "$dir") <(image_migrations "$image") || true)"

  if [ -n "$missing" ]; then
    warn 'The database has migrations this image does not contain:'
    printf '      %s\n' $missing
    die "$image cannot run against this database."
  fi
}

record_counts() {
  compose_in "$1" exec -T postgres psql -U postgres -d planka -t -A -F'|' -c \
    "SELECT (SELECT count(*) FROM project), (SELECT count(*) FROM board),
            (SELECT count(*) FROM card), (SELECT count(*) FROM user_account);" | sed '/^$/d'
}

print_counts() {
  local counts="$1"
  info "projects=$(echo "$counts" | cut -d'|' -f1) boards=$(echo "$counts" | cut -d'|' -f2) cards=$(echo "$counts" | cut -d'|' -f3) users=$(echo "$counts" | cut -d'|' -f4)"
}

published_port() {
  compose_in "$1" port planka 1337 | sed 's/.*://'
}

wait_until_healthy() {
  # wait_until_healthy <dir> [timeout-seconds]
  local dir="$1" timeout="${2:-120}" waited=0 port status
  port="$(published_port "$dir")"

  while [ "$waited" -lt "$timeout" ]; do
    status="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${port}/api/bootstrap" || true)"

    if [ "$status" = "200" ]; then
      info "Responding on port ${port} (HTTP 200) after ${waited}s"
      return 0
    fi

    sleep 3
    waited=$((waited + 3))
  done

  compose_in "$dir" logs --tail 40 planka
  die "The app did not answer on port ${port} within ${timeout}s."
}

current_image_tag() {
  # Tag currently recorded for the stack, or empty
  local dir="$1"
  [ -f "$dir/.env" ] || return 0
  grep -E '^PLANKA_IMAGE_TAG=' "$dir/.env" | tail -1 | cut -d= -f2- || true
}

set_image_tag() {
  # Rewrites PLANKA_IMAGE_TAG in the stack's .env, keeping other variables
  local dir="$1" tag="$2" env_file="$1/.env"

  touch "$env_file"
  if grep -qE '^PLANKA_IMAGE_TAG=' "$env_file"; then
    sed -i.bak "s|^PLANKA_IMAGE_TAG=.*|PLANKA_IMAGE_TAG=${tag}|" "$env_file"
    rm -f "${env_file}.bak"
  else
    printf 'PLANKA_IMAGE_TAG=%s\n' "$tag" >> "$env_file"
  fi
}
