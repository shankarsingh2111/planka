#!/usr/bin/env bash
# Shared helpers for the local, staging and production deployment scripts.

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

# Per-machine settings: PLANKA_IMAGE_REPO, PLANKA_BUILD_PLATFORM
load_deploy_env() {
  local file="$1/.deploy.env"

  if [ -f "$file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

require_image_repo() {
  [ -n "${PLANKA_IMAGE_REPO:-}" ] || die \
    'PLANKA_IMAGE_REPO is not set. Copy .deploy.env.example to .deploy.env and fill it in.'
}

require_docker_login() {
  # The repository is private, so every machine needs credentials once
  local config="${DOCKER_CONFIG:-$HOME/.docker}/config.json"

  if ! grep -q '"auths"' "$config" 2>/dev/null || [ "$(grep -c 'docker.io' "$config" 2>/dev/null || echo 0)" = "0" ]; then
    warn 'No Docker Hub credentials found for this machine.'
    warn 'Run: docker login -u <username>   (use an access token as the password)'
  fi
}

compose_in() {
  # docker compose inside a stack directory
  local dir="$1"; shift
  (cd "$dir" && docker compose "$@")
}

require_stack() {
  local dir="$1"
  [ -d "$dir" ] || die "Stack directory not found: $dir"
  [ -f "$dir/${COMPOSE_FILE:-docker-compose.yml}" ] || die "No ${COMPOSE_FILE:-docker-compose.yml} in $dir"
}

# True when the stack's postgres container is up. `docker compose ps -q` lists only running
# containers, so an empty result means it is stopped or was never created.
db_is_running() {
  [ -n "$(compose_in "$1" ps -q postgres 2>/dev/null)" ]
}

# Brings postgres up on its own and waits until it accepts connections.
#
# Every pre-flight check below reads the database, and `docker compose exec` on a stopped service
# prints "service postgres is not running" and yields nothing without failing the pipeline. That
# makes the checks pass vacuously: assert_image_covers_db sees no applied migrations and raises no
# objection, the "new migrations" list becomes every migration ever written, row counts come back
# blank, and on production pg_dump writes an empty backup. So the database is started first, and
# anything that cannot reach it is a hard stop rather than a silent pass.
ensure_db_running() {
  local dir="$1" timeout="${2:-120}" waited=0

  if ! db_is_running "$dir"; then
    info 'Postgres is not running; starting it'
    compose_in "$dir" up -d postgres || die 'Could not start postgres.'
  fi

  while [ "$waited" -lt "$timeout" ]; do
    if compose_in "$dir" exec -T postgres pg_isready -U postgres -d planka >/dev/null 2>&1; then
      [ "$waited" -gt 0 ] && info "Postgres accepting connections after ${waited}s"
      return 0
    fi

    sleep 2
    waited=$((waited + 2))
  done

  compose_in "$dir" logs --tail 40 postgres
  die "Postgres did not accept connections within ${timeout}s."
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

# A pg_dump of even an empty Planka schema runs to tens of kilobytes, so anything under this is
# a failure that happened to leave a file behind.
MIN_DUMP_BYTES="${PLANKA_MIN_DUMP_BYTES:-10240}"

# A backup only counts once it has been read back.
#
# pg_dump writes to a redirected file, so a failure still leaves something on disk - empty when
# the server was unreachable, truncated when it died partway. Reporting that file's size would
# announce a backup that cannot be restored, and the deploy would carry on behind it. A rejected
# dump is renamed rather than deleted: it keeps the evidence while making sure nothing can later
# mistake it for a usable backup.
assert_usable_dump() {
  # assert_usable_dump <dir> <dump-file>
  local dir="$1" dump="$2" size

  reject_dump() {
    mv -f "$dump" "${dump}.failed" 2>/dev/null || true
    die "$1 (kept as ${dump}.failed)"
  }

  [ -f "$dump" ] || die "pg_dump produced no file at ${dump}"
  [ -s "$dump" ] || reject_dump 'Backup is empty - pg_dump wrote nothing'

  size="$(wc -c < "$dump" | tr -d ' ')"
  [ "$size" -ge "$MIN_DUMP_BYTES" ] ||
    reject_dump "Backup is only ${size} bytes, too small to be a real dump"

  # Reads the custom-format archive's table of contents. Catches a truncated or corrupt dump,
  # and touches no database doing it.
  compose_in "$dir" exec -T postgres pg_restore --list >/dev/null 2>&1 < "$dump" ||
    reject_dump 'Backup is not a readable pg_dump archive'

  info "Database:    ${dump} ($(du -h "$dump" | cut -f1), archive verified)"
}

# Same idea for the attachments tarball: gzip -t walks the whole stream, so a truncated write is
# caught here rather than on the day someone needs it.
assert_usable_tarball() {
  local tarball="$1"

  [ -s "$tarball" ] || die "Attachment backup is empty: ${tarball}"

  gzip -t "$tarball" 2>/dev/null || {
    mv -f "$tarball" "${tarball}.failed" 2>/dev/null || true
    die "Attachment backup is corrupt (kept as ${tarball}.failed)"
  }

  info "Attachments: ${tarball} ($(du -h "$tarball" | cut -f1), archive verified)"
}

ensure_image_present() {
  # Pulls the image when this machine doesn't have it yet
  local image="$1"

  if docker image inspect "$image" >/dev/null 2>&1; then
    info "Image already present: ${image}"
    return 0
  fi

  info "Pulling ${image}"
  require_docker_login
  docker pull "$image" || die "Could not pull ${image}. Is it pushed, and are you logged in?"
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
  local dir="$1" timeout="${2:-180}" waited=0 port status
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

current_image() {
  # Image reference recorded for the stack, or empty
  local dir="$1"
  [ -f "$dir/.env" ] || return 0
  grep -E '^PLANKA_IMAGE=' "$dir/.env" | tail -1 | cut -d= -f2- || true
}

set_image() {
  # Rewrites PLANKA_IMAGE in the stack's .env, keeping other variables
  local dir="$1" image="$2" env_file="$1/.env"

  touch "$env_file"
  if grep -qE '^PLANKA_IMAGE=' "$env_file"; then
    sed -i.bak "s|^PLANKA_IMAGE=.*|PLANKA_IMAGE=${image}|" "$env_file"
    rm -f "${env_file}.bak"
  else
    printf 'PLANKA_IMAGE=%s\n' "$image" >> "$env_file"
  fi
}

stop_stack() {
  # stop_stack <dir> <name> <mode> [restart-hint]
  # mode is "down" (remove containers) or "stop" (leave them). Volumes are never removed.
  local dir="$1" name="$2" mode="$3" hint="${4:-}"

  require_stack "$dir"

  if [ "$(compose_in "$dir" ps -aq | wc -l | tr -d ' ')" = "0" ]; then
    info "${name} is already stopped."
    return 0
  fi

  compose_in "$dir" ps

  local compose_cmd="docker compose"
  [ -n "${COMPOSE_FILE:-}" ] && compose_cmd="${compose_cmd} -f ${COMPOSE_FILE}"
  [ -n "${COMPOSE_PROJECT_NAME:-}" ] && compose_cmd="${compose_cmd} -p ${COMPOSE_PROJECT_NAME}"

  if [ "$mode" = "stop" ]; then
    compose_in "$dir" stop
    info "${name} stopped; the containers still exist and the data is untouched."
    info "Start it again with: ${hint:-cd ${dir} && ${compose_cmd} start}"
  else
    # Never -v: the volumes hold the database and the attachments
    compose_in "$dir" down
    info "${name} is down. Volumes (database and attachments) are untouched."
    info "Bring it back with: ${hint:-cd ${dir} && ${compose_cmd} up -d}"
  fi
}

build_tag() {
  # <date>-<short sha>, marked when the tree is dirty
  local repo_dir="$1" tag
  tag="$(date +%F)-$(git -C "$repo_dir" rev-parse --short HEAD)"

  if [ -n "$(git -C "$repo_dir" status --porcelain)" ]; then
    tag="${tag}-dirty"
  fi

  echo "$tag"
}
