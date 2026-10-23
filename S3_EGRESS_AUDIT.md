# S3 Egress Audit: planka

Audit date: 2026-10-25. Scope: every local and remote-tracking ref already in this clone (`git log --all`); no `git fetch` was run, so branches that were never fetched or have been deleted are not covered. Read-only audit: no source code was changed.

**Bottom line:** Change 1: **No match.** The upstream commits in the window are security fixes, 2FA and UI work. Change 2: **No match.** S3 storage arrived on Sep 27, and it is server-proxied.

**Platform context (applies to every repo in `node/` and `node2/`):** none of the 64 git repos in these two folders is an Android, iOS or Flutter app, so no client-side image cache, polling or app-release code could be checked. No repo generates presigned S3 URLs (`getSignedUrl`, `createPresignedPost`, `s3-request-presigner` were searched in all repos; zero hits outside `node_modules`), and no repo serves media through CloudFront. Every uploader that was found writes `public-read` objects and hands out the direct S3 URL. Buckets that the code itself places in Mumbai (ap-south-1): `jugnoo-marketing-images` (sns campaign/push images; region confirmed by `sns/lib/image.js:28`), `jugnoo-menus`, `jugnoo-dodo-delivers` (`dodo-server/config/development.json:202`), `jugnoo-fatafat`, `fchat` / `fuguchat` / `fuguchat-attendance` (Hippo/Fugu chat), `jungleworks-kato`. The autos buckets (`operator-autos-app-data`, `jugnoo-autos-ride-data`, `jugnoo-autos-drivers`, `jugnoo-autos-customers`, `jugnoo-autos-branding-videos`, `push-api-images`) are configured or linked as **ap-southeast-1 (Singapore)**. Production config files are not in git, so this can't be confirmed from code. The cross-repo summary is in `node/S3_EGRESS_AUDIT.md`.

---

## 1. Repo summary

| Item | Value |
|---|---|
| Name | `planka` (package `planka`, version `2.1.1`) |
| Location | `node/planka`, remote `https://github.com/shankarsingh2111/planka.git`, checked out on `comment-attachments`, last commit on any branch 2026-10-24 |
| Type | Node.js app (server + client) |
| Main frameworks | n/a |
| How it uses S3 | Self-hosted Planka (kanban) fork. Attachments are stored on local disk or S3 and **streamed through the Planka server** (`server/api/controllers/storage/show.js`), so S3 traffic goes to the server, not straight to browsers. |
| Buckets / region | The `show.js:33` docs example uses `ap-south-1`. S3 storage via instance role was added in 42710787 (**2026-09-27, after both windows**). |
| Buckets seen in hardcoded S3 URLs (region from the URL) | none hardcoded |

---

## 2. Commits and releases in the two date windows

Windows: **Aug 1 to Sep 1, 2026** (Change 1, including the 2-week lead time before Aug 15) and **Sep 2 to Sep 26, 2026** (Change 2; its lead time from Aug 29 is already in the first table). A commit is listed if its author date or commit date falls in a window. Relevance comes from reading the diffs of hand-reviewed commits. All other commits were rated by scanning their added and removed lines for S3, media, cache and timer keywords.

**Releases:** Tags created in the windows: `planka-2.2.0` (2026-08-09), `v2.2.0` (2026-08-09), `v2.2.1` (2026-08-10). Version-field changes: `2026-08-10 266246e2 Daniel Hiller | chore: Update version`; `2026-08-09 2684198b Daniel Hiller | chore: Update version`.

### Change 1 window (Aug 1 to Sep 1)

| Author date (commit date) | Hash | Author | Message | Relevance |
|---|---|---|---|---|
| 2026-08-07 | 2e4904f7 | Daniel Hiller | feat: Add two-factor authentication via TOTP | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-07 | 36aa732f | Daniel Hiller | feat: Remove OIDC and SSO support | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-07 | a1f0a2b3 | Daniel Hiller | chore: Update dependencies | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-07 | ebb9d687 | Daniel Hiller | ci: Align workflows with Node 24 | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-07 | 3a9eea30 | Daniel Hiller | ci: Drop armv7 from Docker image builds | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-07 | bec5dd15 | Daniel Hiller | chore: Update dependencies | Low: keyword match (`s3-`×6). Flagged for review, but no S3 read, URL or cache change was found |
| 2026-08-08 | 3ef87a86 | Daniel Hiller | feat: Add configurable auto logout on inactivity | Low: keyword-only match (`setinterval`×1). Upload, UI or timer code, not S3 delivery |
| 2026-08-08 | a9d0c228 | Daniel Hiller | feat: Replace user edit popups with a single modal | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-08 | a6f6af8a | Daniel Hiller | fix: Replace Pro theme tokens with literal colors | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-09 | ffc7734f | daniel-hiller | Update index.yaml | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-09 | 2684198b | Daniel Hiller | chore: Update version | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-10 | 266246e2 | Daniel Hiller | chore: Update version | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-10 | bd487e3f | Daniel Hiller | fix: Prevent path traversal in local file manager | Low: keyword-only match (`upload`×9). Upload, UI or timer code, not S3 delivery |
| 2026-08-26 | 6def0330 | Daniel Hiller | chore: Move the changelog to the repository root | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-26 | d7da44ef | Daniel Hiller | feat: Add script to clean orphaned reference records | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-26 | 2d289cd3 | Daniel Hiller | fix: Make endless list pagination deterministic | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-26 | 4add7e43 | Daniel Hiller | fix: Keep dangling project references from blanking the home view | None: no S3, media, cache or timer keywords in the diff |
| 2026-08-28 | de4d7688 | Daniel Hiller | fix: close the gaps a security review found in the default install | Low: keyword match (`upload`×2, `s3-`×1). Flagged for review, but no S3 read, URL or cache change was found |

### Change 2 window (Sep 2 to Sep 26)

| Author date (commit date) | Hash | Author | Message | Relevance |
|---|---|---|---|---|
| 2026-09-02 | 296f869c | dependabot[bot] | build(deps-dev): Bump fast-uri from 3.1.5 to 3.1.7 in /server | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-02 | 5c64c55c | dependabot[bot] | build(deps): Bump sanitize-html from 2.17.6 to 2.17.7 in /client | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-08 | 26b51219 | Daniel Hiller | chore: Translate the strings missing from every locale | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-08 | 9069b24c | Daniel Hiller | chore: Add a locale completeness check | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-08 | 76d3911d | Daniel Hiller | docs: Add a PLANKA Pro section to the README | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-08 | 4e15748e | Daniel Hiller | feat: Widen the Pro banner rotation and split it by role | Low: keyword-only match (`banner`×1). Upload, UI or timer code, not S3 delivery |
| 2026-09-09 | 3cf7e159 | dependabot[bot] | build(deps): Bump svgo from 3.3.4 to 3.3.5 in /client | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-10 | 75608c33 | dependabot[bot] | build(deps): Bump nodemailer from 9.0.3 to 9.1.1 in /server | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-11 | 6425a2ac | dependabot[bot] | build(deps): Bump sharp from 0.35.3 to 0.35.4 in /server | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-12 (2026-09-21) | 761b9f95 | Shankar | timeline: Team Dashboard & Board Timeline | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-21 | 65661e9f | Shankar | timeline: phase 1,2 complete | Low: keyword match (`resize`×14). Flagged for review, but no S3 read, URL or cache change was found |
| 2026-09-23 | 8ccdeff7 | Shankar | timeline: timeline fixes | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-23 | 97b7110c | Shankar | timeline features | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-23 | b27d2f72 | Shankar | card bug fix | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-23 | eb89e714 | Shankar | timeline: custom build | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-23 (2026-09-28) | 70e2a7a8 | Shankar | timeline: current time marker correction | Low: keyword-only match (`setinterval`×1). Upload, UI or timer code, not S3 delivery |
| 2026-09-23 (2026-09-28) | 6db7fd5b | Shankar | timeline: FEATURE: drag drop complete feature + fixes | Low: keyword match (`resize`×17). Flagged for review, but no S3 read, URL or cache change was found |
| 2026-09-23 (2026-09-28) | 060914f5 | Shankar | Add build, deploy and stop scripts for local, staging and production | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-23 (2026-09-28) | 9e17ca58 | Shankar | deploy scripts and ui fix | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-23 (2026-09-28) | b6caafd7 | Shankar | timeline: ui fixes | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-25 (2026-09-28) | a5651ce5 | Shankar | timeline cell click to add card | None: no S3, media, cache or timer keywords in the diff |
| 2026-09-26 (2026-09-28) | 0395bd64 | Shankar | cards without start date fix | Low: keyword match (`banner`×4, `resize`×3). Flagged for review, but no S3 read, URL or cache change was found |

---

## 3. Findings ranked by likely impact

Search coverage: `amazonaws.com`, `s3.`, `ap-south-1`, bucket names, `getSignedUrl`/presign, `getObject`/`GetObjectCommand`, `putObject`/`upload`, `cloudfront`, `Cache-Control`/`no-cache`, cache-busting (`?t=`, `?v=` + `Date.now()`), `setInterval`/`$interval`, thumbnail and resize libraries, `.mp4`/`.gif`. **Not found in this repo:** presigned URLs, CloudFront URLs, cache-busting params on S3 URLs.

| # | Cat. | File:line | Introduced | What happens | Effect | Confidence it contributes |
|---|---|---|---|---|---|---|
| 1 | F | `server/api/controllers/storage/show.js` | 42710787, 2026-09-27 | S3-backed attachments are proxied by the server. That is S3-to-EC2 traffic, and it started after Sep 26. | None for internet egress | None |

---

## 4. Best match to each change

- **Change 1 (Aug 26 ramp, +35% GETs, +45% bytes per GET):** **No match.** The upstream commits in the window are security fixes, 2FA and UI work.
- **Change 2 (from ~Sep 22, same objects fetched more often):** **No match.** S3 storage arrived on Sep 27, and it is server-proxied.

---

## 5. Recommended fixes

| # | Fix | Effort |
|---|---|---|
| 1 | Turn on S3 server access logs (or CloudTrail S3 data events) for the Mumbai bucket and group GETs by key prefix, User-Agent and Referer for Aug 15 to Oct 1. This is the fastest way to name the client and the objects behind each jump. | S |
| 2 | Put CloudFront (with Origin Access Control) in front of the media buckets and return CloudFront URLs instead of direct S3 URLs. | M |
| 3 | Set `CacheControl: 'public, max-age=31536000, immutable'` and a correct `ContentType` on every upload. File names are already unique (`Date.now()` / random), so objects never change in place. Backfill existing objects with S3 Batch Operations copy-in-place. | S |

---

## 6. Open questions for the team

1. Which bucket exactly is the Mumbai bucket on the bill? Its S3 access logs, grouped by prefix and User-Agent, will show whether objects from this repo's paths are involved.
2. Rollout dates of the rider and driver mobile app releases between Aug 15 and Sep 25. Those apps are not in `node/` or `node2/`, so their image-loading and caching code was not audited.
