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
