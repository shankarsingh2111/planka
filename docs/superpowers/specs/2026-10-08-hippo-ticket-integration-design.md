# Hippo Ticket Integration — Design

Date: 2026-10-08 · Branch: `hippo_ticket_integration`

## 1. Goal

Let a board editor create a Planka card from a Hippo ticket (hippochat.io) by entering a ticket
number or URL in the Add Card dialog, with as much of the ticket prefilled as possible. Then keep
two things flowing back to Hippo: Planka comments become Hippo notes, and Ticket State changes
update the ticket status. Every push to Hippo is confirmed by the user first.

### In scope

- A generic **dropdown** custom-field type (any custom field can be a dropdown with predefined options).
- A per-project **Hippo app secret key**, set by project managers in Project Settings.
- **Import**: ticket lookup in the Add Card dialog. It prefills title, description, due date and members, the
  "Hippo Ticket" fields (Ticket #, Ticket State, Priority, Ticket URL), and notes/comments as Planka comments.
- **Sync back** (ticket cards only, each with a confirmation dialog):
  - New Planka comment → Hippo **note**.
  - Ticket State change → Hippo **status** update.

### Out of scope

Hippo → Planka live sync, re-importing into an existing card, duplicate-import detection, attachments,
pushing assignee/priority/due-date/description changes, editing or deleting already-synced notes.

### Definitions

- **Ticket card**: a card whose board's "Hippo Ticket" custom field group has a non-empty
  `Ticket #` value for that card. No new card type. When a card moves to another board, Planka copies
  the board's groups onto the card as card-level groups, so a card-level `Hippo Ticket` group counts
  too. The board's group wins when both exist.
- **Hippo Ticket group**: a board-level custom field group named `Hippo Ticket`, created on first
  import into a board.

## 2. Hippo API (as documented)

All calls are `POST https://api.hippochat.io/api/ticketing/activities` with a JSON body containing
`app_secret_key`:

| Purpose | Body |
|---|---|
| Ticket details | `{ ticket_id }` → `data: { _id, uid, subject, issue (HTML), status, statusText, priority{name}, type{name}, group{name}, assignee[{fullname,email}], dueDate, notes[{owner{fullname},date,note(HTML),deleted}], comments[{owner,date,comment(HTML),deleted}] }` |
| Add note | `{ is_update_ticket: 1, ticket_id, update_key: "NOTE", note }` |
| Update status | `{ is_update_ticket: 1, ticket_id, update_key: "STATUS", status: "<status name>" }` |

Key verification: `GET https://api.hippochat.io/api/business/verifyAccount?app_secret_key=…`.

Errors come back as `{ statusCode: 400, message }`. HTML fields are most likely raw HTML (`<p>…</p>`).
The Postman page shows them entity-escaped (`&lt;p&gt;`), which may only be how the docs page renders
them, so the converter accepts both forms.

**Open assumption to verify with a real key:** `ticket_id` accepts the visible ticket number
(`uid`, e.g. `43886`). All Hippo calls go through one helper module (§4.2), so if it needs the
Mongo `_id` instead, only that module changes. In that case it first resolves `uid` → `_id` with the
"Fetch All Tickets" call. `Ticket #` always stores the visible number.

## 3. Data model changes

One migration, `server/db/migrations/20261008000000_add_hippo_integration.js`:

- `custom_field.type`: text, not null, default `'text'`. Allowed values: `text` | `dropdown`.
- `custom_field.options`: jsonb, nullable. For dropdown fields this is an array of non-empty, unique strings.
- `project.is_hippo_configured`: boolean, not null, default `false`. Not secret; it reaches clients
  through the existing project payloads and socket updates.
- New table `project_hippo_config` (`id`, `project_id` unique, `app_secret_key`, timestamps). The key
  lives here rather than on `project`, so it is never loaded with project records.

Models:

- `CustomField`: add `type` (`isIn: Types`), `options` (json). Validate in the create and update
  controllers: `dropdown` requires `options` to be a non-empty string array; `text` sets `options`
  to null. The card copy/detach helpers carry `type` and `options` along.
- `CustomFieldValue`: the create-or-update controller rejects a value for a dropdown field that is
  not in its `options` (new error `VALUE_NOT_IN_OPTIONS`, 422).
- `Project`: add `isHippoConfigured`.
- `ProjectHippoConfig` (new): `projectId`, `appSecretKey`. **It must never reach any client.** No
  endpoint returns it, and project deletion removes it.

(Changed during planning: the first draft put the key in a `project` column hidden by `customToJSON`.
Waterline attaches that serializer as a non-enumerable `toJSON`, so any `{ ...project }` copy would
leak the key. A separate table removes that risk.)

## 4. Server

### 4.1 Project settings: key management

All three are for project managers only:

- `PUT /api/projects/:projectId/hippo-config` `{ appSecretKey }`: saves (or replaces) the key and
  sets `project.isHippoConfigured`.
- `DELETE /api/projects/:projectId/hippo-config`: removes the key and clears the flag.
- `POST /api/projects/:projectId/hippo-config/verify`: calls `verifyAccount` with the stored key and
  returns `{ item: { projectId, isValid: true } }`, or 422 `Hippo key invalid`.

The flag change goes through `sails.helpers.projects.updateOne` **without** the request, so the
`projectUpdate` socket event also reaches the manager who made the change and their store updates.

### 4.2 Hippo client helper

`server/api/helpers/hippo/` holds one helper per outbound call, following the house pattern:

- `send-request` (`{ appSecretKey, path, body? }`): the one place that talks HTTP
- `fetch-ticket` (`{ appSecretKey, ticketNumber }`) → raw `data`
- `add-note` (`{ appSecretKey, ticketNumber, note }`)
- `update-status` (`{ appSecretKey, ticketNumber, status }`)
- `verify-account` (`{ appSecretKey }`)
- `get-app-secret-key` (`{ projectId }`): throws `hippoNotConfigured` when the project has no key
- `get-ticket-values-by-cards` (`{ cards }`) → `{ [cardId]: { ticketNumber, ticketState, priority, ticketUrl } }`
  for ticket cards, batched (used by the sync endpoints and the dashboard)

Implementation details:

- Uses Node's global `fetch` with undici's `ProxyAgent` when `OUTGOING_PROXY` is set, the same as
  `send-webhooks`, and a 10s timeout.
- `statusCode !== 200` maps to typed exits: `hippoTicketNotFound`, `hippoUnauthorized`,
  `hippoUnavailable`, and `hippoRejected` (any other Hippo error, carrying Hippo's message).
- No call is made when the key is empty; that case throws `hippoNotConfigured`.
- The key is never logged.
- Hippo failures map to 404/422 responses, never 401. A 401 would log the Planka user out.

`server/utils/hippo.js` holds the pure parts (unit-tested): request bodies, response
classification, HTML → Markdown, note HTML, assignee matching, and `mapTicket`, which turns raw
ticket data into:

```
{ number, subject, descriptionMarkdown, statusText, priority, type, group,
  dueDate | null, assignees: [{ name, email }],
  entries: [{ id, kind: 'note'|'comment', authorName, date, markdown }] }   // oldest first, deleted excluded
```

HTML → Markdown conversion:
1. Decode entities, but only when the text has no raw tags and does contain `&lt;`.
2. Convert with `turndown`, a new server dependency. Mention markup becomes plain text along the way.

### 4.3 Endpoints

| Method & path | Who | Does |
|---|---|---|
| `GET /api/boards/:boardId/hippo-tickets/:ticketNumber` | board editor | Resolves the board's project key → `fetch-ticket` → `map-ticket` → returns the mapped ticket |
| `POST /api/cards/:cardId/hippo-sync/note` `{ commentId }` | board editor | Posts that Planka comment to Hippo as a note |
| `POST /api/cards/:cardId/hippo-sync/status` | board editor | Pushes the card's current Ticket State value to Hippo |

- `:ticketNumber` must match `^\d{1,12}$`. The client normalizes input first (§5.2).
- **Assignees are matched to board members on the server.** Planka hides other users' emails from
  non-admins, so the client cannot match them. Emails are compared case-insensitively with any
  `+tag` stripped (`harsh.sharma+1cs@x` matches `harsh.sharma@x`), and deactivated users are skipped.
  The lookup returns `assignees: [{ name, userId | null }]`, without emails.
- The sync endpoints read the ticket number from the card's `Ticket #` value. If it is missing, they
  return 422 `NOT_A_TICKET_CARD`.
- **Note body sent to Hippo:** `"<Planka user name> (via Planka): <comment text>"`. Hippo attributes
  API notes to the business, so the author name is prepended.
- Sync is **separate from** comment/value creation: the Planka change always succeeds on its own,
  and the push is a second call. A Hippo failure never rolls back the Planka change. The user sees
  an error toast and can retry from the card (§5.4).

## 5. Client

### 5.1 Project Settings → new "Integrations" tab (managers only)

- A password input for the **Hippo app secret key** with **Save**, **Remove** and **Test connection** buttons.
- The current key is never shown. The tab displays "Configured" or "Not configured" from `isHippoConfigured`.
- The pane calls the hippo-config endpoints directly, as the Team Dashboard does for its data. The
  configured flag then arrives through the `projectUpdate` socket event.

### 5.2 Add Card dialog (`components/cards/AddCardModal/Content.jsx`)

The dialog opens from two places:

- **Timeline view**: the existing Add Card dialog.
- **Kanban lists**: a new ticket-icon button in each list's footer, next to "Add card" (and "paste"
  when shown). It opens the same dialog for that list with the ticket input focused. It is shown only
  to board editors when the project has a key.

The Hippo input is shown only when the project has `isHippoConfigured`:

- **"Import from Hippo"** row above the title, with an input and a **Fetch** button.
- `parseTicketNumber(input)` (pure, unit-tested) accepts `43886`, `#43886`, or any URL. For a URL
  it takes the last run of digits in the path or hash.

On a successful fetch, the dialog fills in, and everything stays editable:

- **Title** ← `subject`.
- **Description** ← `descriptionMarkdown`, ending with `\n\n— Imported from Hippo ticket #43886`.
- **Due date** ← `dueDate` if present.
- **Members** ← assignees the server matched to board members (`userId` set). Unmatched assignees
  are shown as a muted hint, e.g. "Not on this board: Sarabjot Kaur".
- **Hippo Ticket section** (new, read-only preview): Ticket #, Ticket State (a dropdown you can change
  before adding), Priority, Ticket URL.
- **Notes & comments preview**: one row per entry with kind badge, author, date and first line, each
  with a checkbox (all ticked by default), plus "Select all/none".

On fetch failure the dialog shows an inline error (not found / key invalid / Hippo unavailable) and
leaves your existing input alone. A second fetch replaces the previous prefill.

Ticket URL is built as follows:

- If the user pasted a URL, use it as is.
- If they entered only a number, use the project's last-used URL pattern, i.e. the pasted URL with
  its number swapped. This is kept in `localStorage` per project.
- If there is no pattern yet, leave Ticket URL empty.

### 5.3 Create flow (saga)

`createCardWithDetails` gets an optional `hippo` argument: `{ ticketState, values, commentTexts }`,
built by the dialog. `values` is the ordered list of field name/content pairs; `commentTexts` holds
the selected entries, already formatted. After the card, members and labels are created, and
**before** the recurrence, so the cards of a series are copies that include the Hippo fields:

1. **Ensure the board's Hippo Ticket group** (`ensureHippoFieldGroup(boardId)`). If no board-level
   group named `Hippo Ticket` exists, create it with these fields:
   - `Ticket #` (text, show on front: no)
   - `Ticket State` (dropdown, show on front: yes; options seeded `New, Pending from Dev, Pending from CSM, Closed`)
   - `Priority` (text, show on front: no)
   - `Ticket URL` (text, show on front: no; the card front shows the ticket chip instead, §5.6)

   If the group exists but `Ticket State` lacks the imported `statusText`, append it to the options.
2. **Set values**: Ticket #, Ticket State, Priority, Ticket URL (the last one only if present).
3. **Post selected entries** as Planka comments, oldest first, sequentially, so their order is kept.
   Format: `**[Hippo Note] Harsh Sharma · Oct 1, 2026 11:34**\n\n<markdown>`.
   These imported comments are **not** synced back to Hippo.

If a step fails, the card stays, the remaining steps are skipped, and an error toast says what was
not imported.

### 5.4 Sync back with confirmation

Ticket-card detection is the selector `selectHippoTicketForCurrentCard` / `makeSelectHippoTicketByCardId`.
It reads the card's value for the `Ticket #` field of the `Hippo Ticket` group (board-level first,
then card-level). The dialogs appear only for board editors, since only editors may sync.

**Comments** (card modal comment box): when the card is a ticket card and the user submits a comment,
show a confirmation dialog:

> "Also post this comment to Hippo ticket #43886 as a note?"
> **[Post to Planka & Hippo]** **[Planka only]** **[Cancel]**

- *Planka & Hippo*: create the comment, then call `hippo-sync/note` with the new comment id.
- *Planka only*: create the comment as usual.
- *Cancel*: keep the draft and do nothing.

**Ticket State**: when the user picks a different value in the `Ticket State` dropdown of a ticket card,
show a confirmation dialog:

> "Change Hippo ticket #43886 status to 'Closed'?"
> **[Update Planka & Hippo]** **[Planka only]** **[Cancel]**

- *Update Planka & Hippo*: save the value, then call `hippo-sync/status`.
- *Planka only*: save the value.
- *Cancel*: revert the selection.

Both cases:

- A Hippo failure shows a toast: "Saved in Planka, but Hippo update failed: <reason>" with a
  **Retry** action.
- The dialogs are not shown when the project has no key configured. Those cards behave as plain cards.
- Edits/deletes of comments are not synced.

### 5.5 Dropdown field type UI

- **Field editors**: the two identical `CustomFieldEditor` copies (board/card groups and base groups)
  become one shared `components/custom-fields/CustomFieldEditor`, which gains a **Type** selector
  (Text / Dropdown). For Dropdown there is an options list editor: add, rename, remove and reorder.
  Removing an option that cards still use leaves those values in place and shows them as
  "(removed option)".
- **Card modal** (`custom-fields/CustomField/CustomField.jsx`): a dropdown field renders a
  `DropdownValueField` selector with the options plus "Clear", instead of the `ValueField` text input.
- **Card front**: the value is shown as is.

### 5.6 Ticket marker (`#43886`)

Every ticket card shows a small **ticket chip** `#43886`, built from its `Ticket #` value. The chip
is a link to the `Ticket URL` when one is set (new tab, click doesn't open the card) and plain text
otherwise. Only `http(s)` URLs become links, since the field is user-editable and a `javascript:`
URL must never be clickable. It is one shared component, `components/hippo/TicketChip`, and it
appears in these places:

- **Card preview in lists** (`cards/Card/ProjectContent.jsx`, `StoryContent.jsx`, and
  `InlineContent.jsx` for the list/grid views): shown before the card name. Because the chip replaces
  them, the `Ticket #` and `Ticket URL` custom fields are **not** rendered again in the front-of-card
  custom fields, so the full URL is never shown on the card.
- **Card modal**: the `Ticket URL` field renders as the same `#43886` link instead of the raw URL,
  and is still editable via its edit button.
- **Board timeline** (`boards/Board/TimelineView` → `common/TimelineChart/Bar.jsx`): timeline items get
  a `ticketNumber` property, and the bar shows `#43886` before `item.name`, next to the existing
  recurring icon.
- **Team Dashboard timeline** (`common/Home/TeamDashboardView/TeamTimeline.jsx`): this view's data
  comes from `GET /api/dashboard` (`controllers/dashboard/show.js`), not the board store. The server
  therefore adds `ticketNumber` per card, from the `Ticket #` value of the board's `Hippo Ticket`
  group, using one batched query for all returned cards.

## 6. Permissions & security

- Key management: project managers only. The key lives in its own table, no endpoint returns it (§3),
  and it is never logged.
- Lookup and sync: board editors only, i.e. the same users who can add cards and comments. Viewers
  and commenters cannot trigger Hippo calls.
- All Hippo traffic goes server → Hippo. The browser never calls Hippo.

## 7. Error handling summary

| Situation | Behaviour |
|---|---|
| No key configured | Hippo input and sync dialogs hidden |
| Invalid key | Lookup/sync return `HIPPO_KEY_INVALID`; dialog/toast says "Hippo key invalid — ask a project manager" |
| Ticket not found | Inline error in the Add Card dialog |
| Hippo timeout/5xx | "Hippo unavailable, try again"; Planka changes kept |
| Dropdown value not in options | 422 from API; UI prevents it |
| Partial import failure | Card kept; toast lists what was skipped |

## 8. Testing

- **Unit (server)**: `mapTicket` (entity decoding, HTML→Markdown, ordering, deleted entries, missing
  fields); response classification; assignee matching; ticket-value resolution; dropdown option
  validation.
- **Unit (client)**: `parseTicketNumber`, ticket-URL pattern substitution, safe URLs, imported-comment
  formatting, prefill merging, dropdown option cleaning.
- Lint + client build.
- A **manual test checklist** is handed to Shankar to run, covering: key save/test/remove; import by number
  and by URL; member matching; notes preview and selection; field group auto-creation; `#N` link on
  the card front, board timeline and Team Dashboard timeline; comment sync (all three choices); state sync (all three choices); Hippo-down
  behaviour; viewer cannot see the import input.

## 9. Affected areas (for impact analysis during planning)

- Server:
  - models `CustomField`, `Project`, new `ProjectHippoConfig`
  - helpers `cards/copy-custom-fields`, `cards/detach-custom-fields`, `projects/delete-related`
  - controllers `custom-fields/*`, `custom-field-values/create-or-update`
  - new `hippo/*` helpers and controllers
  - `dashboard/show` (adds `ticketNumber`)
  - routes, migration
- Client:
  - `AddCardModal/*`, `sagas/core/services/cards.js` (`createCardWithDetails`)
  - comments saga/component, custom-field editors, `ValueField`, card front content, `ProjectSettingsModal`
  - new `TicketChip`; `TimelineView` item mapping, `TimelineChart/Bar`, `TeamTimeline`
  - models/selectors for custom fields (type/options), project (`isHippoConfigured`)
  - api modules, i18n strings (en)
