# Timeline View expansion — design

Date: 2026-09-23
Branch: `timeline`
Baseline commit: `a37e604a`

## Goal

Turn the board Timeline from a read-mostly Gantt into a scheduling surface: every list is
visible and droppable, unscheduled work is staged in a sidebar, and dates, lists and
assignments are all manipulable by dragging.

## Requirements

Requested:

1. All lists appear as lanes, with a filter (top right) to hide lists that aren't needed.
2. A left sidebar listing cards that have no start/due dates, hideable via a small button
   placed before the Day / Week zoom buttons.
3. Drag a card from the sidebar onto a lane at a date range → that range becomes its
   start/due dates and the lane's list becomes its list.
4. Drag a bar from one lane to another → the card moves to that list.
5. Members shown on timeline bars as small circles with initials and their assigned colour.

Added during design, approved:

6. Drag a bar back onto the sidebar to clear its dates (unschedule).
7. Search box and list-name grouping inside the sidebar.
8. Persist zoom level, Group by, Color by and sidebar open/closed per user.
9. Collapse an individual lane to a single summary row.

## Constraints discovered

- `TimelineChart` (`client/src/components/common/TimelineChart/`) has **two consumers**:
  the board's `TimelineView` and the dashboard's `TeamTimeline`. All new capability must be
  additive, optional props that default to off, so `TeamTimeline` is unaffected.
- The chart owns a **pointer-based drag system** (`dragRef`, `setPointerCapture`) for
  move / resize / dependency-linking. `react-beautiful-dnd` is present in the app for the
  Kanban view but cannot express "drop at an arbitrary x that encodes a date range". The
  sidebar drag extends the existing pointer model rather than introducing a second paradigm.
- `board.view` is **client-only** state, initialised from `board.defaultView` and reset on
  reload. There is therefore no existing per-user/per-board server preference to extend.
- `TimelineChart.jsx` is ~900 lines and this work would push it past ~1500.
- As of `bcdf5cfe` the scale is generalised into **units** — a two-hour slot at day zoom, a
  whole day at every other zoom level — exposed as `isSlotZoom`, `getUnitWidth`,
  `shiftByUnits`, `diffInUnits`, `getOffsetX`, `SLOTS_PER_DAY`. New drop math builds on
  these primitives rather than introducing its own.

## Design

### 1. Component decomposition

Split only where the new features force the file open anyway:

| New file | Reason |
| --- | --- |
| `Bar.jsx` | member avatars and drop-preview states land here |
| `Toolbar.jsx` | needs a new leading slot for the sidebar toggle |
| `use-bar-drag.js` | existing move/resize logic, extracted so drop logic stays separate |
| `use-drop-target.js` | new: x/y → (lane, start, end), auto-scroll, ghost preview |

`Header`, `Arrows` and `Tooltip` stay inline — untouched by this work. Target size for
`TimelineChart.jsx` afterwards: 450–500 lines.

### 2. Lanes from entities, not from cards

`lanes` is currently derived from cards that have dates, so an empty or fully unscheduled
list has no lane and nothing to drop onto. Lanes are instead derived from the entities:

- List grouping → `selectAvailableListsForCurrentBoard` (non-archive/trash, position order)
- Member grouping → all board memberships
- Label grouping → all board labels

Empty lanes render at `MIN_LANE_HEIGHT` as real drop targets. The empty-state condition
changes from `lanes.length === 0 || bars.length === 0` to `lanes.length === 0`, with a
floating hint when there are no bars — otherwise the first card could never be dropped.

### 3. Lane filter

A `LanesFilterStep` popup (standard `usePopup` step, as `LabelsStep` / `BoardMembershipsStep`)
behind a button in the chart's right toolbar group, beside Group by / Color by. Checklist of
the current grouping's lanes, a count badge when anything is hidden, and "Show all". The
label follows the grouping: Lists / Members / Labels.

Hiding a lane hides its bars only. The sidebar is defined by dates, not lanes, so a card in a
hidden list still appears there.

### 4. Unscheduled sidebar

`TimelineView/UnscheduledSidebar/`. Contents: cards where `!startDate && !dueDate` — exactly
the chart's current `unscheduledCount`. It reads the already-filtered `cardIds`, so board
search / member / label filters apply automatically. Search box, list-name subheadings,
member avatars on each card. 260px wide, collapsible; the toggle lives in a new
`leadingToolbarChildren` slot before the zoom buttons.

### 5. Drag to schedule

Gesture: pointer-down on a sidebar card → move → ghost bar tracks the cursor → release over a
lane commits. Horizontal distance defines the range.

Two new pure functions in `utils.js`, unit-tested in `utils.test.js`:

- `getDateAtOffsetX(viewStart, x, zoomLevel)` — inverse of the existing `getOffsetX`,
  snapping to the zoom's unit
- `getDropRange(anchorX, currentX, viewStart, zoomLevel)` — `{ startDate, dueDate }`,
  normalised so a right-to-left drag still yields `start < due`, with a minimum of one unit
  so a click-drop with no horizontal travel produces a one-slot / one-day block

Resulting dates by zoom level:

| Zoom | Snap unit | Dates |
| --- | --- | --- |
| Day | 2-hour slot | `start = day @ slotHour`, `due = start + 2h` |
| Week / Month / Quarter | 1 day | `start = day @ 09:00`, `due = day @ 21:00` |

`y` → lane is resolved from the existing `layout.lanes` tops and heights.

Auto-scroll: dragging within 60px of either canvas edge scrolls the container, so a date
off-screen is reachable. Without it the feature is unusable on a month-long board.

Commit: the chart calls `onExternalDrop(itemId, { laneKey, startDate, dueDate })`;
`TimelineView` maps `laneKey` → `listId` and dispatches one action.

### 6. Cross-lane move and unschedule

`DragModes.MOVE` gains a vertical component: `handleBarPointerMove` additionally tracks the
lane under the cursor and highlights it; on release the chart calls
`onItemLaneChange(itemId, toLaneKey)` alongside the usual date change. Enabled only when
`groupBy === LIST` and the user is an editor.

The chart's pointer-up already uses `document.elementFromPoint` for dependency linking. It is
extended to recognise `[data-timeline-unschedule-zone]` on the sidebar and call
`onItemUnschedule(itemId)`, clearing both dates. The sidebar highlights while a bar is in
flight.

**One request, not two.** A drop that changes both list and dates must not fire two PATCHes.
`entryActions.moveCard(id, listId, index)` gains an optional fourth `data` argument, merged
into the single `updateCard` call the `moveCard` saga already makes — backward compatible,
reusing the existing position logic. `index` is the end of the target list, since timeline
order is by date rather than list position.

### 7. Member avatars

`items` gain `memberIds`. A `BarAvatars` component inside `Bar.jsx` composes the existing
`UserAvatar`, which already renders initials with a name-hashed colour, so no new colour
logic is introduced. 18px circles, −6px overlap, white ring, right-aligned, maximum of three
then `+N`, hidden when the bar is narrower than 70px, `title` set to the full name. The same
component is reused on sidebar cards.

### 8. Lane collapse

Clicking a lane header collapses that lane's bars into a single row. This is a change to the
existing `packRows` step only.

### 9. Persistence

One migration, five columns on `user_account`:

```
timeline_zoom_level          text    default 'week'
timeline_group_by            text    default 'list'
timeline_color_by            text    default 'status'
timeline_sidebar_opened      boolean default true
timeline_board_preferences   jsonb   default '{}'
    { "<boardId>": { "hiddenLaneKeys": { "list": [...] }, "collapsedLaneKeys": [...] } }
```

Four flat columns for the globals, matching the convention this branch already extended twice
with `showQuarterTimelineZoom`, which buys server-side `isIn:` enum validation on the three
values that drive rendering. One jsonb for the inherently per-board map, pruned of empty
entries client-side before each write so it does not grow without bound. Writes go through
the existing `entryActions.updateCurrentUser`, debounced 500ms.

Rejected alternative: a single opaque `timeline_preferences` jsonb. One column instead of
five, but a bad enum inside a blob breaks the UI silently with nothing to catch it.

## Build order

| Phase | Deliverable |
| --- | --- |
| 1 | Preference columns and migration; chart split (`Bar`, `Toolbar`, `use-bar-drag`) |
| 2 | All lanes always shown, filter popup, lane collapse |
| 3 | Sidebar (search, grouping, toggle) — read-only, no drag |
| 4 | `use-drop-target`, drag-to-schedule, auto-scroll |
| 5 | Cross-lane move, drag-back-to-unschedule |
| 6 | Member avatars on bars and sidebar cards |

Each phase is independently shippable.

## Testing

`getDateAtOffsetX`, `getDropRange`, lane resolution and the preference-pruning helper are
pure functions and get Jest cases in the existing `utils.test.js`. Pointer choreography
(capture, auto-scroll, lane highlight) is verified by hand; a jsdom harness for it would cost
more than it catches.

## Risks

- Five new user columns is the heaviest and least reversible part of the work.
- Vertical drag shares a gesture with horizontal move; the lane-change threshold has to be
  tuned so ordinary rescheduling does not accidentally move a card between lists.
