# File storage on S3 and attachment upload rules

Since September 2026, production stores uploaded files in the S3 bucket
**`jugnooplankanban`** (region **`ap-south-1`**) instead of the `data` Docker volume.
This document covers how storage works, how production is set up, how existing files
are moved, and the rules applied to card attachment uploads.

For the step-by-step deploy, see `DEPLOYMENT.md` → "Uploads and file storage".

## How storage works

Planka keeps each file under a path, and that same path is the file's location on
disk (below `/app/data`) or its key in the bucket:

| Files | Path |
|-------|------|
| Card attachments | `private/attachments/<uploadedFileId>/<filename>` |
| Attachment previews | `private/attachments/<uploadedFileId>/thumbnails/outside-360.<ext>`, `outside-720.<ext>` |
| User avatars | `protected/user-avatars/<uploadedFileId>/...` |
| Project backgrounds | `protected/background-images/<uploadedFileId>/...` |
| Link favicons | `protected/favicons/<hostname>.png` |

At startup, Planka uses S3 if `S3_REGION` or `S3_ENDPOINT` is set, and the local disk
otherwise (`server/api/hooks/file-manager`). The choice applies to every file type.

- **New files** go only to the active storage.
- **Reading from S3 falls back to the local disk.** If a file is not in the bucket,
  Planka serves the local copy when one exists. Files uploaded before the switch
  therefore keep working until they are exported.
- **Deletes** only apply to the active storage.

## Configuration

| Variable | Production value | Notes |
|----------|------------------|-------|
| `S3_REGION` | `ap-south-1` | Must be the bucket's region. |
| `S3_BUCKET` | `jugnooplankanban` | |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | unset | Without them, the AWS SDK default credential chain is used: on EC2, the instance role. |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | unset | Only for S3-compatible services such as MinIO. |
| `MAX_UPLOAD_FILE_SIZE` | `100MB` | Applies to every upload. Unset means no limit. |
| `ALLOWED_ATTACHMENT_EXTENSIONS` | unset | Comma-separated. Unset means the default list below; `*` allows any type. |

Production's compose file lives only on the EC2 box, in `~/planka/docker-compose.yml`.

## Production AWS setup

- **Credentials:** the EC2 instance role `Y-risk-client-role`. Planka's access comes from
  its own inline policy, `s3_planka_Access`, so the role's other bucket access is untouched.
- **Policy.** Bucket actions go on the bucket ARN, object actions on `/*`. Putting
  `s3:GetObject` on the bucket ARN has no effect.

  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "PlankaBucketList",
        "Effect": "Allow",
        "Action": ["s3:ListBucket", "s3:ListBucketMultipartUploads"],
        "Resource": "arn:aws:s3:::jugnooplankanban"
      },
      {
        "Sid": "PlankaBucketWrite",
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload"],
        "Resource": "arn:aws:s3:::jugnooplankanban/*"
      }
    ]
  }
  ```

- **The bucket stays private.** Planka streams every file itself and checks access on
  each request: attachments need board membership, avatars and backgrounds need a logged-in
  user. The bucket needs no public access, bucket policy or CORS.
- **Staging must not use this bucket.** Staging has its own database, which can generate
  the same file IDs, so the two sites could overwrite or delete each other's files.

To check the role can use the bucket, run on the EC2 host:

```bash
B=jugnooplankanban; R=ap-south-1; K=planka-access-test/$(date +%s).txt
echo test > /tmp/planka-s3-test.txt
aws s3api put-object --bucket $B --region $R --key $K --body /tmp/planka-s3-test.txt >/dev/null && echo "put    OK" &&
aws s3api get-object --bucket $B --region $R --key $K /tmp/planka-s3-test.out >/dev/null && echo "get    OK" &&
aws s3api list-objects-v2 --bucket $B --region $R --prefix planka-access-test/ >/dev/null && echo "list   OK" &&
aws s3api delete-object --bucket $B --region $R --key $K >/dev/null && echo "delete OK"
```

To check the Planka container can reach the role's credentials:

```bash
cd ~/planka
docker compose exec -e AWS_REGION=ap-south-1 planka node -e "
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
new S3Client({}).send(new ListObjectsV2Command({ Bucket: 'jugnooplankanban', MaxKeys: 1 }))
  .then(() => console.log('OK'))
  .catch((e) => console.log('FAILED:', e.name, '-', e.message));
"
```

## Moving existing files to S3

**Administration → Storage** (admins only) shows where files are stored and when they were
last exported. It has two actions:

- **Export local files to S3** copies every local file to the bucket at the same path.
  - It skips files already in S3 with the same size, so a second run is cheap and a failed
    run can simply be repeated.
  - Local files of deleted uploads (folders with no row in `uploaded_file`) are left out
    and reported as "leftover".
  - It runs in the background, and the tab shows live progress.
- **Delete local copies once verified in S3** (tick box, asks to confirm) also deletes
  each local file once its S3 copy has been checked to be the same size. Files that fail
  stay on disk. Empty folders are removed afterwards; leftover files are not touched.

The time and counts of the last run that finished with no failures are saved in the
`config` table, so they survive restarts. Progress of a running export is kept in memory
only; after a restart, run the export again, and files already copied are skipped.

The same actions are available through the API: `GET /api/storage` and
`POST /api/storage/export-to-s3` with `{ "deleteLocalFiles": true|false }`, both admin only.

## Card attachment upload rules

Checked by the server on every upload (`server/api/helpers/attachments/check-uploaded-file.js`)
and, to avoid pointless uploads, in the browser beforehand.

- **Allowed extensions** (default list):
  - Images: jpg, jpeg, png, gif, webp, heic, heif, svg, bmp
  - Video: mp4, mov, webm, mkv, avi, m4v
  - Audio: mp3, wav, m4a, ogg
  - pdf
  - Documents: doc, docx, odt, rtf, txt, md
  - Spreadsheets: xls, xlsx, ods, csv
  - Presentations: ppt, pptx, odp
  - zip
- **Content check.** The file's real type, detected from its contents, must also be
  acceptable, so a renamed `.exe` is rejected.
- **SVG.** Files with scripts, event handlers, `javascript:` links, embedded documents
  (`foreignObject`, `iframe` and similar), entity declarations or references to outside
  content are rejected. SVGs are always downloaded with a sandboxing
  `Content-Security-Policy` header, so even one that slips through cannot run scripts.
  Adobe Illustrator files saved with "Preserve Illustrator Editing Capabilities" are
  rejected; re-export them without that option.
- **Size.** `MAX_UPLOAD_FILE_SIZE`. nginx must allow a little more, in the `listen 443`
  block of `/etc/nginx/conf.d/planka.jugnoo.in.conf`:

  ```nginx
  client_max_body_size 110m;
  client_body_timeout  300s;
  ```

Rejected uploads return `422` with `File type not allowed` or
`SVG contains active content`, and the browser shows a message naming the file.
Avatars and project backgrounds are unaffected; they already accept images only.

## Troubleshooting

| Symptom | Cause |
|---------|-------|
| `CredentialsProviderError` / "Could not load credentials" | The container cannot reach instance metadata. Set the instance's metadata hop limit to 2. |
| `AccessDenied` on `GetObject` although `PutObject` works | Object actions are on the bucket ARN instead of `/*` in the policy. |
| `PermanentRedirect` | `S3_REGION` is not the bucket's region. |
| `413 Request Entity Too Large` from nginx | `client_max_body_size` is missing or too small. |
| Old attachments 404 after switching | The local copy is gone and the file was never exported. Check `~/backups`. |

## Backups and rollback

The production deploy script's `tar` backup covers the `data` volume only; files in S3
need their own protection, such as bucket versioning.

To go back to local storage, first copy the bucket into the volume (the container user
has uid 1000), then remove the `S3_*` lines and restart:

```bash
V=$(docker volume inspect planka_data -f '{{.Mountpoint}}')
sudo aws s3 sync s3://jugnooplankanban/ "$V/" && sudo chown -R 1000:1000 "$V"
cd ~/planka && docker compose up -d
```

To undo the database change, see the rollback SQL in `DEPLOYMENT.md`
(`20260927000000_add_s3_export_to_config.js`).

## Code map

| Area | Files |
|------|-------|
| Credentials | `server/api/hooks/s3/index.js` |
| Local fallback | `server/api/hooks/file-manager/S3FileManager.js`, `index.js` |
| Export | `server/utils/s3-export.js` (file logic), `server/api/hooks/s3-export/` (background job), `server/api/controllers/storage/` |
| Last export | `server/db/migrations/20260927000000_add_s3_export_to_config.js`, `server/api/models/Config.js` |
| Upload rules | `server/utils/attachment-files.js`, `server/api/helpers/attachments/check-uploaded-file.js`, `server/api/controllers/file-attachments/download.js` (SVG header) |
| Storage tab | `client/src/components/common/AdministrationModal/StoragePane.jsx` |
| Browser checks | `client/src/utils/attachment-files.js`, `client/src/sagas/core/services/attachments.js` |
| Tests | `server/test/utils/attachment-files.test.js`, `server/test/utils/s3-export.test.js`, `client/src/utils/attachment-files.test.js` |

The server tests run without a database:

```bash
cd server && npx mocha test/utils/attachment-files.test.js test/utils/s3-export.test.js
```

One gotcha for future migrations: the knexfile snake-cases identifiers, which turns `s3_`
into `s_3_`. Columns whose names have a digit next to a letter must be created with raw SQL,
as the migration above does.
