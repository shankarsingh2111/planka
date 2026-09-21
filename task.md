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

## Verification
- [x] Client lint (`npm run lint` scope) and `vite build`
- [x] Client unit tests: timeline utils, critical path, dashboard model (18 passing)
- [ ] Server lint — server `node_modules` not installed locally; syntax-checked with `node --check` only
- [ ] Run DB migrations (`20260912000000_add_start_date_to_card`, `20260921000000_add_card_dependencies`)
- [ ] Manual: dashboard loads cross-project data on a fresh page load
- [ ] Manual: drag / resize on board timeline persists and syncs to other clients
- [ ] Manual: add / remove dependency, cycle is rejected
