# Recurring cards

A card can repeat on chosen weekdays until an end date, for example "Standup, every Monday and
Tuesday, 4–6 PM, until 30 November". Every card of the series is created up front, so the
upcoming ones show on the board, the timeline and the dashboard straight away. Each card is an
ordinary card that can be completed, commented on, moved or deleted on its own. Edits can apply
to one card, to it and the following ones, or to all of them, the way calendar apps handle
recurring events.

Built in September 2026 on the `timeline` branch. The checklist is in `task.md` →
"Recurring Cards".

## How a series works

A series is a row in `card_recurrence`. It holds the rule and the times:

- **Weekdays** (0 = Sunday … 6 = Saturday). "Every day" is all seven.
- **Start and due times**, as wall-clock times (`HH:mm`), plus a **due day offset** for a card
  that ends on a later day (a 10 PM–1 AM card has offset 1). A series without a start time makes
  cards with only a due date.
- **Time zone**: the browser's IANA zone when the series was made. Every later calculation uses
  it, so 4 PM stays 4 PM on both sides of a daylight saving change, whoever edits the series.
- **`starts_on` / `ends_on`**: the first and last day the series may land on, both included.
- **`excluded_dates`**: days whose card was deleted by hand, never to be created again.
- **`list_id`**: the list new cards go to.

Each card of the series points at it with `recurrence_id` and `occurrence_date`. The occurrence
date is the card's **slot**: the day it was created for. It stays put when only that card is
moved, so "this and following" always means the same cards.

## Making a card repeat

From the card modal (**Repeat** under "Add to card") or the Add Card dialog, pick weekdays and an
end date. A live preview shows how many cards will be made. The card needs a due date, since that
is where the times come from.

- **The card itself becomes the first card of the series.** If its own day isn't one of the
  weekdays, it moves to the first day that is.
- **Days already past are skipped.** The series starts on the card's day or today, whichever is
  later.
- **The end date can be at most a year ahead** (366 days) of that first day.
- **What each new card copies:** name, description, members, labels, watchers, task lists with
  tasks reset to not done (a task linked to another card keeps mirroring that card), and
  card-level custom fields and values.
- **What stays with the original card only:** attachments, comments, the stopwatch and the cover.
- **Where new cards go:** the end of the list the card was in when the series was made. If that
  list is gone or isn't an open list, the card's current list if open, else the board's first
  open list. New cards never land in Done, the archive or the trash.

## How a series shows up

Every card of a series exists, but showing them all would swamp a list, so the views keep a
series compact:

- **Board lists** show one card per series: in a working list the first card not done yet (an
  overdue card is the earliest, so it's never buried), in a Done list the latest one. A **↻ +15**
  chip on that card shows the other cards; **Show less** folds them again. The chip turns red
  when a folded card is overdue.
  - Searching the board shows every card that matches, unfolded.
  - Archive and trash lists always show every card.
  - Unfolding lasts until the page is reloaded.
  - Drag-and-drop and card-to-card keyboard navigation work on the cards shown, the same way as
    with the board's member and label filters.
- **Dashboard:** the Upcoming column shows each series' next card, with "N more cards in this
  series" under it to unfold the rest.
- **Timeline:** every card stays on the timeline, since that's where the series is planned.
  - Each series gets a row of its own under the lane's other cards, so it reads as one line and
    never splits across rows or pushes other cards around.
  - The row is named in the lane column: series name, weekdays and card count.
  - Hovering a card highlights its whole series and fades everything else, and the tooltip says
    "Recurring card · 4 of 10".
  - **Collapse repeats** in the toolbar turns each series row into a thin strip with a mark per
    card, for busy boards. The choice is remembered per browser.

## Editing a series

The card modal of a series card shows the rule ("Mon, Tue, until Nov 30 · 3 of 18") and an
**Edits apply to: This card / This and following / All cards** picker. The picker starts at
"This card" every time a card is opened. Planka saves every edit instantly, so the picker sets
the scope once rather than asking on every change. A drag or resize of a series bar on the
board timeline asks the same question in a dialog before anything is saved.

| Scope | Cards changed |
|---|---|
| This card | Only this card: an ordinary edit |
| This and following | This card, and the open cards whose slot is on or after this card's slot |
| All cards | This card, and every open card of the series, past ones included |

**Open** means not done (not in a Done-type list, due date not ticked) and not archived or
trashed. Other cards are history and are never changed by a series edit, except the edited card
itself.

What each kind of edit does to the cards in scope:

- **Name, description:** set on each card. Only the field that changed is written, so a card
  renamed on its own keeps its name when the time changes for all.
- **Time or length** (new times on the same day): each card gets the new times on its own day,
  and the series stores them for cards made later.
- **Another day** (the edited card moved from Monday to Wednesday): every card in scope moves by
  the same number of days, measured from the edited card's slot. The weekdays move too
  (Mon/Tue becomes Wed/Thu), and so do excluded days, so a deleted holiday stays deleted.
- **Members, labels:** added or removed as changes, not replaced. Adding someone to a series adds
  them to each card in scope, without touching the other members of each card.
- **Weekdays** ("This and following" or "All cards" only):
  - open cards on days the new rule skips are deleted;
  - missing days get new cards, copied from the edited card;
  - days before today are left alone.
  - If the edited card is on a skipped day, it moves to the first new day rather than being
    deleted. It is deleted only if the new rule adds no day at all.
- **End date:** a later end creates the missing cards after the old end. An earlier end deletes
  the open cards after the new end. The end can't be earlier than the edited card's slot.
- **Removing the due date** only ever applies to that card, since the series takes its times from
  it.
- **Moving a card to another list, ticking it done, tasks, attachments and comments** always
  apply to that card alone.

## Deleting

Deleting a series card asks which cards to delete:

- **This card** goes to the trash like any card. When it is deleted for good (from the trash, or
  with its list or board), its slot is added to `excluded_dates`, so no later series change brings
  that day back. Moving it to the trash alone doesn't exclude the day, since it can be restored.
- **This and following** deletes this card and the open cards after it, for good. The series now
  ends the day before this card, or is ended entirely if this card was its first day.
- **All cards** deletes every open card of the series for good and ends the series. Cards that
  stay (done, archived, trashed) become ordinary cards.

Deletes made by a series change never add excluded days: a later change may bring the series
back to those days.

## Boards and lists

- **Moving a card to another board** takes it out of its series. A series belongs to one board.
- **Moving a whole list to another board** keeps `recurrence_id` on its cards. Series changes only
  ever touch cards on the series' own board, so those cards are out of reach, and ending the
  series detaches them.
- **Deleting a board** deletes its series.

## Activity and notifications

- **Making a card repeat** logs one entry on the card: *"… made this card repeat: Mon, Tue, until
  Nov 30 (18 cards)"* (type `createCardRecurrence`). The new cards don't log an "added card"
  entry each.
- **A series edit** logs one entry on the edited card: *"… updated 12 cards of this series"*
  (type `updateCardRecurrence`). The count covers every card changed, created or deleted, the
  edited card included. An edit that changes nothing logs nothing.
- **Adding or removing a member** also logs the usual member entry, on the edited card only. That
  entry is what notifies the person added, so they get one notification for the whole series.
- **Neither new entry type notifies anyone.**
- **Deleting cards deletes their activity** (standard Planka behavior). So a "this and following"
  or "all cards" delete leaves no entry, and an edit that deletes the edited card logs nothing.

## API

All four endpoints need board editor rights, except the listing, which needs board access.

| Method and path | Purpose |
|---|---|
| `GET /api/boards/:boardId/card-recurrences` | The board's series |
| `POST /api/cards/:cardId/card-recurrence` | Make the card repeat. Body: `weekdays` (e.g. `[1, 2]`), `endsOn` (`YYYY-MM-DD`), `timezone` (IANA). Returns the series plus the card and the cards created. |
| `PATCH /api/cards/:cardId/card-recurrence` | Edit from this card. Body: `scope` (`following` \| `all`), plus any of `name`, `description`, `startDate`, `dueDate`, `weekdays`, `endsOn`, `addUserId`, `removeUserId`, `addLabelId`, `removeLabelId`. Returns the series and the edited card, unless the edit deleted it. |
| `DELETE /api/cards/:cardId/card-recurrence?scope=following\|all` | Delete this card and the following or all open cards |

Errors specific to series:

| Code | Status | When |
|---|---|---|
| `cardAlreadyRecurring` | 409 | The card is already in a series |
| `cardMustNotBeArchivedOrTrashed` | 422 | Making a card repeat from the archive or trash |
| `dueDateMustBePresent` | 422 | No due date to take the times from |
| `endsOnMustBeWithinOneYear` | 422 | End date more than 366 days ahead |
| `noDatesToRecurOn` | 422 | The weekdays land on no day before the end date |
| `endsOnMustNotBeBeforeCard` | 422 | New end date before the edited card |
| `openListMustBePresent` | 422 | The board has no open list for new cards |
| `cardRecurrenceNotFound` | 404 | Editing or deleting a series from a card that isn't in one |

Invalid weekdays, dates or time zones are rejected with 400. Swagger docs are in the controllers
and in `server/api/models/CardRecurrence.js`.

**Socket events** `cardRecurrenceCreate`, `cardRecurrenceUpdate` and `cardRecurrenceDelete` go to
the board room. Cards made, changed or deleted by a series change go out as the usual
`cardCreate` / `cardUpdate` / `cardDelete` events to everyone, the requester included. Clients
fetch each new card in full, so making a series costs each open client one small request per
new card.

**Webhooks:** `cardRecurrenceCreate`, `cardRecurrenceUpdate` and `cardRecurrenceDelete`. There is
also a `cardCreate` per new card, and `actionCreate` for the two activity entries.

## Data model

Migration `server/db/migrations/20260929000000_add_card_recurrences.js`:

| Table | Column | Type | Notes |
|---|---|---|---|
| `card_recurrence` | `board_id`, `list_id`, `creator_user_id` | bigint | `list_id`: where new cards go, not kept in sync |
| | `weekdays` | jsonb | e.g. `[1, 2]` |
| | `start_time`, `due_time` | text | `HH:mm`; `start_time` nullable |
| | `due_day_offset` | integer | days from a card's slot to its due date |
| | `timezone` | text | IANA name |
| | `starts_on`, `ends_on` | text | `YYYY-MM-DD` |
| | `excluded_dates` | jsonb | `["2026-10-12"]` |
| `card` | `recurrence_id` | bigint | nullable, indexed with `occurrence_date` |
| | `occurrence_date` | text | the card's slot, `YYYY-MM-DD` |

Series dates are text rather than `DATE` on purpose: the pg driver turns a `DATE` into a
server-local midnight, which shifts the day in some time zones. `'YYYY-MM-DD'` strings still sort
and compare correctly.

## Decisions, and where the build differs from the plan

| Plan | Built | Why |
|---|---|---|
| `moment-timezone` for time zones | Node's built-in `Intl` (`server/utils/recurrence.js`) | No new dependency. A time skipped by daylight saving resolves forward (2:30 → 3:30), a repeated one to the first. Tested for New York and Berlin. |
| `frequency` column (daily / weekly) | Weekdays only | "Every day" is all seven weekdays |
| Unique key on (series, date) | Plain index | A day shift can move one card onto another card's date mid-update. Duplicates are prevented by skipping dates that already have a card. |
| Split the series on "this and following" rule changes | One series record | Cards before the edit keep their days, later cards follow the new rule. The result is the same, with less bookkeeping. |
| A "which cards?" popup on every card-modal edit | "Edits apply to" picker in the modal; popup only for timeline drags | Planka saves each edit instantly, so a popup per rename or label click would be noise |
| `/cards/:id/series` endpoints | `/cards/:cardId/card-recurrence` | Naming only |
| — | `list_id`, `due_day_offset` added | New cards shouldn't follow the series into Done; overnight and multi-day cards need an offset |

## Known gaps

- **Dashboard timeline:** dragging a series card on the team timeline changes only that card.
  There is no scope prompt there yet.
- **Series with no end date** aren't supported. It would need a background job that keeps a few
  weeks of cards ahead (planned as an optional Phase 4).
- **"3 of 18"** counts the series cards loaded on the board. Cards in the archive or trash only
  count once that list has been opened.
- **Translations:** only English strings were added; other languages fall back to them.

## Code map

| Area | Files |
|---|---|
| Date math | `server/utils/recurrence.js` (server), `client/src/utils/recurrence.js` (preview in the browser) |
| Model and queries | `server/api/models/CardRecurrence.js`, `server/api/hooks/query-methods/models/CardRecurrence.js`, `recurrenceId` / `occurrenceDate` in `server/api/models/Card.js` |
| Endpoints | `server/api/controllers/card-recurrences/` (`index`, `create`, `update`, `delete`) |
| Series logic | `server/api/helpers/card-recurrences/`: `create-one` (make a series), `update-one` (edits and scopes), `delete-one`, `create-occurrences` (bulk copy), `delete-cards`, `get-target-list` |
| Hooks into existing code | `cards/delete-related.js` (excluded days), `cards/update-one.js` (board move leaves the series), `boards/delete-related.js`, `card-memberships/create-one.js` and `delete-one.js` (`skipAction`, `webhooks` inputs), `Action.Types`, `Webhook.Events` |
| Client state | `client/src/models/CardRecurrence.js`, `selectors/card-recurrences.js`, `actions/` and `entry-actions/card-recurrences.js`, `api/card-recurrences.js`, `sagas/core/services/card-recurrences.js` |
| Folding in lists | `client/src/utils/card-series.js` (which card stands for a series), `models/List.js` (`getFilteredCardsModelArray` folds; `getCardsModelArrayMatchingFilters` doesn't), `unfoldedRecurrenceIds` on `models/Board.js`, `makeSelectCardSeriesFoldByCardId` (the chip), `common/Home/TeamDashboardView/StatusBoard.jsx` (dashboard) |
| Timeline rows | `common/TimelineChart/utils.js` (`packRowsWithSeries`, compact rows in `getRowOffsets`), `TimelineChart.jsx` (series labels, highlight, Collapse repeats), `Bar.jsx`, `Toolbar.jsx` |
| Scope handling | `sagas/core/services/cards.js` (`updateCard`), `users.js` and `labels.js` (current-card member and label sagas), scope in `reducers/core.js` |
| UI | `client/src/components/card-recurrences/` (Repeat popup, chip, scope step, timeline dialog); `cards/CardModal/ProjectContent.jsx`, `cards/AddCardModal/Content.jsx`, `cards/Card/ProjectContent.jsx` (board icon), `boards/Board/TimelineView/TimelineView.jsx`, `common/TimelineChart/Bar.jsx`, `activities/*/Item.jsx` |
| Tests | `server/test/utils/recurrence.test.js`, `client/src/utils/recurrence.test.js`, `client/src/utils/card-series.test.js`, `client/src/components/common/TimelineChart/utils.test.js` |

The unit tests run without a database:

```bash
cd server && npx mocha test/utils/recurrence.test.js
cd client && npx jest src/utils/recurrence.test.js src/utils/card-series.test.js src/components/common/TimelineChart
```

The feature was also checked end to end on 2026-09-30, against a running server and Postgres (70
API checks) and in a browser with Playwright. Those scripts aren't in the repo.

## Gotchas

- **Sails loads helpers before it creates the model globals.** A helper that uses a model
  constant at module level, such as `isIn: Object.values(CardRecurrence.Scopes)` in its inputs,
  stops the server from starting ("CardRecurrence is not defined"). Keep model constants inside
  `fn` and validate enums in the controller. Controllers load later, so they can use them.
- **`card.start_date` is `timestamptz` but `card.due_date` is `timestamp without time zone`**
  (from the earlier start-date migration). The app reads both correctly. Raw SQL and scripts
  reading the table directly need to treat them differently.
- **Arrays in `json` attributes** (`weekdays`, `excluded_dates`) are stored as JSON because
  sails-postgresql stringifies array values of `json` attributes. The pg driver alone would send
  them as Postgres arrays.
- **Excluded days are appended in one SQL statement** (`addExcludedDates`), so several cards
  deleted at once don't overwrite each other's days.
