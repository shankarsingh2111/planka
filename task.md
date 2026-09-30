# Implementation Tasks — Planning & Roadmap (Timeline + Team Dashboard)

Direction: Miro-style **planning and roadmap** tools (not a freeform whiteboard).

## Shared Foundation (DB + Server)
- [x] DB migration: add `start_date` to `card` table
- [x] Server: `startDate` on Card model, create/update controllers, duplicate
- [x] Server: reject `startDate` after `dueDate` (422 `startDateMustBeBeforeDueDate`)
- [x] Server: add `TIMELINE` to Board Views enum

## Phase 0 — Team Dashboard
- [x] Server: `GET /api/dashboard` — cards across all visible boards (closed cards limited to last 30 days), with lists, boards, projects, memberships, dependencies, task progress
- [x] Server: `users/get-visible-boards` helper (same visibility rules as `projects/index`)
- [x] Stats computed client-side from the dashboard payload (no separate stats endpoint)
- [x] Client: dashboard fetches its own data (`use-dashboard-data`), no longer depends on loaded boards
- [x] Summary tiles: Overdue / Due this week / In progress / Completed this week / Unassigned — clickable filters
- [x] Status board: In progress / Upcoming / Done with project › board breadcrumb, members, due date, task progress
- [x] Filters: members, projects, date range, "Only me", show completed, refresh (remembered per browser)
- [x] Team timeline: group by member / project / board, color by project / status / member, drag to reschedule where the user is an editor
- [x] Workload heatmap: members × weeks
- [x] i18n keys (en-US)

## Phase 1 — Board Timeline
- [x] Shared `TimelineChart` component used by board timeline and team timeline
- [x] One continuous scale per zoom (Day / Week / Month / Quarter) — headers, bars, today marker and arrows align
- [x] Row packing inside lanes (no one-card-per-row)
- [x] Group by list / member / label / none; color by status / label / list / member
- [x] Today marker, weekend shading, sticky lane headers and date header
- [x] Hover tooltip (dates, task progress, list, members, labels)
- [x] Task progress fill on bars, overdue outline, unscheduled count
- [x] Start date editing in card modal
- [x] Fix: `startDate` converted to `Date` in API transformers

## Phase 2 — Interactive Timeline
- [x] Drag to move, drag edges to resize (writes `startDate` / `dueDate`)
- [x] Card dependencies: `card_dependency` table, model, `GET /boards/:id/card-dependencies`, `POST /cards/:id/card-dependencies`, `DELETE /card-dependencies/:id`, socket + webhook events, cycle rejection
- [x] Dependency arrows; drag from a bar's dot to another bar to link; hover arrow to delete
- [x] Conflict highlighting (successor starts before predecessor ends)
- [x] Critical path toggle
- [ ] Drag-to-create card on empty timeline space
- [ ] Multi-select bulk operations

## Phase 3 — Roadmap Polish
- [ ] Milestones (diamond markers owned by a board/project, not a card)
- [ ] Export timeline to PNG/PDF
- [ ] Baseline snapshots (plan vs actual)
- [ ] Mini-map navigator, keyboard navigation
- [ ] Cross-board dependencies (currently same-board only)
- [ ] Translations for non-English locales

## Recurring Cards
Every card of a series is created up front (so upcoming ones show on the timeline), linked by
`recurrence_id` + `occurrence_date` (the series slot, in the series' time zone). Series live in
`card_recurrence`: weekdays, start/due wall-clock times + due day offset, IANA time zone,
`starts_on` / `ends_on` (max one year ahead), `excluded_dates`, and the list new cards go to.
Full reference: `docs/RECURRING_CARDS.md`.

### Phase 1 — Server foundation
- [x] Migration `20260929000000_add_card_recurrences`: `card_recurrence` table; `recurrence_id`, `occurrence_date` on `card`
- [x] `utils/recurrence.js`: time-zone-safe date math via `Intl` (DST gaps resolve forward, overlaps to the first), occurrence dates, time patterns
- [x] `POST /cards/:cardId/card-recurrence` — the card becomes the first occurrence, past days skipped; copies members, labels, subscribers, task lists (tasks reset), custom fields; no attachments or comments; no per-card activity
- [x] `DELETE /cards/:cardId/card-recurrence?scope=following|all` — deletes open cards in scope; following ends the series the day before, all ends it and detaches the done cards
- [x] Deleting a series card by hand excludes its day for good (`cards/delete-related`); series-driven deletes don't
- [x] Moving a card to another board takes it out of its series; deleting a board deletes its series
- [x] Socket + webhook events `cardRecurrenceCreate` / `Update` / `Delete`; `GET /boards/:boardId/card-recurrences`

### Phase 2 — Client: making a series
- [x] Repeat popup (weekday toggles, Every day / Weekdays, Until date, live preview) in the Add Card dialog and card modal
- [x] Series chip in the card modal: "Mon, Tue, until Nov 30 · 3 of 18"
- [x] Repeat icon on board cards and timeline bars (board + team timeline)

### Phase 3 — Editing a series
- [x] `PATCH /cards/:cardId/card-recurrence` with `scope` (following / all): name, description, dates (time change, or day shift moving weekdays and excluded days too), members, labels, weekdays, end date (extend / shorten)
- [x] Done / archived / trashed cards are left as they are, except the edited card itself
- [x] Only the changed fields are written, so single-card changes survive other series edits
- [x] New repeat rule: deletes open cards on skipped days, creates missing days as copies of the edited card (which moves rather than disappears)
- [x] Member added to a series: one member entry and one notification (`skipAction` on the other cards)
- [x] Activity: one `createCardRecurrence` entry when a card is made to repeat ("made this card repeat: Mon, Tue, until Nov 30 (18 cards)"), one `updateCardRecurrence` entry per series edit ("updated 12 cards of this series"); shown in the card feed and the board log, no notifications
- [x] Card modal "Edits apply to: This card / This and following / All cards" (resets per card), applied in the sagas for name, description, dates, members, labels
- [x] Delete a series card: this card (to trash) / this and following / all cards
- [x] Timeline drag or resize of a series bar asks which cards change before saving

### Phase 5 — Showing series compactly
- [x] Board lists fold each series to one card (next open one; latest in Done), with a "↻ +N" chip to unfold (red when a folded card is overdue); search and archive/trash show everything
- [x] Dashboard Upcoming column folds each series to its next card, "N more cards in this series" unfolds
- [x] Timeline: one row per series under the lane's other cards, named in the lane column (name, weekdays, count)
- [x] Timeline: hovering a card highlights its series and fades the rest; tooltip "Recurring card · 4 of 10"
- [x] Timeline: "Collapse repeats" toolbar toggle (thin strip with a mark per card), remembered per browser

### Verification
- [x] Server: full `npm run lint`; 22 unit tests for `utils/recurrence.js` (DST in New York and Berlin, the 19-card Mon/Tue example)
- [x] Client: lint on changed files, 10 new unit tests (93 total passing), `vite build`
- [x] Migration up / down / up on a throwaway Postgres
- [x] End-to-end against a running server: 70 API checks (validation, create, scopes, done cards, excluded days, extend/shorten, weekday change, day shift, members/labels, activity entries, board move, delete following/all, board delete)
- [x] Browser (Playwright): Add Card with Repeat, card modal chip + scope picker, rename across all cards, due time for this and following, adding Wednesdays, delete choices, timeline drag prompt, activity entries in the card feed and board log
- [x] Docs: `docs/RECURRING_CARDS.md`
- [ ] Deploy: run the migration on staging / production
- [ ] Team timeline (dashboard) drags edit only the dragged card — no scope prompt there yet
- [ ] Translations for non-English locales

## Verification
- [x] Client lint (`npm run lint` scope) and `vite build`
- [x] Client unit tests: timeline utils, critical path, dashboard model (18 passing)
- [x] Server lint — full `npm run lint` passes (2026-09-29)
- [ ] Run DB migrations (`20260912000000_add_start_date_to_card`, `20260921000000_add_card_dependencies`)
- [ ] Manual: dashboard loads cross-project data on a fresh page load
- [ ] Manual: drag / resize on board timeline persists and syncs to other clients
- [ ] Manual: add / remove dependency, cycle is rejected
