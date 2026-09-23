# Deploying this fork

One image is built once, on the development machine, and then travels unchanged:

```
  Mac (build + test)  ──push──>  Docker Hub  ──pull──>  staging (EC2)  ──promote──>  production (EC2)
   localhost:1337                 private repo           port 6161                    port 6160
```

Nothing is built on EC2, so what runs in production is byte-identical to what you tested.

| Stack | Where | Directory | Compose file | Project | Port |
|-------|-------|-----------|--------------|---------|------|
| Local | Mac | this repo | `docker-compose-local.yml` | `planka_local` | 1337 |
| Staging | EC2 | `~/planka_custom` (this repo) | `docker-compose.yml` | `planka_custom` | 6161 |
| Production | EC2 | `~/planka` (compose file only) | `docker-compose.yml` | `planka` | 6160 |

Each stack's `.env` holds `PLANKA_IMAGE`, the full image reference it runs. The deploy
scripts write it, so a release never edits YAML.

## One-time setup

**Both machines** need `.deploy.env` in the repo (it is gitignored):

```bash
cp .deploy.env.example .deploy.env
# set PLANKA_IMAGE_REPO to your private Docker Hub repo, e.g. acme/planka-custom
```

**Mac**: log in to Docker Hub, with an access token rather than your password.

```bash
docker login -u <username>
```

**EC2**: log in with a *read-only* access token (create one at Docker Hub → Account
settings → Personal access tokens, scope "Public repo read-only" plus access to this
private repo). The server only ever pulls.

```bash
docker login -u <username>
```

**Both EC2 compose files** (`~/planka/docker-compose.yml` and
`~/planka_custom/docker-compose.yml`) must read the image from the environment:

```yaml
    image: ${PLANKA_IMAGE}
    pull_policy: never
```

Then record what each stack runs today, so the first script run changes nothing by
surprise (production is currently on a locally built image, which is fine — it stays
until the next deploy):

```bash
echo "PLANKA_IMAGE=planka-jugnoo:2026-09-23" >> ~/planka/.env
echo "PLANKA_IMAGE=planka-jugnoo:2026-09-23" >> ~/planka_custom/.env
```

Everything else in the production compose file — port `6160:1337`, `BASE_URL`,
`SECRET_KEY`, admin variables, `TRUST_PROXY`, the `data` and `db-data` volumes — stays as
it is. Keeping `SECRET_KEY` is what stops a deploy logging everyone out.

## Day-to-day

**On the Mac** — build, run locally, and push when happy:

```bash
cd ~/Documents/node/planka
cd client && npm run lint && npx jest && cd ..   # the Docker build does not run these

scripts/deploy-local.sh              # build + http://localhost:1337
scripts/deploy-local.sh --push       # same, and push to Docker Hub
```

The tag is `<date>-<short sha>`, e.g. `2026-09-23-abc1234`, with `-dirty` appended when the
working tree has uncommitted changes. Commit before pushing a release.

Log in at http://localhost:1337 with **admin@local.test / admin** (or the username
`admin`). The login form requires a real TLD, which is why the address is not `admin@local`.

Useful flags: `--reset` wipes the local database and attachments, `--no-deploy` builds and
pushes without starting anything, `--tag` overrides the tag.

**On EC2** — pull to staging, then promote the same tag:

```bash
cd ~/planka_custom
scripts/deploy-staging.sh --tag 2026-09-23-abc1234
# try it at https://auto-node-test.jugnoo.in

scripts/deploy-production.sh         # defaults to the image staging runs
```

Each script prints the command for the next stage, so you can copy it along.

## Architecture

The image is built for **linux/amd64**, matching EC2, set as `PLANKA_BUILD_PLATFORM` in
`.deploy.env`. On an Apple Silicon Mac it therefore runs under emulation: slower to start
and somewhat slower in use, in exchange for testing the exact bits that ship. If you ever
want a fast native run for UI work only, build with `--platform linux/arm64` and a
throwaway tag, and never push it.

## What the production script does

1. Refuses to deploy an image missing a migration the production database has already
   applied — otherwise knex fails with "the migration directory is corrupt" and the
   container crash-loops.
2. Lists the migrations that will be applied, and asks for confirmation.
3. Backs up the database (`pg_dump -Fc`), the attachments volume (`tar`) and the compose
   file into `~/backups`.
4. Writes the new image reference and runs `docker compose up -d` — only the app container
   restarts; Postgres and both volumes are untouched.
5. Waits for `/api/bootstrap` to return 200, re-checks the row counts and warns if they
   changed.

Flags: `--tag TAG`, `--yes` (no prompt), `--skip-backup` (don't).

## Stopping a stack

One script per stack; none of them ever touch volumes, so the database and attachments
survive:

```bash
scripts/stop-local.sh            # Mac
scripts/stop-staging.sh          # EC2, staging
scripts/stop-production.sh       # EC2, production - asks to confirm, this is the live board
```

By default they run `docker compose down`, which removes the containers and the network.
Pass `--stop` to leave the containers in place and only stop them, which restarts faster.
Each script prints the command to bring the stack back.

To wipe local data deliberately, use `scripts/deploy-local.sh --reset`. Nothing in these
scripts removes a staging or production volume.

## Rolling back

```bash
scripts/rollback-production.sh                              # the image the last deploy replaced
scripts/rollback-production.sh --tag 2026-09-20-abc1234     # a specific one
```

If the older image predates a migration that has since been applied, the script stops and
prints what to undo rather than starting a container that cannot boot. Undoing a migration
drops its columns or tables, so that step stays manual.

To go all the way back to upstream Planka, restore `~/backups/docker-compose-*.yml` and
undo this fork's migrations:

```sql
DROP TABLE IF EXISTS card_dependency;
ALTER TABLE card DROP COLUMN IF EXISTS start_date;
ALTER TABLE user_account DROP COLUMN IF EXISTS show_extra_board_views,
                         DROP COLUMN IF EXISTS show_quarter_timeline_zoom;
DELETE FROM migration WHERE name IN (
  '20260912000000_add_start_date_to_card.js',
  '20260921000000_add_card_dependencies.js',
  '20260923000000_add_view_preferences_to_user.js');
```

## Restoring a backup

```bash
cd ~/planka && docker compose stop planka
docker compose exec -T postgres pg_restore -U postgres -d planka --clean --if-exists \
  < ~/backups/planka-prod-<stamp>.dump
docker compose start planka
```

## Notes

- Don't run `docker compose pull` in the EC2 directories. The scripts pull explicitly and
  the compose files set `pull_policy: never`.
- Images accumulate on both machines. `docker image ls '<your-repo>'` to review, and keep
  at least the current and previous production tags so rollback stays possible.
- Backups in `~/backups` are never deleted automatically.
- The migration check is what protects you if you ever merge upstream Planka again: it
  compares the migrations inside the image against those applied to each database.
