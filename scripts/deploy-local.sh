#!/usr/bin/env bash
#
# Builds the image on this machine and runs it at http://localhost:1337.
#
#   scripts/deploy-local.sh [--push] [--tag TAG] [--no-deploy] [--reset] [--yes]
#
#   --push       also push the image to Docker Hub, ready for staging
#   --tag        override the tag (default: <date>-<short sha>, plus -dirty)
#   --no-deploy  build (and push) without starting the local stack
#   --reset      wipe the local database and attachments first
#
# The image is built for the server's architecture (linux/amd64 by default), so the
# exact bits tested here are what ship. On Apple Silicon it runs under emulation.

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${REPO_DIR}/scripts/lib.sh"
load_deploy_env "$REPO_DIR"

export COMPOSE_FILE='docker-compose-local.yml'
export COMPOSE_PROJECT_NAME='planka_local'

PLATFORM="${PLANKA_BUILD_PLATFORM:-linux/amd64}"
TAG=''
PUSH=0
DEPLOY=1
RESET=0
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --push) PUSH=1; shift ;;
    --tag) TAG="${2:-}"; shift 2 ;;
    --no-deploy) DEPLOY=0; shift ;;
    --reset) RESET=1; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

require_image_repo

[ -n "$TAG" ] || TAG="$(build_tag "$REPO_DIR")"
IMAGE="${PLANKA_IMAGE_REPO}:${TAG}"

log "Building ${IMAGE} for ${PLATFORM}"
case "$TAG" in
  *-dirty) warn 'Working tree has uncommitted changes; the tag is marked -dirty.' ;;
esac

docker buildx build --platform "$PLATFORM" -t "$IMAGE" --load "$REPO_DIR"

if [ "$PUSH" = "1" ]; then
  log "Pushing ${IMAGE}"
  require_docker_login
  docker push "$IMAGE"
fi

if [ "$DEPLOY" = "0" ]; then
  log 'Done (not deployed locally)'
  info "Image: ${IMAGE}"
  [ "$PUSH" = "1" ] && info "Deploy it to staging with: scripts/deploy-staging.sh --tag ${TAG}"
  exit 0
fi

if [ "$RESET" = "1" ]; then
  confirm 'Wipe the local database and attachments?'
  compose_in "$REPO_DIR" down -v
fi

log 'Starting the local stack'
set_image "$REPO_DIR" "$IMAGE"
compose_in "$REPO_DIR" up -d

log 'Waiting for the app'
wait_until_healthy "$REPO_DIR"

log 'Ready'
info 'http://localhost:1337   (admin@local.test / admin on a fresh database)'
info "Running ${IMAGE}"

if [ "$PUSH" = "1" ]; then
  info "Deploy it to staging with: scripts/deploy-staging.sh --tag ${TAG}"
else
  info "Push it when you're happy: scripts/deploy-local.sh --push --tag ${TAG}"
fi
