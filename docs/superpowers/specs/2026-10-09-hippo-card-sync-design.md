# Hippo Card Sync — Design

**Date:** 2026-10-09
**Builds on:** `2026-10-08-hippo-ticket-integration-design.md` (ticket import in Add Card, Planka → Hippo note and status sync)

## Goal

1. **Pull into an existing card.** A card made by hand, whose Ticket # field has been filled in, can pull its Hippo ticket in with a **Pull from Hippo** button.
2. **Refresh linked cards.** A card that has been pulled before refreshes itself from Hippo when an editor opens it, at most every 2 minutes. A **Sync** button refreshes it on demand.

Both run through one server-side sync, which the Add Card import also uses from now on.

## Decisions (agreed 2026-10-09)

| Question | Decision |
|---|---|
| Card and Hippo disagree | **Hippo wins for its own fields.** Ticket State, Priority and the imported description block are overwritten. Notes, comments, tags and members are only ever added. Nothing a user added in Planka is removed or changed. |
| How the first pull starts | **A separate Pull button.** Saving Ticket # only saves it. |
| Refresh on open | **Every open by an editor, at most every 2 minutes per card**, counted across all users. The Sync button skips the limit. |
| Manual refresh | **A Sync button** on linked cards (Pull before the first sync). |
| Card title | Not changed by a sync. The ticket title goes into the description block. |
| Who can sync | Board editors only, for both the buttons and refresh on open. |

## What a sync does

The server runs these steps for one card, as the editor who asked:

1. **Find the ticket.** Read the card's Ticket # (board group first, then the card's own copy, as `getTicketValuesByCards` does today). No number → `notATicketCard`.
2. **Respect the limit.** Without `force`, the sync is skipped (no Hippo call) when:
   - the card has never been synced, so the first pull stays a button click;
   - the card was last synced for a different ticket number, so a changed number needs a Pull;
   - or the card was synced less than 2 minutes ago.
   A skipped sync still answers with the card's sync state.
3. **Fetch** the ticket with the project's key (existing `fetchTicket` helper).
4. **Description block.** Add or replace one marked block at the end of the card's description:
   ```
   ### Hippo #43643: <ticket subject>

   <ticket description as Markdown>

   — Imported from Hippo ticket #43643
   ```
   - The block runs from its `### Hippo #<number>:` heading line to its `— Imported from Hippo ticket #<number>` footer line.
   - When a block for this number exists, only it is replaced. Text before and after it stays.
   - When none exists, the block is appended after a blank line. A card with an empty description gets the block alone.
   - Cards imported before this change have the description, then the footer, with no heading. A description that ends with the bare footer for this number is treated as wholly the block and replaced.
   - When the ticket number changed, the old number's block is left alone and a new one is appended.
5. **Hippo fields.** Make sure the board's (or card's) "Hippo Ticket" group has its fields, with the same rules the Add Card import uses today (`HIPPO_FIELD_DEFINITIONS`, moved to the server):
   - missing fields are created;
   - a field of the wrong type (for example a text Priority) becomes the defined type;
   - missing default options and the ticket's values join the options.
   Then:
   - **Ticket State** ← Hippo's `statusText` (Add Card may send its own pick instead, see below).
   - **Priority** ← Hippo's priority.
   - **Tags** ← the card's tags plus Hippo's tags, in that order, without repeats.
   - Ticket # and Ticket URL are not touched.
   Empty Hippo values leave the field as it is.
6. **Members.** Hippo assignees are matched to board members by email (existing `matchAssignees`). Matched users who are not on the card yet are added. No one is removed.
7. **Notes and comments.** Each Hippo note or comment that the card does not have yet becomes a Planka comment:
   - written as the syncing editor, headed `**[Hippo Note] Author**` (the comment's own time is now the Hippo date, so the header no longer repeats it);
   - placed by its Hippo date among the card's comments (see "Comment order");
   - recorded so it is never imported again (see "Remembering what was imported").
8. **Record the sync.** Store the time and ticket number for the card.

Only one sync runs per card at a time in a server process; a second request while one runs is answered as skipped. Each new entry's record is stored before its comment is created, and the unique index refuses a second record, so two servers syncing at once cannot import an entry twice.

Steps 4–7 each save on their own. If one part fails (for example a member who has left the board), the rest still saves, and the response lists what was skipped. Every change goes out over the board's socket channel and webhooks through the existing helpers, so open clients update live.

## Comment order

Planka sorts comments by ID, and an ID is the creation time in milliseconds since 2019-08-30 (`next_id()`), shifted left 23 bits, plus a shard and a sequence. An imported comment is created with an ID built the same way from its Hippo date:

```
id = ((hippoDateMs - 1567191600000) << 23) | (1 << 10) | random(0..1023)
```

- Its `createdAt` is set to the Hippo date too.
- A date that is missing, invalid, in the future, or before the epoch gets a normal ID instead, so it lands as the newest comment.
- An ID that already exists (a unique violation) is retried with a new random sequence, up to 3 times. After that, it falls back to a normal ID.
- Client paging by `beforeId` keeps working, since an older comment just sorts lower.

## Remembering what was imported

New table **`hippo_card_entry`**:

| column | |
|---|---|
| `id` | bigint, `next_id()` |
| `card_id` | bigint, not null |
| `ticket_number` | text, not null |
| `entry_id` | text, not null — Hippo's `_id` for the note or comment |
| `comment_id` | bigint, null — the Planka comment it became |
| `kind` | text — `imported` or `skipped` |
| `created_at` / `updated_at` | timestamps |

Unique on (`card_id`, `ticket_number`, `entry_id`). Rows go when their card is deleted (in `cards/delete-related`, next to comments).

New table **`hippo_card_sync`**: `card_id` (unique), `ticket_number`, `synced_at`, timestamps. Also deleted with the card.

During a sync, a Hippo entry is new when no row has its `entry_id` for this card and ticket number, and none of the following matches it:

- **Pushed notes.** Every note Planka pushes to Hippo reads `<author> (via Planka): <text>` (`buildNoteHtml`). A Hippo note in that form whose text appears in one of the card's comments is that comment coming back. An `imported` row is stored for it, pointing at that comment, and nothing is imported. This also covers notes pushed before this change.
- **Cards imported before this change.** These have no rows. An entry whose Markdown appears in one of the card's comments is already there. An `imported` row is stored for it, pointing at that comment.

Texts are compared with mention markup turned into `@Name`, Markdown backslash escapes removed and whitespace collapsed, since Hippo's HTML comes back through Turndown.

## Endpoint

`POST /api/cards/:cardId/hippo-sync`

| body field | |
|---|---|
| `force` | boolean. `true` for the Pull and Sync buttons and Add Card; `false` for refresh on open. |
| `entryIds` | string[], optional. Add Card only: import just these entries and record the rest as `skipped`. |
| `ticketState` | string, optional. Add Card only: the state picked in the dialog, used instead of Hippo's. |

The response is `{ item }`:

```js
{
  cardId,
  ticketNumber,
  hasSynced,   // whether the card has ever been synced for this ticket number
  syncedAt,    // the last sync, or null
  isSkipped,   // true when this call did not reach Hippo (step 2)
  warnings,    // e.g. ['memberNotAdded'], for parts that did not save
}
```

**Errors:**

- 404 for an unknown card, or one the user cannot see.
- 403 when the user is not an editor.
- 422 for `notATicketCard`, and for the existing Hippo exits as today: `Hippo not configured`, `Hippo key invalid`, `Hippo ticket not found` (404), and Hippo's own refusals.

A Hippo failure is never answered with 401, so the client never logs the user out because of one.

## Client

### Hippo Ticket section (card view)

- **Button.** Next to the heading and chevron, for editors only:
  - **Pull from Hippo** while `hasSynced` is false. It is disabled until Ticket # holds a number.
  - **Sync** (↻) once it is true.
  It sends `force: true`, shows a spinner while running, and cannot be clicked twice.
- **Last sync.** A muted line under the heading: "Synced from Hippo just now" / "Synced 5 min ago". It is hidden until the card's sync state is known.
- **Errors.** A failed button sync shows the error in red in place of the last-sync line, with the existing wording (`getHippoErrorText`).

### Refresh on open

When an editor opens a card that has a Ticket #, the card view sends one `force: false` sync in the background. Its answer sets the button label and the last-sync line.

- It fails silently.
- The 2-minute limit and the never-synced case are both decided by the server, so nothing about them is kept in the browser.

The call goes straight to the API, not through the shared request queue (as `syncCommentToHippo` does). A slow Hippo therefore never holds up other actions.

The sync state (`hasSynced`, `syncedAt`, `isSyncing`, `error`) lives in a hook used by the Hippo Ticket section, which calls the API itself, like the Add Card ticket lookup.

### Add Card

The dialog looks and behaves as today. After the card is created, the import:

- still sets Ticket # and Ticket URL itself;
- calls the sync with `force: true`, the ticked `entryIds`, and the picked `ticketState`, instead of posting comments and setting the other fields one by one.

The server then:

- makes the description block — the dialog prefills the description in the block format, so what the user sees is what the sync writes;
- sets State, Priority and Tags;
- adds members, which the dialog has already put on the card, so this is a no-op;
- adds the ticked notes in date order.

Notes left unticked are recorded as `skipped`, so a later refresh never brings them in. The client keeps `ensureHippoFieldGroup`, since the group and its Ticket # must exist before the server can read the number; the server runs the same field rules again during the sync.

## Not in scope

- Removing anything from a card when Hippo removes it.
- Pushing anything new to Hippo (the existing note and status pushes stay as they are).
- Background syncing of cards nobody opens.
- Changing the card title from Hippo.

## Known limits

- **Cards imported before this change** show **Pull from Hippo** until someone clicks it once, since they have no sync record. After that they refresh on open.
- **Edits inside the description block** are overwritten by the next sync, as Hippo wins there.
- **Old members and comments stay** when Ticket # changes to another ticket. The old ticket's description block also stays, and a block for the new ticket is added.
- **Backdated comment fields:** Planka's `beforeCreate` model hook always stamps `createdAt` with the current time. An imported comment is therefore created with its computed `id`, and then its `created_at` is set to the Hippo date in the same transaction. Whether Waterline passes a supplied `id` through is checked in the manual tests. If it does not, the comment keeps a normal ID and lands as the newest.

## Testing

Light checks, per the project's practice: unit tests for the pure parts, then lint, build and a manual test list. The unit tests cover:

- the description block: append, replace, legacy footer, other ticket number, empty description;
- the comment ID built from a date: ordering, epoch and future clamps;
- which entries are new, given rows, pushed notes, existing comment text and `entryIds`;
- the skip rules: never synced, other number, under 2 minutes, `force`;
- tag and option merging.
