# Planka as an Engineering Management Tool — Timeline + Team Dashboard

## The Core Problem

As an engineering manager, you need to answer three questions at a glance without clicking through each board:

1. **What's done?** → Completed cards across all projects/boards
2. **What's ongoing?** → Cards actively being worked on, by whom
3. **What's coming up?** → Upcoming work with due dates, who's assigned

**The board-scoped timeline (Phase 1) alone won't solve this.** You'd still need to open Board A → Timeline → filter by User X, then Board B → Timeline → filter by User X, etc. That's too many clicks.

**What's needed is a new top-level Team Dashboard (Phase 0) that aggregates across all projects/boards**, paired with the per-board timeline for deep-dives.

```
┌────────────────────────────────────────────────────────────────────┐
│  HOME PAGE                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐                │
│  │ Grid     │  │ Grouped  │  │ Team Dashboard   │  ← NEW         │
│  │ Projects │  │ Projects │  │ (EM View)        │                │
│  └──────────┘  └──────────┘  └──────────────────┘                │
└────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
           ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
           │ Status Board │  │ Team Timeline│  │ Workload     │
           │ (3 columns)  │  │ (cross-proj) │  │ Heatmap      │
           │ Done|Active| │  │ swimlanes per│  │ cards/user/  │
           │ Upcoming     │  │ team member  │  │ week         │
           └──────────────┘  └──────────────┘  └──────────────┘
```

---

## How Each Phase Maps to Your Need

| Your Need | Phase 0 (Dashboard) | Phase 1 (Timeline) | Phase 2 (Interactive) |
|-----------|---------------------|--------------------|-----------------------|
| "What's done?" across team | ✅ Done column, completion stats | ✅ Completed cards grayed on timeline | — |
| "What's ongoing?" per person | ✅ In Progress column grouped by user | ✅ User swimlanes on board timeline | — |
| "What's coming up?" | ✅ Upcoming column + due-this-week alerts | ✅ Future cards visible on time axis | — |
| Quick overview without clicking | ✅ **One page, all projects** | ❌ Board-scoped, one at a time | — |
| Who's overloaded? | ✅ Workload heatmap | ✅ See bar density per user lane | — |
| Reschedule work | ❌ Read-only | ❌ Read-only | ✅ Drag to move/resize |
| See dependencies | ❌ | ❌ | ✅ Arrows between cards |
| Share status with stakeholders | ❌ | ❌ | ❌ (Phase 3: export) |

---

## Phase 0 — Team Dashboard (NEW — Implement First)

> [!IMPORTANT]
> This is the **highest-value feature for your use case**. It's the piece that lets you see done/ongoing/upcoming across the entire team in one go.

### Architecture Overview

The Team Dashboard is a new **Home view** (alongside Grid Projects and Grouped Projects). It requires:
1. A **server-side API endpoint** to fetch cards across multiple boards for specific users
2. A **client-side dashboard page** with three sub-views

---

### Server — New API Endpoint

#### [NEW] `server/api/controllers/cards/index-for-user.js`

New endpoint: `GET /api/cards?userId=X&status=done|active|upcoming`

Fetches cards across all boards the current user has access to, optionally filtered by:
- `assignedUserIds[]` — filter by card member(s)
- `status` — computed status: `done` (in closed list or `isClosed`), `active` (in active list, has `startDate` ≤ today or no startDate), `upcoming` (in active list, `startDate` > today or `dueDate` > today + 7d)
- `dueBefore` / `dueAfter` — date range
- `projectIds[]` — limit to specific projects
- `boardIds[]` — limit to specific boards

```
GET /api/cards?assignedUserIds[]=123&assignedUserIds[]=456&status=active&dueBefore=2026-09-30
```

This leverages Planka's existing access control — the query only returns cards on boards the requesting user can see.

#### [NEW] `server/api/helpers/cards/get-cross-board-cards.js`

Helper that queries cards across boards with the above filters. Uses Knex query builder for efficient cross-board querying with JOINs on `card_membership`, `list`, and `board`.

---

### Client — Home View Extension

#### [MODIFY] [`Enums.js`](file:///Users/shankar/Documents/node/planka/client/src/constants/Enums.js)

```diff
 export const HomeViews = {
   GRID_PROJECTS: 'gridProjects',
   GROUPED_PROJECTS: 'groupedProjects',
+  TEAM_DASHBOARD: 'teamDashboard',
 };
```

#### [MODIFY] [`Icons.js`](file:///Users/shankar/Documents/node/planka/client/src/constants/Icons.js)

```diff
 export const HomeViewIcons = {
   [HomeViews.GRID_PROJECTS]: 'th',
   [HomeViews.GROUPED_PROJECTS]: 'th list',
+  [HomeViews.TEAM_DASHBOARD]: 'dashboard',
 };
```

#### [MODIFY] [`Home.jsx`](file:///Users/shankar/Documents/node/planka/client/src/components/common/Home/Home.jsx)

Add the `TEAM_DASHBOARD` case:
```diff
+    case HomeViews.TEAM_DASHBOARD:
+      View = TeamDashboardView;
+      break;
```

#### [MODIFY] [`HomeActions/RightSide.jsx`](file:///Users/shankar/Documents/node/planka/client/src/components/common/HomeActions/RightSide/RightSide.jsx)

Add `TEAM_DASHBOARD` to the view switcher array:
```diff
-          {[HomeViews.GRID_PROJECTS, HomeViews.GROUPED_PROJECTS].map((view) => (
+          {[HomeViews.GRID_PROJECTS, HomeViews.GROUPED_PROJECTS, HomeViews.TEAM_DASHBOARD].map((view) => (
```

---

### Client — Team Dashboard Components (NEW)

#### [NEW] `client/src/components/common/Home/TeamDashboardView/`

```
TeamDashboardView/
├── TeamDashboardView.jsx          # Main container: summary + tabs
├── TeamDashboardView.module.scss
├── SummaryCards.jsx                # At-a-glance metrics row
├── StatusBoard.jsx                # 3-column Kanban: Done | In Progress | Upcoming
├── TeamTimeline.jsx               # Cross-project timeline grouped by user
├── WorkloadHeatmap.jsx            # Cards per user per week grid
├── DashboardFilters.jsx           # User picker, project picker, date range
└── index.js
```

##### SummaryCards.jsx — At-a-Glance Metrics

A row of 4-5 metric cards at the top of the dashboard:

| Metric | Source | Visual |
|--------|--------|--------|
| **Overdue** | Cards with `dueDate < now` and not `isClosed`/`isDueCompleted` | 🔴 Red count badge |
| **Due This Week** | Cards with `dueDate` within next 7 days | 🟡 Orange count badge |
| **In Progress** | Cards in `active` lists with members assigned | 🔵 Blue count badge |
| **Completed (This Week)** | Cards moved to `closed` lists in last 7 days | 🟢 Green count badge |
| **Unassigned** | Cards with no members | ⚪ Gray count badge |

Each card is clickable → filters the status board below to show those specific cards.

##### StatusBoard.jsx — Done / In Progress / Upcoming Columns

Three-column view, similar to a simplified Kanban but **cross-project**:

```
┌─────────────────┬─────────────────┬─────────────────┐
│  ✅ DONE (12)   │  🔄 ACTIVE (8)  │  📋 UPCOMING (15)│
│                 │                 │                 │
│ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │
│ │ Card name   │ │ │ Card name   │ │ │ Card name   │ │
│ │ 🏷 Board    │ │ │ 🏷 Board    │ │ │ 🏷 Board    │ │
│ │ 👤 Shankar  │ │ │ 👤 Alice    │ │ │ 👤 Bob      │ │
│ │ ✓ 3d ago    │ │ │ ⏱ Due tmrw  │ │ │ 📅 Sep 20   │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
│ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐ │
│ │ ...         │ │ │ ...         │ │ │ ...         │ │
│ └─────────────┘ │ └─────────────┘ │ └─────────────┘ │
└─────────────────┴─────────────────┴─────────────────┘
```

**Status computation logic** (computed from Planka's existing data model):

| Status | Rule |
|--------|------|
| **Done** | Card is in a `closed`-type list OR `isClosed === true` |
| **In Progress** | Card is in an `active`-type list AND (`startDate ≤ today` OR has stopwatch running OR `listChangedAt` within last 14 days) |
| **Upcoming** | Card is in an `active`-type list AND (`startDate > today` OR no `startDate` and `dueDate > today + 7d`) |

Each card shows: name, **project → board** breadcrumb (so you know where it lives), assigned users, due date status, task progress bar. Clicking opens the CardModal.

##### TeamTimeline.jsx — Cross-Project User Timeline

This is the **killer feature for EMs** — a timeline with:
- **One swimlane per team member** (not per list/board)
- Cards from **all boards across all projects** the user can see
- Card bars color-coded by **project** (so you can see cross-project distribution)
- Same zoom/today-marker/overdue features as the board-level timeline

Essentially the same TimelineView component from Phase 1, but fed with cross-board data from the new API endpoint instead of a single board's cards.

##### WorkloadHeatmap.jsx — Who's Overloaded?

A grid showing team members (rows) × weeks (columns), with cells colored by card count:

```
              Sep 8   Sep 15  Sep 22  Sep 29  Oct 6
  Shankar     ██████  ████    ██      ████    ██
  Alice       ██      ██████  ██████  ██      ████
  Bob         ████    ██      ████    ██████  ██████
  Carol       ██      ██      ██      ██      ██
```

- Light = 1-2 cards, Medium = 3-4, Dark/Red = 5+ (overloaded)
- Hovering a cell shows the specific card names
- Helps identify uneven distribution and bottlenecks

##### DashboardFilters.jsx — Filter Controls

- **Team members**: Multi-select user picker (defaults to all board members)
- **Projects**: Multi-select project picker (defaults to all)
- **Date range**: "This week" / "This sprint" / "This month" / Custom
- **Include closed**: Toggle to show/hide completed cards

---

### Server — Supporting Changes for Dashboard

#### [NEW] `server/config/routes.js` addition

```js
'GET /api/dashboard/cards': 'cards/index-for-dashboard',
'GET /api/dashboard/stats': 'cards/stats-for-dashboard',
```

#### [NEW] `server/api/controllers/cards/stats-for-dashboard.js`

Returns aggregated counts for the SummaryCards component:
```json
{
  "overdue": 5,
  "dueThisWeek": 12,
  "inProgress": 8,
  "completedThisWeek": 15,
  "unassigned": 3
}
```

Computed via efficient SQL `COUNT` queries with proper access control.

---

## Phase 1 — Board-Level Timeline (After Dashboard)

> Same as previously planned — board-scoped timeline view. See the detailed breakdown below.

### Database Migration

#### [NEW] `server/db/migrations/YYYYMMDD_add_start_date_to_card.js`

```js
module.exports.up = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.timestamp('start_date', { useTz: true });
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.dropColumn('start_date');
  });
```

### Server Changes

#### [MODIFY] [`Card.js`](file:///Users/shankar/Documents/node/planka/server/api/models/Card.js) — Add `startDate` attribute
#### [MODIFY] [`Board.js`](file:///Users/shankar/Documents/node/planka/server/api/models/Board.js) — Add `TIMELINE` to `Views`
#### [MODIFY] [`cards/create.js`](file:///Users/shankar/Documents/node/planka/server/api/controllers/cards/create.js) — Accept `startDate`
#### [MODIFY] [`cards/update.js`](file:///Users/shankar/Documents/node/planka/server/api/controllers/cards/update.js) — Accept `startDate`

### Client Changes — Board Timeline View

#### [MODIFY] [`Enums.js`](file:///Users/shankar/Documents/node/planka/client/src/constants/Enums.js) — Add `TIMELINE` to `BoardViews`
#### [MODIFY] [`Icons.js`](file:///Users/shankar/Documents/node/planka/client/src/constants/Icons.js) — Add timeline icon
#### [MODIFY] [`Board.jsx`](file:///Users/shankar/Documents/node/planka/client/src/components/boards/Board/Board.jsx) — Route to timeline
#### [MODIFY] [`FiniteContent.jsx`](file:///Users/shankar/Documents/node/planka/client/src/components/boards/Board/FiniteContent.jsx) — Add `TIMELINE` case
#### [MODIFY] [`RightSide.jsx`](file:///Users/shankar/Documents/node/planka/client/src/components/boards/BoardActions/RightSide/RightSide.jsx) — Add timeline to switcher
#### [MODIFY] [`Card.js`](file:///Users/shankar/Documents/node/planka/client/src/models/Card.js) (client) — Add `startDate` field

#### [NEW] `client/src/components/boards/Board/TimelineView/` (9 files)

| File | Purpose |
|------|---------|
| `TimelineView.jsx` | Main container with toolbar + date header + swimlanes |
| `TimelineView.module.scss` | CSS Grid layout, scroll, animations |
| `TimelineHeader.jsx` | Dual-row date headers (months + days/weeks) |
| `TimelineSwimlane.jsx` | One row per list/user/label, sticky headers |
| `TimelineCard.jsx` | Card bar with progress fill, overdue indicator, avatars |
| `TimelineCardTooltip.jsx` | Hover preview: name, members, progress, dates |
| `TimelineControls.jsx` | Zoom, group-by, Today button, unscheduled badge |
| `TimelineTodayMarker.jsx` | Vertical red "today" line |
| `constants.js` | Zoom configs, pixel ratios, date math helpers |

**Key features in Phase 1:**
- Swimlanes group by List / User / Label
- Zoom: Day / Week / Month
- Today marker line
- Overdue/due-soon highlighting (reuses [`DueDateChip`](file:///Users/shankar/Documents/node/planka/client/src/components/cards/DueDateChip/DueDateChip.jsx#L57-L73) status logic)
- Task progress bars (from `Task.isCompleted` counts)
- Hover tooltips with card details
- Weekend/holiday column markers
- Sticky swimlane headers
- Unscheduled cards badge
- Inherits existing user/label/search filtering via `selectFilteredCardIdsForCurrentBoard`

#### [NEW] `client/src/components/cards/EditStartDateStep/` — Start date picker in card modal
#### [MODIFY] [`CardModal/ProjectContent.jsx`](file:///Users/shankar/Documents/node/planka/client/src/components/cards/CardModal/ProjectContent.jsx) — Add start date display + sidebar action

---

## Phase 2 — Interactive Timeline

| Feature | Implementation |
|---------|----------------|
| **Drag-to-resize** | Left/right handles on `TimelineCard.jsx`, updates `startDate`/`dueDate` on drop |
| **Drag-to-move** | Bar drag shifts both dates by same delta |
| **Drag-to-create** | Click+drag on empty swimlane → new card with pre-filled dates |
| **Dependency arrows** | New `card_dependency` table + `CardDependency` model + SVG Bézier arrows |
| **Critical path** | Topological sort on dependency graph, highlighted chain |
| **Multi-select** | Ctrl/Cmd+Click cards → bulk move, assign, label |
| **Color coding modes** | By List / Label / Status / Assignee (dropdown in controls) |

---

## Phase 3 — Polish & Advanced

| Feature | Implementation |
|---------|----------------|
| **Mini-map navigator** | Small overview bar with draggable viewport |
| **Export to PNG/PDF** | `html2canvas` renderer for full timeline |
| **Baseline snapshots** | New `timeline_baseline` + `timeline_baseline_entry` tables; ghosted bars for plan-vs-actual |
| **Keyboard navigation** | Extends [`ShortcutsProvider`](file:///Users/shankar/Documents/node/planka/client/src/components/boards/Board/ShortcutsProvider.jsx) pattern |
| **Date range quick nav** | This Week / Month / Quarter / Year buttons |

---

## Complete Feature Inventory

| # | Feature | Phase | EM Value |
|---|---------|-------|----------|
| 1 | **Team Dashboard** (home-level) | P0 | ⭐⭐⭐ See everything in one page |
| 2 | **Status Board** (Done/Active/Upcoming) | P0 | ⭐⭐⭐ Answer the 3 questions instantly |
| 3 | **Summary metric cards** (overdue, this week, etc.) | P0 | ⭐⭐⭐ Instant health check |
| 4 | **Cross-project Team Timeline** | P0 | ⭐⭐⭐ Who's doing what, when |
| 5 | **Workload Heatmap** | P0 | ⭐⭐⭐ Spot overloaded engineers |
| 6 | **Dashboard filters** (users, projects, dates) | P0 | ⭐⭐ Drill down |
| 7 | **Cross-board card API endpoint** | P0 | Backend for #1-6 |
| 8 | Board-level timeline with date axis | P1 | ⭐⭐ Deep-dive into one board |
| 9 | Swimlanes (List / User / Label) | P1 | ⭐⭐ Organize within a board |
| 10 | Zoom (Day / Week / Month) | P1 | ⭐⭐ Right granularity |
| 11 | `startDate` on cards | P1 | ⭐⭐⭐ Duration-based planning |
| 12 | Today marker + auto-scroll | P1 | ⭐⭐ Quick orientation |
| 13 | Overdue/due-soon highlighting | P1 | ⭐⭐⭐ Spot risks |
| 14 | Task progress bars on timeline | P1 | ⭐⭐ Card health at a glance |
| 15 | Hover tooltips | P1 | ⭐ Avoid extra clicks |
| 16 | Weekend markers | P1 | ⭐ Context |
| 17 | Sticky swimlane headers | P1 | ⭐ Usability |
| 18 | Unscheduled cards badge | P1 | ⭐⭐ Nothing falls through cracks |
| 19 | Start date editing in card modal | P1 | ⭐⭐ Set durations |
| 20 | Drag-to-resize/move | P2 | ⭐⭐ Reschedule fast |
| 21 | Drag-to-create | P2 | ⭐ Quick entry |
| 22 | Dependency arrows | P2 | ⭐⭐ See blockers |
| 23 | Critical path | P2 | ⭐⭐ Identify schedule risk |
| 24 | Multi-select bulk ops | P2 | ⭐⭐ Batch management |
| 25 | Color coding options | P2 | ⭐ Visual clarity |
| 26 | Mini-map | P3 | ⭐ Large timeline navigation |
| 27 | Export PNG/PDF | P3 | ⭐⭐ Share with stakeholders |
| 28 | Baseline snapshots | P3 | ⭐⭐ Track scope creep |
| 29 | Keyboard navigation | P3 | ⭐ Power user efficiency |
| 30 | Date range quick nav | P3 | ⭐ Quick jumps |

---

## Summary of All Files Changed

### Phase 0 — Team Dashboard

| Layer | File | Change |
|-------|------|--------|
| **Server** | `controllers/cards/index-for-dashboard.js` | [NEW] Cross-board card query API |
| **Server** | `controllers/cards/stats-for-dashboard.js` | [NEW] Aggregated stats API |
| **Server** | `helpers/cards/get-cross-board-cards.js` | [NEW] Cross-board query helper |
| **Server** | `config/routes.js` | Add dashboard routes |
| **Client** | `constants/Enums.js` | Add `TEAM_DASHBOARD` to `HomeViews` |
| **Client** | `constants/Icons.js` | Add dashboard icon |
| **Client** | `Home/Home.jsx` | Add dashboard case |
| **Client** | `HomeActions/RightSide.jsx` | Add dashboard to view switcher |
| **Client** | `Home/TeamDashboardView/` (8 files) | [NEW] Full dashboard |
| **Client** | `api/` | [NEW] Dashboard API client calls |
| **Client** | Locale files | Add i18n keys |

### Phase 1 — Board Timeline

| Layer | File | Change |
|-------|------|--------|
| **DB** | `migrations/YYYYMMDD_add_start_date.js` | [NEW] `start_date` on card |
| **Server** | `models/Card.js` | Add `startDate` |
| **Server** | `models/Board.js` | Add `TIMELINE` view |
| **Server** | `controllers/cards/create.js`, `update.js` | Accept `startDate` |
| **Client** | `constants/Enums.js`, `Icons.js` | Add `TIMELINE` view + icon |
| **Client** | `models/Card.js` | Add `startDate` field |
| **Client** | `Board.jsx`, `FiniteContent.jsx`, `RightSide.jsx` | Route to timeline |
| **Client** | `TimelineView/` (9 files) | [NEW] Board timeline |
| **Client** | `EditStartDateStep/` | [NEW] Start date editor |
| **Client** | `CardModal/ProjectContent.jsx` | Add start date UI |

### Phase 2 & 3 — (unchanged from previous plan)

---

## Verification Plan

### Phase 0
```bash
# Test dashboard API
curl http://localhost:1337/api/dashboard/cards?assignedUserIds[]=123
curl http://localhost:1337/api/dashboard/stats

# Run tests
cd /Users/shankar/Documents/node/planka/server && npm test
cd /Users/shankar/Documents/node/planka/client && npm test
```

**Manual verification:**
1. Home page shows 3 view options (Grid / Grouped / Dashboard)
2. Dashboard loads all cards across projects in < 2 seconds
3. Status Board shows correct Done / In Progress / Upcoming counts
4. Summary cards show accurate overdue/due-this-week numbers
5. Team Timeline shows one swimlane per team member with cross-project cards
6. Workload Heatmap correctly highlights heavy weeks in red
7. Filtering by user/project/date range updates all sub-views
8. Clicking any card opens the CardModal on the correct board

### Phase 1
1. Timeline view accessible from board view switcher
2. Cards render as bars with correct date positioning
3. Overdue cards highlighted, today marker visible
4. User/label filters work on timeline (inherited from existing filter infra)
5. Start date editable in card modal
