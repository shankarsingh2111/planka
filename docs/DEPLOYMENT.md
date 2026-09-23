# Deploying this fork

Two stacks run on the same EC2 box, each with its own database volume:

| Stack | Directory | Compose project | Port | Database volume |
|-------|-----------|-----------------|------|-----------------|
| Staging | `~/planka_custom` (this repo) | `planka_custom` | 6161 | `planka_custom_db-data` |
| Production | `~/planka` (compose file only) | `planka` | 6160 | `planka_db-data` |

Both run images named `planka-jugnoo:<tag>`, built from this repo's `Dockerfile`.
Each stack's `.env` holds `PLANKA_IMAGE_TAG`, which its `docker-compose.yml` reads, so a
deploy changes one line in `.env` instead of editing YAML.

## One-time setup

In **both** `~/planka/docker-compose.yml` and `~/planka_custom/docker-compose.yml`, the
`planka` service must read the tag from the environment:

```yaml
    image: planka-jugnoo:${PLANKA_IMAGE_TAG}
    pull_policy: never
```

Then record the tag each stack is running, so the first script run doesn't change anything
unexpectedly:

```bash
echo "PLANKA_IMAGE_TAG=2026-09-23" >> ~/planka/.env
echo "PLANKA_IMAGE_TAG=2026-09-23" >> ~/planka_custom/.env
```

Everything else in the production compose file — port `6160:1337`, `BASE_URL`,
`SECRET_KEY`, the admin variables, `TRUST_PROXY`, the `data` and `db-data` volumes — stays
exactly as it is. Keeping `SECRET_KEY` unchanged is what stops a deploy logging everyone out.

## Day-to-day

```bash
# 1. develop in ~/planka_custom, commit
cd ~/planka_custom
git add -A && git commit -m "..."

# 2. build and deploy to staging (tag is <date>-<short sha>)
scripts/deploy-staging.sh

# 3. try it at https://auto-node-test.jugnoo.in

# 4. promote the exact same image to production
scripts/deploy-production.sh --tag 2026-09-23-abc1234
```

`deploy-production.sh` never builds. It promotes an image that already ran on staging, so
production gets the same bits.

Run the client checks before building — the Docker build does not run them:

```bash
cd ~/planka_custom/client && npm run lint && npx jest
```

## What the production script does

1. Refuses to run if the image is missing a migration the production database has already
   applied (knex would otherwise fail with "the migration directory is corrupt").
2. Lists the migrations that will be applied on startup.
3. Records row counts for projects, boards, cards and users.
4. Backs up the database (`pg_dump -Fc`), the attachments volume (`tar`), and the compose
   file into `~/backups`.
5. Writes the new tag and runs `docker compose up -d` — only the app container restarts;
   Postgres and both volumes are untouched.
6. Waits for `/api/bootstrap` to answer 200, then re-checks the row counts and warns if
   they changed.

Flags: `--tag TAG`, `--yes` (no prompt), `--skip-backup` (don't).

## Rolling back

```bash
scripts/rollback-production.sh                 # to the tag the last deploy replaced
scripts/rollback-production.sh --tag 2026-09-23
```

If the older image lacks a migration that has since been applied, the script stops and
prints what to undo rather than starting a container that would crash-loop. Undoing a
migration drops its columns or tables, so that step is deliberate and manual.

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

- Don't run `docker compose pull` in either directory. Both use local-only image tags.
- Old images accumulate. `docker image ls planka-jugnoo` to review, `docker image rm` to
  drop ones you no longer want to roll back to. Keep at least the current one and the
  previous one.
- Backups in `~/backups` are never deleted automatically.
- If you ever merge upstream Planka again, the migration check in the deploy script is what
  protects you: it compares the image's migrations against what the database has applied.
