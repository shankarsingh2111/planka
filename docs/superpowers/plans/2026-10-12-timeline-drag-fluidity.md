# Timeline Drag Fluidity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dragging bars in the board timeline fluid. The dragged card snaps to the row under the pointer, the lane makes room for it so nothing overlaps, and a drag can reorder cards within a list. The order is saved to `card.position`.

**Architecture:** Rows inside a lane are packed **first-fit in `card.position` order** instead of greedy-by-start-date. During a drag, a pure `buildLayout` re-packs the lanes with the card "placed" at the (row, date) cell under the pointer. The placement is resolved by trying every insertion index (`resolveOrderedDrop`). The chart renders that preview layout live: other bars animate aside, a dashed placeholder marks the landing cell (with its dates), and the real bar lifts and follows the pointer. On drop, the placeholder's neighbours (`beforeItemId` / `afterItemId`) go to `scheduleCard`, which turns them into a `position` between those cards in the **full** list.

**Tech Stack:** React 18.2, redux-saga, redux-orm, Jest 30 (babel-jest), SCSS modules. Client only, no server changes.

**Spec:** this conversation's agreed design (summarised in Global Constraints below).

## Global Constraints

- Row model: packed, order-aware. First-fit in ascending `item.order`, overlap tested on whole days (a bar ending on the day another starts **collides**, same as today's `packRows`).
- Items without `order` (TeamTimeline dashboard) keep today's `packRows` behaviour exactly.
- Order is persisted in `card.position`. Reordering in the timeline also reorders the kanban list. This is intended.
- Vertical reordering only in **List** grouping (exactly when `onItemLaneChange` is passed). Member/Label/None groupings sort by order but a drag only changes dates.
- Recurring-series cards are never reordered. They stay on their pinned series rows.
- Collapsed lanes: a drop keeps everything on row 0 and does not reorder.
- While dragging, the original bar lifts out (follows the pointer), its slot closes up, other bars slide (150 ms), and a dashed placeholder shows the landing cell with a date label (`d MMM`, or `d MMM, h a` at day zoom).
- Sidebar (unscheduled) drops use the same row targeting and ordering.
- `prefers-reduced-motion: reduce` disables the slide transitions.
- Bar drags gain **Escape to cancel**.
- Light checks only: `npm run lint`, `npm test`, `npm run build` in `client/`. No servers, DBs, e2e or browser runs. Finish with a manual test list for the user.
- Before editing any existing function, run `gitnexus_impact({target: "<name>", direction: "upstream"})` and report the blast radius. Run `gitnexus_detect_changes()` before each commit.

## Review Focus

1. **Pointer capture lost mid-drag.** `useBarDrag` captures the pointer on the bar element. If that DOM node unmounts or is moved among its siblings, pointermove/up stop arriving and the drag freezes. Expected: drag survives every row/lane change. Pinned by Task 6 rendering bars in the *committed* order and keeping the lifted bar's key.
2. **A plain sideways date drag must not reorder.** Expected: same lane, same row → `isReordered === false`, so only dates change. Test in Task 1 (`resolveOrderedDrop` prefers the original index) and Task 2 (`isReordered`).
3. **Hidden cards between lane neighbours** (unscheduled cards, board filters). Expected: the card lands right before its lane neighbour in the full list, not at a filtered index. Test in Task 3 (`getPositionBetween` with interleaved hidden cards).
4. **Pointer below all rows of a lane.** Expected: the card goes last in the lane's order. Test in Task 2.
5. **Lane-boundary mismatch.** Hit-testing uses the frozen base layout (without the dragged card). Lanes below a lane that grew in the preview are drawn lower than they are hit-tested, so the switch to the next lane comes up to one row early. Accepted trade-off for flicker-free targeting. Called out in the manual test list (Task 8).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `client/src/components/common/TimelineChart/utils.js` | Pure packing (`packInSequence`, `sortByOrder`, `packRowsByOrder`), `resolveOrderedDrop`, `getRowAtY`, `formatDragRange`; `packRowsWithSeries` gains an injectable packer |
| `client/src/components/common/TimelineChart/layout.js` (new) | `buildLayout`: lanes → rows, with optional placement/exclusion. `getSeriesRows` moves here from the chart |
| `client/src/components/common/TimelineChart/layout.test.js` (new) | Tests for `buildLayout` |
| `client/src/components/common/TimelineChart/use-bar-drag.js` | Row targeting, lift-follow frames, Escape, `getDropAction` |
| `client/src/components/common/TimelineChart/use-drop-target.js` | Sidebar drops report `targetRow` |
| `client/src/components/common/TimelineChart/TimelineChart.jsx` | Wires base/preview layouts, lifted bar, placeholders, date label |
| `client/src/components/common/TimelineChart/Bar.jsx` | `isLifted` + `liftRef` |
| `client/src/components/common/TimelineChart/TimelineChart.module.scss` | Lift/placeholder/slide styles; drop old `ghostBar*` / `dropPreview*` |
| `client/src/selectors/positioning.js` | `getPositionBetween` + `selectCardPositionBetween` |
| `client/src/selectors/positioning.test.js` (new) | Tests for `getPositionBetween` |
| `client/src/sagas/core/services/cards.js` | `scheduleCard` accepts `beforeCardId` / `afterCardId` |
| `client/src/components/boards/Board/TimelineView/TimelineView.jsx` | Passes `order`; forwards placement to `scheduleCard`; undo restores position |

All test/lint commands run from `client/`.

---

### Task 1: Order-aware packing and drop resolution (pure utils)

**Files:**
- Modify: `client/src/components/common/TimelineChart/utils.js` (after `packRows`, ~line 272; `packRowsWithSeries` ~279)
- Test: `client/src/components/common/TimelineChart/utils.test.js`

**Interfaces:**
- Produces:
  - `packInSequence(entries) → entries with rowIndex` (first-fit in the given order)
  - `sortByOrder(entries) → entries` (by `item.order`, then `range.start`)
  - `packRowsByOrder(entries) → entries with rowIndex`
  - `isOrdered(entries) → boolean` (every `item.order !== undefined`, and non-empty)
  - `packRowsWithSeries(entries, packOthers?)`. `packOthers(nonSeriesEntries)` defaults to `packRowsByOrder` when `isOrdered`, otherwise `packRows`
  - `resolveOrderedDrop(entries, draggedEntry, targetRow, preferredIndex) → { index, rowIndex, packed, beforeItemId, afterItemId }`. `entries` must already be in order. `beforeItemId`/`afterItemId` are `null` at the ends.
  - `getRowAtY(rowTops, rowsHeight, y) → number` (`rowTops.length` when `y >= rowsHeight`)
  - `formatDragRange(range, zoomLevel, formatDate) → string`

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "packRowsWithSeries", direction: "upstream"})`. Expect callers: `TimelineChart` only. Report.

- [ ] **Step 2: Write the failing tests**

Add the new names to the import list at the top of `utils.test.js`: `packInSequence, packRowsByOrder, resolveOrderedDrop, getRowAtY, formatDragRange`. Then append:

```js
const entry = (id, order, start, end) => ({
  item: { id, order },
  range: { start: day(start), end: day(end) },
});

const rowsById = (packed) =>
  packed.reduce((result, { item, rowIndex }) => ({ ...result, [item.id]: rowIndex }), {});

describe('packRowsByOrder', () => {
  test('gives the first card in order the top row even when it starts later', () => {
    const packed = packRowsByOrder([
      entry('a', 2, '2026-09-01', '2026-09-03'),
      entry('b', 1, '2026-09-02', '2026-09-04'),
    ]);

    expect(rowsById(packed)).toEqual({ b: 0, a: 1 });
  });

  test('lets cards that do not overlap share a row', () => {
    const packed = packRowsByOrder([
      entry('a', 1, '2026-09-01', '2026-09-02'),
      entry('b', 2, '2026-09-05', '2026-09-06'),
    ]);

    expect(rowsById(packed)).toEqual({ a: 0, b: 0 });
  });

  test('treats a card starting on the day another ends as overlapping', () => {
    const packed = packRowsByOrder([
      entry('a', 1, '2026-09-01', '2026-09-03'),
      entry('b', 2, '2026-09-03', '2026-09-04'),
    ]);

    expect(rowsById(packed)).toEqual({ a: 0, b: 1 });
  });

  test('fills a gap in an upper row out of start-date order', () => {
    const packed = packRowsByOrder([
      entry('a', 1, '2026-09-01', '2026-09-02'),
      entry('b', 2, '2026-09-01', '2026-09-10'),
      entry('c', 3, '2026-09-05', '2026-09-06'),
    ]);

    expect(rowsById(packed)).toEqual({ a: 0, b: 1, c: 0 });
  });
});

describe('packInSequence', () => {
  test('keeps the order it is given', () => {
    const packed = packInSequence([
      entry('b', 9, '2026-09-01', '2026-09-03'),
      entry('a', 1, '2026-09-01', '2026-09-03'),
    ]);

    expect(packed.map(({ item }) => item.id)).toEqual(['b', 'a']);
    expect(rowsById(packed)).toEqual({ b: 0, a: 1 });
  });
});

describe('resolveOrderedDrop', () => {
  // Four cards over the same days, so each needs a row of its own
  const lane = [
    entry('a', 1, '2026-09-01', '2026-09-05'),
    entry('c', 3, '2026-09-01', '2026-09-05'),
    entry('d', 4, '2026-09-01', '2026-09-05'),
  ];
  const dragged = entry('b', 2, '2026-09-01', '2026-09-05');

  test('moves a card to the top and pushes the rest down', () => {
    const result = resolveOrderedDrop(lane, dragged, 0, 1);

    expect(result.index).toBe(0);
    expect(result.beforeItemId).toBe('a');
    expect(result.afterItemId).toBeNull();
    expect(rowsById(result.packed)).toEqual({ b: 0, a: 1, c: 2, d: 3 });
  });

  test('keeps the original index when the card stays on its own row', () => {
    const result = resolveOrderedDrop(lane, dragged, 1, 1);

    expect(result.index).toBe(1);
    expect(result.beforeItemId).toBe('c');
    expect(result.afterItemId).toBe('a');
  });

  test('keeps the original index for a card that fits beside others on the target row', () => {
    const sparse = [
      entry('a', 1, '2026-09-01', '2026-09-02'),
      entry('c', 3, '2026-09-10', '2026-09-11'),
    ];

    const result = resolveOrderedDrop(sparse, entry('b', 2, '2026-09-05', '2026-09-06'), 0, 1);

    expect(result.index).toBe(1);
    expect(result.rowIndex).toBe(0);
  });

  test('goes as deep as it can when the target row is out of reach', () => {
    const result = resolveOrderedDrop(lane, dragged, 9, lane.length);

    expect(result.index).toBe(3);
    expect(result.beforeItemId).toBeNull();
    expect(result.afterItemId).toBe('d');
    expect(result.rowIndex).toBe(3);
  });

  test('handles an empty lane', () => {
    const result = resolveOrderedDrop([], dragged, 0, 0);

    expect(result).toMatchObject({ index: 0, rowIndex: 0, beforeItemId: null, afterItemId: null });
  });
});

describe('getRowAtY', () => {
  const rowTops = [0, 36, 80];
  const rowsHeight = 116;

  test('finds the row a y offset falls in', () => {
    expect(getRowAtY(rowTops, rowsHeight, 10)).toBe(0);
    expect(getRowAtY(rowTops, rowsHeight, 36)).toBe(1);
    expect(getRowAtY(rowTops, rowsHeight, 100)).toBe(2);
  });

  test('reads above the first row as the first row', () => {
    expect(getRowAtY(rowTops, rowsHeight, -5)).toBe(0);
  });

  test('reads below the last row as a new row', () => {
    expect(getRowAtY(rowTops, rowsHeight, 116)).toBe(3);
    expect(getRowAtY([], 0, 10)).toBe(0);
  });
});

describe('formatDragRange', () => {
  const formatDate = (date, pattern) => `${pattern}@${date.getDate()}`;

  test('joins start and end', () => {
    const range = { start: day('2026-09-04'), end: day('2026-09-09') };

    expect(formatDragRange(range, ZoomLevels.WEEK, formatDate)).toBe('d MMM@4 → d MMM@9');
  });

  test('shows a single date when both ends read the same', () => {
    const range = { start: day('2026-09-04'), end: day('2026-09-04') };

    expect(formatDragRange(range, ZoomLevels.MONTH, formatDate)).toBe('d MMM@4');
  });

  test('includes the time at day zoom', () => {
    const range = { start: day('2026-09-04'), end: day('2026-09-05') };

    expect(formatDragRange(range, ZoomLevels.DAY, formatDate)).toBe('d MMM, h a@4 → d MMM, h a@5');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/components/common/TimelineChart/utils.test.js`
Expected: FAIL, `packInSequence is not a function` (and the like).

- [ ] **Step 4: Implement**

In `utils.js`, directly after `packRows`:

```js
// Whole-day overlap, matching packRows: a bar ending on the day another starts still collides
const overlapsAny = (intervals, start, end) =>
  intervals.some((interval) => !(interval.end < start || interval.start > end));

// First fit in the order given: each entry takes the topmost row it does not collide with, so
// whatever comes first in the sequence gets first claim on the upper rows
export const packInSequence = (entries) => {
  const rows = [];

  return entries.map((entry) => {
    const start = startOfDay(entry.range.start);
    const end = startOfDay(entry.range.end);

    let rowIndex = rows.findIndex((intervals) => !overlapsAny(intervals, start, end));

    if (rowIndex === -1) {
      rowIndex = rows.length;
      rows.push([]);
    }

    rows[rowIndex].push({ start, end });

    return {
      ...entry,
      rowIndex,
    };
  });
};

export const sortByOrder = (entries) =>
  entries.slice().sort((a, b) => a.item.order - b.item.order || a.range.start - b.range.start);

export const isOrdered = (entries) =>
  entries.length > 0 && entries.every(({ item }) => item.order !== undefined);

/**
 * Packing for lanes whose cards have an order of their own (a list's card positions): the order
 * decides who gets the upper rows, so moving a card up the order moves it up the lane. Less
 * compact than packRows, which is the price of the order meaning something.
 */
export const packRowsByOrder = (entries) => packInSequence(sortByOrder(entries));

/**
 * Where a card held over row `targetRow` of a lane lands in the lane's order. `entries` are the
 * lane's other cards, already in order. Every insertion index is tried and the lane re-packed; the
 * one putting the card on the target row (or as near as the packing allows) wins, and among equals
 * the one nearest `preferredIndex`, so a plain sideways drag never quietly reorders anything.
 */
export const resolveOrderedDrop = (entries, draggedEntry, targetRow, preferredIndex) => {
  let best = null;

  for (let index = 0; index <= entries.length; index += 1) {
    const packed = packInSequence([
      ...entries.slice(0, index),
      draggedEntry,
      ...entries.slice(index),
    ]);

    const { rowIndex } = packed[index];
    const rowDistance = Math.abs(rowIndex - targetRow);
    const indexDistance = Math.abs(index - preferredIndex);

    if (
      !best ||
      rowDistance < best.rowDistance ||
      (rowDistance === best.rowDistance && indexDistance < best.indexDistance)
    ) {
      best = { index, rowIndex, packed, rowDistance, indexDistance };
    }
  }

  return {
    index: best.index,
    rowIndex: best.rowIndex,
    packed: best.packed,
    beforeItemId: best.index < entries.length ? entries[best.index].item.id : null,
    afterItemId: best.index > 0 ? entries[best.index - 1].item.id : null,
  };
};
```

Change the `packRowsWithSeries` signature and first line (keep the rest of the body unchanged):

```js
const packOthersByDefault = (entries) =>
  isOrdered(entries) ? packRowsByOrder(entries) : packRows(entries);

export const packRowsWithSeries = (entries, packOthers = packOthersByDefault) => {
  const packed = packOthers(entries.filter(({ item }) => !item.seriesId));
```

Update the doc comment above `packRowsWithSeries` to say that the other cards are packed by `packOthers`, which defaults to order-aware packing when every card has an order.

After `getRowOffsets`, add:

```js
// The row of a lane a y offset (from the top of the lane's rows) falls in. Below the last row
// reads as one past it, which is where a card dropped into empty space goes.
export const getRowAtY = (rowTops, rowsHeight, y) => {
  if (y >= rowsHeight) {
    return rowTops.length;
  }

  let rowIndex = 0;

  rowTops.forEach((top, index) => {
    if (y >= top) {
      rowIndex = index;
    }
  });

  return rowIndex;
};

// The label riding on a card in flight: where it would land, to the slot at day zoom
export const formatDragRange = (range, zoomLevel, formatDate) => {
  const pattern = isSlotZoom(zoomLevel) ? 'd MMM, h a' : 'd MMM';

  const start = formatDate(range.start, pattern);
  const end = formatDate(range.end, pattern);

  return start === end ? start : `${start} → ${end}`;
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/components/common/TimelineChart/utils.test.js`
Expected: PASS, including the existing `packRows` / `packRowsWithSeries` tests. Those entries have no `order`, so they still use `packRows`.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/common/TimelineChart/utils.js client/src/components/common/TimelineChart/utils.test.js
git commit -m "timeline: order-aware row packing and drop resolution"
```

---

### Task 2: Extract `buildLayout` with placement support

**Files:**
- Create: `client/src/components/common/TimelineChart/layout.js`
- Create: `client/src/components/common/TimelineChart/layout.test.js`
- Modify: `client/src/components/common/TimelineChart/TimelineChart.jsx` (delete `getSeriesRows` lines 61–105; replace the `layout` memo lines 209–264)

**Interfaces:**
- Consumes (Task 1): `packRowsWithSeries(entries, packOthers)`, `packRowsByOrder`, `sortByOrder`, `resolveOrderedDrop`.
- Produces:
  - `buildLayout({ lanes, items, rangeById, collapsedLaneKeys, isRepeatsCollapsed, placement = null, excludeItemId = null }) → { lanes: LaneLayout[], totalHeight, placementResult }`
  - `placement = { item, range, laneKey, targetRow }`. `targetRow` is a number for an ordered drop into `laneKey`, or `null` for a dates-only placement into every lane in `item.laneKeys`.
  - `LaneLayout = { lane, top, height, entries, isCollapsed, seriesRows, rowTops, rowsHeight }`. Entries for the placed card carry `isPlaceholder: true`.
  - `placementResult = { beforeItemId, afterItemId, isReordered } | null` (non-null only for an ordered drop).

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "TimelineChart", direction: "upstream"})`. Expect TimelineView and TeamTimeline. Report.

- [ ] **Step 2: Write the failing tests**

`layout.test.js`:

```js
import buildLayout from './layout';
import { ROW_HEIGHT, LANE_PADDING, MIN_LANE_HEIGHT, getItemRange } from './utils';

const day = (dateString) => new Date(`${dateString}T10:00:00`);

const card = (id, order, start, end, laneKeys = ['l1']) => ({
  id,
  name: id,
  order,
  laneKeys,
  startDate: day(start),
  dueDate: day(end),
});

const build = (items, extra = {}) =>
  buildLayout({
    lanes: [{ key: 'l1', label: 'L1' }, { key: 'l2', label: 'L2' }],
    items,
    rangeById: items.reduce((result, item) => ({ ...result, [item.id]: getItemRange(item) }), {}),
    collapsedLaneKeys: [],
    isRepeatsCollapsed: false,
    ...extra,
  });

const rowsOf = (laneLayout) =>
  laneLayout.entries.reduce(
    (result, { item, rowIndex, isPlaceholder }) => ({
      ...result,
      [item.id]: isPlaceholder ? `${rowIndex}*` : rowIndex,
    }),
    {},
  );

// Four cards over the same days in lane l1
const stacked = [
  card('a', 1, '2026-09-01', '2026-09-05'),
  card('b', 2, '2026-09-01', '2026-09-05'),
  card('c', 3, '2026-09-01', '2026-09-05'),
  card('d', 4, '2026-09-01', '2026-09-05'),
];

describe('buildLayout', () => {
  test('packs lanes by order and stacks them', () => {
    const layout = build(stacked);

    expect(rowsOf(layout.lanes[0])).toEqual({ a: 0, b: 1, c: 2, d: 3 });
    expect(layout.lanes[0].height).toBe(4 * ROW_HEIGHT + LANE_PADDING * 2);
    expect(layout.lanes[1].top).toBe(layout.lanes[0].height);
    expect(layout.lanes[1].height).toBe(MIN_LANE_HEIGHT);
    expect(layout.placementResult).toBeNull();
  });

  test('drops an excluded card from every lane', () => {
    const layout = build(stacked, { excludeItemId: 'b' });

    expect(rowsOf(layout.lanes[0])).toEqual({ a: 0, c: 1, d: 2 });
  });

  test('moves a card to the top of its lane and displaces the rest', () => {
    const b = stacked[1];
    const layout = build(stacked, {
      placement: { item: b, range: getItemRange(b), laneKey: 'l1', targetRow: 0 },
    });

    expect(rowsOf(layout.lanes[0])).toEqual({ b: '0*', a: 1, c: 2, d: 3 });
    expect(layout.placementResult).toEqual({
      beforeItemId: 'a',
      afterItemId: null,
      isReordered: true,
    });
  });

  test('does not reorder when the card stays on its own row', () => {
    const b = stacked[1];
    const layout = build(stacked, {
      placement: { item: b, range: getItemRange(b), laneKey: 'l1', targetRow: 1 },
    });

    expect(layout.placementResult.isReordered).toBe(false);
  });

  test('puts a card dropped below every row last', () => {
    const a = stacked[0];
    const layout = build(stacked, {
      placement: { item: a, range: getItemRange(a), laneKey: 'l1', targetRow: 7 },
    });

    expect(layout.placementResult).toEqual({
      beforeItemId: null,
      afterItemId: 'd',
      isReordered: true,
    });
  });

  test('counts a move into another lane as a reorder', () => {
    const a = stacked[0];
    const layout = build(stacked, {
      placement: { item: a, range: getItemRange(a), laneKey: 'l2', targetRow: 0 },
    });

    expect(rowsOf(layout.lanes[0])).toEqual({ b: 0, c: 1, d: 2 });
    expect(rowsOf(layout.lanes[1])).toEqual({ a: '0*' });
    expect(layout.placementResult.isReordered).toBe(true);
  });

  test('keeps a dates-only placement in its own lanes at its own order', () => {
    const a = card('a', 1, '2026-09-01', '2026-09-02', ['l1', 'l2']);
    const items = [a, card('b', 2, '2026-09-01', '2026-09-02')];

    const layout = build(items, {
      placement: {
        item: a,
        range: getItemRange({ startDate: day('2026-09-10'), dueDate: day('2026-09-11') }),
        laneKey: 'l1',
        targetRow: null,
      },
    });

    expect(rowsOf(layout.lanes[0])).toEqual({ a: '0*', b: 0 });
    expect(rowsOf(layout.lanes[1])).toEqual({ a: '0*' });
    expect(layout.placementResult).toBeNull();
  });

  test('squashes a placement into a collapsed lane onto its one row', () => {
    const a = stacked[0];
    const layout = build(stacked, {
      collapsedLaneKeys: ['l2'],
      placement: { item: a, range: getItemRange(a), laneKey: 'l2', targetRow: 3 },
    });

    expect(rowsOf(layout.lanes[1])).toEqual({ a: '0*' });
    expect(layout.placementResult).toBeNull();
  });

  test('never reorders a recurring card', () => {
    const series = { ...card('s', 5, '2026-09-01', '2026-09-01'), seriesId: 'r1' };
    const layout = build([...stacked, series], {
      placement: { item: series, range: getItemRange(series), laneKey: 'l1', targetRow: 0 },
    });

    expect(layout.placementResult).toBeNull();
    expect(rowsOf(layout.lanes[0]).s).toBe('4*');
  });

  test('exposes row offsets for hit testing', () => {
    const layout = build(stacked);

    expect(layout.lanes[0].rowTops).toEqual([0, ROW_HEIGHT, 2 * ROW_HEIGHT, 3 * ROW_HEIGHT]);
    expect(layout.lanes[0].rowsHeight).toBe(4 * ROW_HEIGHT);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/components/common/TimelineChart/layout.test.js`
Expected: FAIL, `Cannot find module './layout'`.

- [ ] **Step 4: Implement `layout.js`**

Move `getSeriesRows` from `TimelineChart.jsx` (lines 61–105, with its comment) into this file unchanged, then:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import {
  LANE_PADDING,
  MIN_LANE_HEIGHT,
  getRowOffsets,
  packRowsByOrder,
  packRowsWithSeries,
  resolveOrderedDrop,
  sortByOrder,
} from './utils';

// ...getSeriesRows moved here verbatim...

const getRowCount = (packed) => packed.reduce((max, { rowIndex }) => Math.max(max, rowIndex + 1), 0);

/**
 * Lanes laid out as rows of bars, top to bottom.
 *
 * `placement` is a card in flight, `{ item, range, laneKey, targetRow }`. It is taken out of every
 * lane and put back as a placeholder entry: with a numeric `targetRow`, into `laneKey` at the
 * place in the order that lands it on that row (`placementResult` then names its new neighbours);
 * with `targetRow: null`, into each lane it already belongs to, at its own order, with the new
 * range — a drag that only changes dates. `excludeItemId` takes a card out without putting it back.
 */
const buildLayout = ({
  lanes,
  items,
  rangeById,
  collapsedLaneKeys,
  isRepeatsCollapsed,
  placement = null,
  excludeItemId = null,
}) => {
  const removedItemId = placement ? placement.item.id : excludeItemId;
  let placementResult = null;
  let top = 0;

  const laneLayouts = lanes.map((lane) => {
    const isCollapsed = collapsedLaneKeys.includes(lane.key);

    const laneEntries = items
      .filter(
        (item) => item.id !== removedItemId && rangeById[item.id] && item.laneKeys.includes(lane.key),
      )
      .map((item) => ({
        item,
        range: rangeById[item.id],
      }));

    const isPlacedHere =
      !!placement &&
      (placement.targetRow === null
        ? placement.item.laneKeys.includes(lane.key)
        : placement.laneKey === lane.key);

    let packed;

    if (!isPlacedHere) {
      packed = packRowsWithSeries(laneEntries);
    } else {
      const placedEntry = {
        item: placement.item,
        range: placement.range,
        isPlaceholder: true,
      };

      const isOrderedDrop =
        placement.targetRow !== null && !isCollapsed && !placement.item.seriesId;

      if (isOrderedDrop) {
        const others = sortByOrder(laneEntries.filter(({ item }) => !item.seriesId));

        const isOwnLane = placement.item.laneKeys.includes(lane.key);

        const originalIndex = isOwnLane
          ? others.filter(({ item }) => item.order < placement.item.order).length
          : others.length;

        // Held below every row the lane already has: it goes last, whatever it fits beside
        const preferredIndex =
          placement.targetRow >= getRowCount(packRowsByOrder(others))
            ? others.length
            : originalIndex;

        const resolved = resolveOrderedDrop(
          others,
          placedEntry,
          placement.targetRow,
          preferredIndex,
        );

        placementResult = {
          beforeItemId: resolved.beforeItemId,
          afterItemId: resolved.afterItemId,
          isReordered: !isOwnLane || resolved.index !== originalIndex,
        };

        packed = packRowsWithSeries([...laneEntries, placedEntry], () => resolved.packed);
      } else {
        packed = packRowsWithSeries([...laneEntries, placedEntry]);
      }
    }

    // A collapsed lane keeps every bar but squashes them onto one row, so it stays a
    // drop target and still shows where its work sits on the scale
    const rowEntries = isCollapsed
      ? packed.map((entry) => ({ ...entry, rowIndex: 0 }))
      : packed.map((entry) =>
          isRepeatsCollapsed && entry.item.seriesId
            ? {
                ...entry,
                isCompact: true,
              }
            : entry,
        );

    const { rowTops, totalHeight: rowsHeight } = getRowOffsets(rowEntries);

    const entries = rowEntries.map((entry) => ({
      ...entry,
      rowTop: rowTops[entry.rowIndex],
    }));

    const height = Math.max(MIN_LANE_HEIGHT, rowsHeight + LANE_PADDING * 2);

    const laneLayout = {
      lane,
      top,
      height,
      entries,
      isCollapsed,
      rowTops,
      rowsHeight,
      seriesRows: isCollapsed ? [] : getSeriesRows(entries, rowTops, rowsHeight),
    };

    top += height;
    return laneLayout;
  });

  return {
    lanes: laneLayouts,
    totalHeight: top,
    placementResult,
  };
};

export default buildLayout;
```

Note: the placement entries' `packRowsWithSeries` call goes through the default packer when `item.order` is present on every entry. An external card gets `order: Number.MAX_SAFE_INTEGER` in Task 7 so it doesn't knock its lane back to `packRows`.

- [ ] **Step 5: Use it in the chart (no behaviour change yet)**

In `TimelineChart.jsx`: delete `getSeriesRows`, add `import buildLayout from './layout';`, drop `packRowsWithSeries`, `getRowOffsets` and `MIN_LANE_HEIGHT` from the utils import if they are now unused (lint will say), and replace the `layout` memo (lines 209–264) with:

```js
    const layoutInput = useMemo(
      () => ({ lanes, items, rangeById, collapsedLaneKeys, isRepeatsCollapsed }),
      [lanes, items, rangeById, collapsedLaneKeys, isRepeatsCollapsed],
    );

    // The lanes as committed, without anything in flight
    const committedLayout = useMemo(() => buildLayout(layoutInput), [layoutInput]);

    const layout = committedLayout;
```

`layout` is re-pointed to the preview in Task 6. Leave every other use of `layout` as it is for now.

- [ ] **Step 6: Run tests and lint**

Run: `npx jest src/components/common/TimelineChart && npm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/common/TimelineChart/layout.js client/src/components/common/TimelineChart/layout.test.js client/src/components/common/TimelineChart/TimelineChart.jsx
git commit -m "timeline: extract lane layout with in-flight placement"
```

---

### Task 3: Position between neighbours in `scheduleCard`

**Files:**
- Modify: `client/src/selectors/positioning.js` (after `nextPosition`, line 33; after `selectNextCardPosition`, line 96; default export ~line 206)
- Create: `client/src/selectors/positioning.test.js`
- Modify: `client/src/sagas/core/services/cards.js:421-442` (`scheduleCard`)

**Interfaces:**
- Produces:
  - `getPositionBetween(items, { beforeId, afterId }, excludedId) → number`. `items` is ordered by position. It places right before `beforeId` when found, else right after `afterId`, else at the end.
  - `selectors.selectCardPositionBetween(state, listId, { beforeId, afterId }, excludedId) → number | undefined`
  - `entryActions.scheduleCard(id, { listId, startDate, dueDate, beforeCardId, afterCardId })`. Passing either key (even as `null`) means "set position from neighbours".

- [ ] **Step 1: Impact check**

Run `gitnexus_impact` on `scheduleCard` (saga) and `nextPosition`. Expect: `scheduleCard` called from TimelineView handlers only; `nextPosition` local to positioning.js. Report.

- [ ] **Step 2: Write the failing test**

`client/src/selectors/positioning.test.js`:

```js
import { getPositionBetween } from './positioning';

// Lane neighbours a and d have hidden cards (unscheduled, or filtered out) between them
const items = [
  { id: 'a', position: 65536 },
  { id: 'x', position: 131072 },
  { id: 'd', position: 196608 },
  { id: 'y', position: 262144 },
  { id: 'b', position: 327680 },
];

describe('getPositionBetween', () => {
  test('lands right before the next lane card, past the hidden ones', () => {
    expect(getPositionBetween(items, { beforeId: 'd', afterId: 'a' }, 'b')).toBe(163840);
  });

  test('lands right after the previous lane card when it goes last in the lane', () => {
    expect(getPositionBetween(items, { beforeId: null, afterId: 'd' }, 'b')).toBe(229376);
  });

  test('goes to the top of the list before the first card', () => {
    expect(getPositionBetween(items, { beforeId: 'a', afterId: null }, 'b')).toBe(32768);
  });

  test('goes to the end of the list without neighbours', () => {
    expect(getPositionBetween(items, { beforeId: null, afterId: null }, 'b')).toBe(327680);
  });

  test('ignores neighbours that are not in the list', () => {
    expect(getPositionBetween(items, { beforeId: 'gone', afterId: 'a' }, 'b')).toBe(98304);
  });
});
```

(Check of the last case: neighbour `a` is at index 0, so insert at index 1 between `a` (65536) and `x` (131072), giving 98304. For "end of list" the dragged card `b` is excluded, so the last item is `y` (262144), and adding the gap of 65536 gives 327680.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/selectors/positioning.test.js`
Expected: FAIL, `getPositionBetween is not a function`.

- [ ] **Step 4: Implement**

In `positioning.js` after `nextPosition`:

```js
// A position between named neighbours rather than at an index: the caller only sees some of the
// list (a timeline lane hides unscheduled and filtered-out cards), so it says which cards the item
// goes between and the full list decides the number
export const getPositionBetween = (items, { beforeId, afterId }, excludedId) => {
  const filteredItems = items.filter((item) => item.id !== excludedId);

  const beforeIndex = beforeId ? filteredItems.findIndex((item) => item.id === beforeId) : -1;

  if (beforeIndex !== -1) {
    return nextPosition(filteredItems, beforeIndex);
  }

  const afterIndex = afterId ? filteredItems.findIndex((item) => item.id === afterId) : -1;

  return nextPosition(filteredItems, afterIndex !== -1 ? afterIndex + 1 : undefined);
};
```

After `selectNextCardPosition`:

```js
export const selectCardPositionBetween = createSelector(
  orm,
  (_, listId) => listId,
  (_, __, neighbours) => neighbours,
  (_, __, ___, excludedId) => excludedId,
  ({ List }, listId, neighbours, excludedId) => {
    const listModel = List.withId(listId);

    if (!listModel) {
      return listModel;
    }

    return getPositionBetween(listModel.getCardsQuerySet().toRefArray(), neighbours, excludedId);
  },
);
```

Add `selectCardPositionBetween` to the default export object.

Replace `scheduleCard` in `sagas/core/services/cards.js`:

```js
// `beforeCardId` / `afterCardId`, when either is given (null meaning the end), place the card
// between those cards of its list, as a timeline drop that reorders a lane does
export function* scheduleCard(id, { listId, startDate, dueDate, beforeCardId, afterCardId }) {
  const data = {
    startDate: startDate || null,
    dueDate: dueDate || null,
  };

  const isReorder = beforeCardId !== undefined || afterCardId !== undefined;

  if (listId || isReorder) {
    const card = yield select(selectors.selectCardById, id);
    const targetListId = listId || card.listId;
    const list = yield select(selectors.selectListById, targetListId);

    if (targetListId !== card.listId) {
      data.listId = targetListId;
    }

    if (isListFinite(list)) {
      if (isReorder) {
        data.position = yield select(
          selectors.selectCardPositionBetween,
          targetListId,
          { beforeId: beforeCardId, afterId: afterCardId },
          id,
        );
      } else if (data.listId) {
        data.position = yield select(selectors.selectNextCardPosition, targetListId, undefined, id);
      }
    }
  }

  yield call(updateCard, id, data);
}
```

Check `entry-actions/cards.js:93` (`scheduleCard = (id, data)`) and its watcher. They pass `data` through whole, so no change is needed there. Confirm by reading the watcher in `sagas/core/watchers/cards.js`.

- [ ] **Step 5: Run tests and lint**

Run: `npx jest src/selectors && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/selectors/positioning.js client/src/selectors/positioning.test.js client/src/sagas/core/services/cards.js
git commit -m "cards: schedule a card between named neighbours"
```

---

### Task 4: TimelineView passes order and forwards placement

**Files:**
- Modify: `client/src/components/boards/Board/TimelineView/TimelineView.jsx` (`getUndoData` 42–52, `items` memo 280–358, `pushUndoEntry` ~411, `handleExternalDrop` ~559, `handleItemLaneChange` ~584)

**Interfaces:**
- Consumes (Task 3): `scheduleCard(id, { listId, startDate, dueDate, beforeCardId, afterCardId })`.
- Produces (relied on by Tasks 6–7): items carry `order: number`. `onItemLaneChange(cardId, laneKey, dates, placement)` and `onExternalDrop(cardId, { laneKey, startDate, dueDate, placement })`, where `placement = { beforeItemId, afterItemId, isReordered } | null`.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact` on `getUndoData`, `handleItemLaneChange`, `handleExternalDrop`. Report.

- [ ] **Step 2: Undo restores position on a reorder**

```js
// The card's values before a drag, as an update that puts them back. List and position are only
// included when the drag moves the card to another list or to another place in its own.
const getUndoData = (card, nextListId, isReordered = false) => ({
  startDate: card.startDate || null,
  dueDate: card.dueDate || null,
  ...(((nextListId && nextListId !== card.listId) || isReordered) && {
    listId: card.listId,
    position: card.position,
  }),
});
```

`pushUndoEntry`: add a 4th param `isReordered` and pass it on as `getUndoData(card, nextListId, isReordered)`.

- [ ] **Step 3: Give every item its order**

Above the `items` memo:

```js
  // Lanes are packed in this order: list by list as on the board, then card position within a
  // list, so a list lane reads top to bottom like its kanban column
  const orderByCardId = useMemo(() => {
    const listIndexById = sortedLists.reduce(
      (result, list, index) => ({ ...result, [list.id]: index }),
      {},
    );

    const getListIndex = (card) => (card.listId in listIndexById ? listIndexById[card.listId] : 0);

    return scheduledCards
      .slice()
      .sort(
        (a, b) => getListIndex(a) - getListIndex(b) || (a.position || 0) - (b.position || 0),
      )
      .reduce((result, card, index) => ({ ...result, [card.id]: index }), {});
  }, [scheduledCards, sortedLists]);
```

In the `items` memo's returned object add `order: orderByCardId[card.id],` after `laneKeys,` and add `orderByCardId` to the deps.

- [ ] **Step 4: Forward placement on lane change / reorder**

```js
  // Vertical drag only means something when the lanes are lists; in member or label grouping a
  // lane is not somewhere a card can be moved to. `placement` names the lane neighbours a reorder
  // puts the card between; recurring cards never carry one, as the chart does not reorder series.
  const handleItemLaneChange = useCallback(
    (cardId, laneKey, { startDate, dueDate }, placement) => {
      if (isRecurrenceChange(cardId, dueDate)) {
        setPendingRecurrenceChange({
          cardId,
          listId: laneKey,
          startDate: startDate || null,
          dueDate,
        });

        return;
      }

      const isReordered = !!placement && placement.isReordered;

      pushUndoEntry(
        cardId,
        (cardById[cardId] && laneKey !== cardById[cardId].listId) || isReordered
          ? 'common.timelineCardMoved'
          : 'common.timelineCardRescheduled',
        laneKey,
        isReordered,
      );

      dispatch(
        entryActions.scheduleCard(cardId, {
          listId: laneKey,
          startDate,
          dueDate,
          ...(isReordered && {
            beforeCardId: placement.beforeItemId,
            afterCardId: placement.afterItemId,
          }),
        }),
      );
    },
    [isRecurrenceChange, cardById, pushUndoEntry, dispatch],
  );
```

`handleExternalDrop`:

```js
  const handleExternalDrop = useCallback(
    (cardId, { laneKey, startDate, dueDate, placement }) => {
      setExternalDragItem(null);

      // Only list lanes name a list; member and label lanes leave the card where it is
      const listId = groupBy === GroupByOptions.LIST ? laneKey : undefined;
      const isReordered = !!listId && !!placement && placement.isReordered;

      pushUndoEntry(cardId, 'common.timelineCardScheduled', listId, isReordered);

      dispatch(
        entryActions.scheduleCard(cardId, {
          listId,
          startDate,
          dueDate,
          ...(isReordered && {
            beforeCardId: placement.beforeItemId,
            afterCardId: placement.afterItemId,
          }),
        }),
      );
    },
    [pushUndoEntry, dispatch, groupBy],
  );
```

- [ ] **Step 5: Lint + tests**

Run: `npm run lint && npx jest src/components/boards/Board/TimelineView`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/boards/Board/TimelineView/TimelineView.jsx
git commit -m "timeline: order lanes by card position and save reorders"
```

---

### Task 5: `useBarDrag` row targeting, lift frames, Escape

**Files:**
- Modify: `client/src/components/common/TimelineChart/use-bar-drag.js`
- Test: `client/src/components/common/TimelineChart/use-bar-drag.test.js`

**Interfaces:**
- Consumes: `getDropSlotAtClientY(clientY, excludeItemId) → { laneKey, targetRow } | null` (provided by the chart in Task 6).
- Produces:
  - Hook params: **replace** `getLaneKeyAtClientY` with `getDropSlotAtClientY`. **Add** `onDragFrame(deltaX, deltaY)` and `getPlacementResult() → placementResult | null`.
  - `drag` state gains `targetRow` (number | null). `toLaneKey` is now set whenever the pointer is over a lane, including the bar's own lane (it used to be the same thing in practice).
  - `onItemLaneChange(itemId, toLaneKey, dates, placementResult)`. The 4th argument is new.
  - Export `getDropAction({ mode, laneKey, toLaneKey, deltaUnits, isReordered, canChangeLane }) → 'laneChange' | 'dates' | null`.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "useBarDrag", direction: "upstream"})`. Expect TimelineChart only. Report.

- [ ] **Step 2: Write the failing test**

Append to `use-bar-drag.test.js` (and add `getDropAction` to its import):

```js
describe('getDropAction', () => {
  const base = {
    mode: DragModes.MOVE,
    laneKey: 'l1',
    toLaneKey: 'l1',
    deltaUnits: 0,
    isReordered: false,
    canChangeLane: true,
  };

  it('does nothing for a drop back where it started', () => {
    expect(getDropAction(base)).toBeNull();
  });

  it('only changes dates for a sideways drag on its own row', () => {
    expect(getDropAction({ ...base, deltaUnits: 2 })).toBe('dates');
  });

  it('commits a reorder within the lane even without a date change', () => {
    expect(getDropAction({ ...base, isReordered: true })).toBe('laneChange');
  });

  it('commits a move to another lane', () => {
    expect(getDropAction({ ...base, toLaneKey: 'l2' })).toBe('laneChange');
  });

  it('never changes lanes where lanes are not lists', () => {
    expect(getDropAction({ ...base, toLaneKey: 'l2', canChangeLane: false, deltaUnits: 1 })).toBe(
      'dates',
    );
  });

  it('never reorders while resizing', () => {
    expect(
      getDropAction({ ...base, mode: DragModes.RESIZE_END, isReordered: true, deltaUnits: 1 }),
    ).toBe('dates');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/components/common/TimelineChart/use-bar-drag.test.js`
Expected: FAIL, `getDropAction is not a function`.

- [ ] **Step 4: Implement**

Add after `getDraggedDates`:

```js
// What a released drag commits. A lane change also carries reorders inside the lane, since both
// go through the same update with the card's new neighbours.
export const getDropAction = ({
  mode,
  laneKey,
  toLaneKey,
  deltaUnits,
  isReordered,
  canChangeLane,
}) => {
  if (
    canChangeLane &&
    mode === DragModes.MOVE &&
    toLaneKey &&
    (toLaneKey !== laneKey || isReordered)
  ) {
    return 'laneChange';
  }

  return deltaUnits !== 0 ? 'dates' : null;
};
```

Replace `isPointOverUnscheduleZone`. The lifted bar now sits under the pointer, so check every layer and not only the topmost:

```js
// Hit test rather than a cached rect, so the zone can move or resize mid-drag without going stale.
// Every layer is checked, since the lifted bar itself sits right under the pointer.
const isPointOverUnscheduleZone = (event) =>
  document
    .elementsFromPoint(event.clientX, event.clientY)
    .some((element) => !!element.closest(UNSCHEDULE_ZONE_SELECTOR));
```

Hook changes, in order:

1. Signature: replace `getLaneKeyAtClientY` with `getDropSlotAtClientY`. Add `onDragFrame` and `getPlacementResult`.
2. `handlePointerDown`: add `startY: event.clientY` and `startScrollTop: scrollRef.current ? scrollRef.current.scrollTop : 0` to `dragRef.current`.
3. Add after `getDeltaX`:

```js
  // Vertical travel the same way, for the lifted bar following the pointer between lanes
  const getDeltaY = useCallback(
    (current, clientY) => {
      const scrollTop = scrollRef.current ? scrollRef.current.scrollTop : 0;
      return clientY - current.startY + (scrollTop - current.startScrollTop);
    },
    [scrollRef],
  );
```

4. In `updateDrag`, replace the `toLaneKey` lines with:

```js
    // Only a whole-bar move can change lanes or rows; resizing an edge stays put
    const slot = isMove ? getDropSlotAtClientY(clientY, current.itemId) : null;

    const toLaneKey = onItemLaneChange && slot ? slot.laneKey : null;
    const targetRow = onItemLaneChange && slot ? slot.targetRow : null;
```

Set `current.toLaneKey = toLaneKey;`. Add `prevDrag.targetRow === targetRow &&` to the equality chain and `targetRow,` to the new state object. Then, after `setDrag(...)`:

```js
    if (isMove && onDragFrame) {
      onDragFrame(deltaX, getDeltaY(current, clientY));
    }
```

Add `getDropSlotAtClientY, getDeltaY, onDragFrame` to its deps, and remove `getLaneKeyAtClientY`.

5. Escape cancels. Add after the auto-scroll effect:

```js
  // Escape drops the card back where it came from; the release that follows then finds no drag
  // and neither commits nor counts as a click
  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        dragRef.current = null;
        setDrag(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging]);
```

6. In `handlePointerUp`, replace everything from `const item = itemById[current.itemId];` to the end of the callback body with:

```js
      const item = itemById[current.itemId];

      const dates =
        deltaUnits === 0
          ? { startDate: item.startDate, dueDate: item.dueDate }
          : getDraggedDates(item, rangeById[current.itemId], current.mode, deltaUnits, zoomLevel);

      const placementResult =
        current.mode === DragModes.MOVE && getPlacementResult ? getPlacementResult() : null;

      const action = getDropAction({
        mode: current.mode,
        laneKey: current.laneKey,
        toLaneKey: current.toLaneKey,
        deltaUnits,
        isReordered: !!placementResult && placementResult.isReordered,
        canChangeLane: !!onItemLaneChange,
      });

      // A lane change carries the dates and the new neighbours with it, so the drop is a single
      // update either way
      if (action === 'laneChange') {
        onItemLaneChange(current.itemId, current.toLaneKey, dates, placementResult);
      } else if (action === 'dates') {
        onItemDatesChange(current.itemId, dates);
      }
```

Add `getPlacementResult` to its deps.

7. Update the hook's doc comment with one line: a move also picks the row under the pointer, and the chart lays the lane out around it.

- [ ] **Step 5: Run tests**

Run: `npx jest src/components/common/TimelineChart/use-bar-drag.test.js`
Expected: PASS. Lint also passes, but the app is broken at runtime until Task 6 passes `getDropSlotAtClientY` (the chart still passes the old `getLaneKeyAtClientY`). Don't hand the branch over between Tasks 5 and 6.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/common/TimelineChart/use-bar-drag.js client/src/components/common/TimelineChart/use-bar-drag.test.js
git commit -m "timeline: bar drags target a row, follow the pointer and cancel on Escape"
```

---

### Task 6: Chart renders the live preview (bar drags)

**Files:**
- Modify: `client/src/components/common/TimelineChart/TimelineChart.jsx`
- Modify: `client/src/components/common/TimelineChart/Bar.jsx`
- Modify: `client/src/components/common/TimelineChart/TimelineChart.module.scss` (around `.ghostBar` 280–325 and `.barDragging` 388)

**Interfaces:**
- Consumes: `buildLayout` (Task 2), `getRowAtY`, `formatDragRange` (Task 1), the `useBarDrag` params (Task 5).
- Produces: `placementResultRef` and `getDropSlotAtClientY`, both reused by Task 7.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact` on `Bar` and `TimelineChart`. Report.

- [ ] **Step 2: Bar gets lift props**

In `Bar.jsx`, add props `isLifted` (bool, default `false`) and `liftRef` (func, default `undefined`). On the root div add `ref={isLifted ? liftRef : undefined}` and `[styles.barLifted]: isLifted,` to the classNames.

- [ ] **Step 3: Base layout, slot hit-testing, lift frames**

In `TimelineChart.jsx`, after `committedLayout` (Task 2):

```js
    // Hit testing reads the lanes as they were when the card was picked up, minus the card itself,
    // so neither bars sliding aside nor changes from other users move the target under a still
    // pointer. Cleared once nothing is in flight.
    const baseLayoutRef = useRef(null);

    const getBaseLayout = useCallback(
      (excludeItemId) => {
        if (!baseLayoutRef.current || baseLayoutRef.current.excludeItemId !== excludeItemId) {
          baseLayoutRef.current = {
            excludeItemId,
            layout: buildLayout({ ...layoutInput, excludeItemId }),
          };
        }

        return baseLayoutRef.current.layout;
      },
      [layoutInput],
    );

    const getDropSlotAtClientY = useCallback(
      (clientY, excludeItemId) => {
        if (!canvasRef.current) {
          return null;
        }

        const y = clientY - canvasRef.current.getBoundingClientRect().top;

        const laneLayout = getBaseLayout(excludeItemId).lanes.find(
          (candidate) => y >= candidate.top && y < candidate.top + candidate.height,
        );

        if (!laneLayout) {
          return null;
        }

        return {
          laneKey: laneLayout.lane.key,
          targetRow: getRowAtY(
            laneLayout.rowTops,
            laneLayout.rowsHeight,
            y - laneLayout.top - LANE_PADDING,
          ),
        };
      },
      [getBaseLayout],
    );

    // The bar being moved is moved by hand, frame by frame, rather than through a render per pixel
    const liftRef = useRef(null);

    const setLiftNode = useCallback((node) => {
      if (liftRef.current && liftRef.current !== node) {
        liftRef.current.style.transform = '';
      }

      liftRef.current = node;
    }, []);

    const handleDragFrame = useCallback((deltaX, deltaY) => {
      if (liftRef.current) {
        liftRef.current.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      }
    }, []);

    // Read on release: where the layout last put the card in flight
    const placementResultRef = useRef(null);
    const getPlacementResult = useCallback(() => placementResultRef.current, []);
```

Change `getLaneKeyAtClientY` to use `committedLayout` instead of `layout` (double-click still uses it).

Pass to `useBarDrag`: `getDropSlotAtClientY`, `onDragFrame: handleDragFrame`, `getPlacementResult`. Remove `getLaneKeyAtClientY`.

`useDropTarget` still takes `layout` until Task 7. Pass it `layout: committedLayout` now, because the preview `layout` below is declared after the hook. The old sidebar-drop preview block keeps working off `dropPreview.laneTop` until Task 7 replaces it.

- [ ] **Step 4: Preview layout**

Replace `const layout = committedLayout;` (from Task 2; move it below `useBarDrag` and `useDropTarget`) and the whole `dragGhost` memo with:

```js
    // Where the bar being moved would land, laid into its lane so the rest makes room. Only a list
    // lane takes a row; elsewhere the card keeps its place in the order and only its dates move.
    const barPlacement = useMemo(() => {
      if (!drag || drag.mode !== DragModes.MOVE || drag.isOverUnscheduleZone) {
        return null;
      }

      const item = itemById[drag.itemId];
      const committedRange = rangeById[drag.itemId];

      if (!item || !committedRange) {
        return null;
      }

      const range =
        getItemRange({
          ...item,
          ...getDraggedDates(item, committedRange, drag.mode, drag.deltaUnits, zoomLevel),
        }) || committedRange;

      const isRowTarget = drag.toLaneKey !== null && drag.targetRow !== null;

      return {
        item,
        range,
        laneKey: isRowTarget ? drag.toLaneKey : drag.laneKey,
        targetRow: isRowTarget ? drag.targetRow : null,
      };
    }, [drag, itemById, rangeById, zoomLevel]);

    const placement = barPlacement;

    const layout = useMemo(
      () =>
        placement || (drag && drag.isOverUnscheduleZone)
          ? buildLayout({
              ...layoutInput,
              placement,
              excludeItemId: placement ? null : drag.itemId,
            })
          : committedLayout,
      [placement, drag, layoutInput, committedLayout],
    );

    placementResultRef.current = layout.placementResult;

    const isPlacing = layout !== committedLayout;

    useEffect(() => {
      if (!isPlacing) {
        baseLayoutRef.current = null;
      }
    }, [isPlacing]);
```

Note: `drag.toLaneKey`/`drag.targetRow` are `null` when `onItemLaneChange` is absent (Task 5), so non-list groupings get a dates-only placement automatically.

- [ ] **Step 5: Bars from both layouts**

Turn the `bars` memo body into a helper and build both. Put this above the component:

```js
const toBars = (laneLayouts, getRenderRange, viewStart, zoomLevel, unitWidth) =>
  laneLayouts.flatMap(({ lane, top, entries }) =>
    entries.map(({ item, rowTop, range: committedRange, isCompact, isPlaceholder }) => {
      const range = isPlaceholder ? committedRange : getRenderRange(item.id, committedRange);
      const left = getOffsetX(viewStart, range.start, zoomLevel);
      const width = Math.max(getOffsetX(viewStart, range.end, zoomLevel) + unitWidth - left, 8);
      const rowGap = isCompact ? COMPACT_ROW_HEIGHT - COMPACT_BAR_HEIGHT : ROW_GAP;

      return {
        key: `${lane.key}:${item.id}`,
        item,
        laneKey: lane.key,
        range,
        left,
        width,
        top: top + LANE_PADDING + rowTop + rowGap / 2,
        height: isCompact ? COMPACT_BAR_HEIGHT : getBarHeight(item),
        isCompact: !!isCompact,
        isPlaceholder: !!isPlaceholder,
      };
    }),
  );
```

In the component:

```js
    const committedBars = useMemo(
      () => toBars(committedLayout.lanes, getRenderRange, viewStart, zoomLevel, unitWidth),
      [committedLayout, getRenderRange, viewStart, zoomLevel, unitWidth],
    );

    const bars = useMemo(
      () =>
        isPlacing
          ? toBars(layout.lanes, getRenderRange, viewStart, zoomLevel, unitWidth)
          : committedBars,
      [isPlacing, layout, getRenderRange, viewStart, zoomLevel, unitWidth, committedBars],
    );

    const barByKey = useMemo(
      () => bars.reduce((result, bar) => ({ ...result, [bar.key]: bar }), {}),
      [bars],
    );

    const placeholderBars = useMemo(() => bars.filter((bar) => bar.isPlaceholder), [bars]);
```

`seriesTracks`, `anchorById` and `arrows` keep reading `bars` (the preview), so arrows follow the placeholder.

- [ ] **Step 6: Render**

Replace the `bars.map(... <Bar .../>)` block and the `dragGhost` block with:

```jsx
                  {/* Drawn in committed order, so no bar's element is ever moved or remounted
                      mid-drag: the one being moved holds the pointer capture */}
                  {committedBars.map((committedBar) => {
                    const { key, item, laneKey } = committedBar;

                    const isLifted =
                      !!drag &&
                      drag.mode === DragModes.MOVE &&
                      drag.itemId === item.id &&
                      drag.laneKey === laneKey;

                    const bar = isLifted ? committedBar : barByKey[key];

                    if (!bar || bar.isPlaceholder) {
                      return null;
                    }

                    return (
                      <Bar
                        key={key}
                        item={item}
                        laneKey={laneKey}
                        range={bar.range}
                        left={bar.left}
                        width={bar.width}
                        top={bar.top}
                        height={bar.height}
                        isCompact={bar.isCompact}
                        isDimmed={!!hoveredSeriesId && item.seriesId !== hoveredSeriesId}
                        isSeriesHighlighted={!!hoveredSeriesId && item.seriesId === hoveredSeriesId}
                        isEditable={isEditable && item.isEditable !== false}
                        isLinkable={isLinkable && item.isEditable !== false}
                        isCritical={criticalPath.itemIds.has(item.id)}
                        isDragging={!!drag && drag.itemId === item.id}
                        isLifted={isLifted}
                        liftRef={setLiftNode}
                        onPointerDown={handleBarPointerDown}
                        onPointerMove={handleBarPointerMove}
                        onPointerUp={handleBarPointerUp}
                        onPointerEnter={setHoveredItemId}
                        onPointerLeave={setHoveredItemId}
                        onKeyDown={handleBarKeyDown}
                        onLinkPointerDown={handleLinkPointerDown}
                      />
                    );
                  })}
                  {placementLane && (
                    <div
                      className={styles.dropLane}
                      style={{ top: placementLane.top, height: placementLane.height }}
                    />
                  )}
                  {placeholderBars.map((bar) => (
                    <React.Fragment key={`placeholder:${bar.key}`}>
                      <div
                        className={classNames(styles.placeholderBar, bar.item.colorClassName)}
                        style={{ left: bar.left, width: bar.width, top: bar.top, height: bar.height }}
                      />
                      {/* A sibling, not a child: the placeholder is faded as a whole, and the
                          colour classes set an !important background that cannot be split off */}
                      {bar.laneKey === placement.laneKey && (
                        <div
                          className={styles.placeholderDates}
                          style={{ left: bar.left, top: bar.top - 20 }}
                        >
                          {formatDragRange(bar.range, zoomLevel, (date, format) =>
                            i18n.dateFns.format(date, format),
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
```

Define `placementLane` before the return:

```js
    // A card heading into a lane it is not in yet lights that lane up
    const placementLane =
      placement && !placement.item.laneKeys.includes(placement.laneKey)
        ? layout.lanes.find((laneLayout) => laneLayout.lane.key === placement.laneKey)
        : null;
```

Add `classNames(..., isPlacing && styles.canvasPlacing)` to the canvas div. The `bars.length === 0 && emptyMessage` check switches to `committedBars.length`. Lane headers, lane backgrounds and the canvas height keep reading `layout` (now the preview), so the header column grows and shrinks with the canvas.

Delete the now-unused `dragGhost` code and update the comment above `getRenderRange` ("Moving is the one mode that leaves the bar where it is and sends a ghost instead") to say that moving lifts the bar and leaves a placeholder.

- [ ] **Step 7: Styles**

In `TimelineChart.module.scss`, delete `.ghostBar` and `.ghostBarLabel`. Keep `.dropPreview*` until Task 7 removes them. Add next to `.barDragging`:

```scss
  // The bar being moved, following the pointer above everything else
  .barLifted {
    box-shadow: 0 8px 18px rgba(9, 30, 66, 0.35);
    cursor: grabbing;
    opacity: 0.9;
    z-index: 7;
  }

  // While a card is in flight the lane makes room for it, so bars glide to their new rows
  .canvasPlacing .bar {
    transition: top 150ms ease, left 150ms ease, width 150ms ease;
  }

  .canvasPlacing .barLifted {
    transition: none;
  }

  // Where the card in flight would land, in its own colour but faded and outlined to say it is
  // not committed yet
  .placeholderBar {
    border: 1px dashed rgba(9, 30, 66, 0.55);
    border-radius: 4px;
    opacity: 0.45;
    pointer-events: none;
    position: absolute;
    transition: top 120ms ease, left 120ms ease, width 120ms ease;
    z-index: 5;
  }

  .placeholderDates {
    background: #172b4d;
    border-radius: 3px;
    color: #fff;
    font-size: 11px;
    line-height: 16px;
    padding: 1px 6px;
    pointer-events: none;
    position: absolute;
    transition: top 120ms ease, left 120ms ease;
    white-space: nowrap;
    z-index: 8;
  }

  @media (prefers-reduced-motion: reduce) {
    .canvasPlacing .bar,
    .placeholderBar {
      transition: none;
    }
  }
```

Also add `.placeholderDates` to the `prefers-reduced-motion` selector list.

- [ ] **Step 8: Lint, tests, build**

Run: `npm run lint && npx jest src/components/common/TimelineChart && npm run build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/common/TimelineChart
git commit -m "timeline: lanes make room for a moved card, which lifts and snaps to rows"
```

---

### Task 7: Sidebar drops target rows too

**Files:**
- Modify: `client/src/components/common/TimelineChart/use-drop-target.js`
- Modify: `client/src/components/common/TimelineChart/TimelineChart.jsx` (`useDropTarget` call, `handleExternalDrop`, `placement`, the drop preview JSX)
- Modify: `client/src/components/common/TimelineChart/TimelineChart.module.scss` (remove `.dropPreview*`)

**Interfaces:**
- Consumes: `getDropSlotAtClientY`, `placementResultRef`, `layout` (Task 6).
- Produces: `useDropTarget({ isActive, scrollRef, headerRef, canvasRef, viewStart, zoomLevel, totalWidth, getDropSlotAtClientY, onDrop, onCancel }) → { laneKey, targetRow, startDate, dueDate } | null`. `onExternalDrop` receives `placement`, as Task 4 expects.

- [ ] **Step 1: Impact check**

Run `gitnexus_impact({target: "useDropTarget", direction: "upstream"})`. Report.

- [ ] **Step 2: `useDropTarget` asks the chart for the slot**

Replace the `layout` param with `getDropSlotAtClientY`. In `resolve`, replace the `laneLayout` lookup and `next` object with:

```js
    const slot = isOverVisibleCanvas ? getDropSlotAtClientY(pointer.clientY, null) : null;

    if (!slot || x < 0 || x > totalWidth) {
      previewRef.current = null;
      setPreview(null);

      return;
    }

    const next = {
      laneKey: slot.laneKey,
      targetRow: slot.targetRow,
      ...getDropRange(x, viewStart, zoomLevel),
    };

    previewRef.current = next;

    setPreview((prevPreview) =>
      prevPreview &&
      prevPreview.laneKey === next.laneKey &&
      prevPreview.targetRow === next.targetRow &&
      prevPreview.startDate.getTime() === next.startDate.getTime()
        ? prevPreview
        : next,
    );
```

Remove the now-unused `PIXELS_PER_DAY` import and the `layout` dep. Update the doc comment: the drop also picks the row under the pointer.

- [ ] **Step 3: Chart wiring**

`useDropTarget` call: pass `getDropSlotAtClientY` and remove `layout`. The hook call must stay above the `layout` memo.

`handleExternalDrop`:

```js
    const handleExternalDrop = useCallback(
      (laneKey, dates) => {
        onExternalDrop(externalDragItem.id, {
          laneKey,
          ...dates,
          placement: placementResultRef.current,
        });
      },
      [externalDragItem, onExternalDrop],
    );
```

Replace `const placement = barPlacement;` with:

```js
    // A card coming from the sidebar has no place in any order yet, so it sorts last until a row
    // gives it one
    const externalPlacement = useMemo(
      () =>
        dropPreview && externalDragItem
          ? {
              item: {
                id: externalDragItem.id,
                name: externalDragItem.name,
                // In list lanes it is not in any lane yet, so the drop counts as a move into one;
                // elsewhere it only takes dates, so it belongs to the lane it is held over
                laneKeys: onItemLaneChange ? [] : [dropPreview.laneKey],
                order: Number.MAX_SAFE_INTEGER,
              },
              range: getItemRange(dropPreview),
              laneKey: dropPreview.laneKey,
              targetRow: onItemLaneChange ? dropPreview.targetRow : null,
            }
          : null,
      [dropPreview, externalDragItem, onItemLaneChange],
    );

    const placement = barPlacement || externalPlacement;
```

A card from the sidebar always lights up its lane, in every grouping. Change `placementLane` to:

```js
    // A card heading into a lane it is not in yet, or coming from the sidebar, lights that lane up
    const placementLane =
      placement && (externalPlacement || !placement.item.laneKeys.includes(placement.laneKey))
        ? layout.lanes.find((laneLayout) => laneLayout.lane.key === placement.laneKey)
        : null;
```

Delete the old `{dropPreview && externalDragItem && (...)}` JSX block. The placeholder loop from Task 6 now draws it. Remove `.dropPreview` and `.dropPreviewLabel` from the SCSS, and drop the `ROW_HEIGHT`/`BAR_HEIGHT` imports if they are now unused.

- [ ] **Step 4: Lint, tests, build**

Run: `npm run lint && npx jest && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/common/TimelineChart
git commit -m "timeline: sidebar drops land on the row under the pointer"
```

---

### Task 8: Scope check and manual test list

- [ ] **Step 1:** `gitnexus_detect_changes({scope: "compare", base_ref: "master"})`. Confirm only TimelineChart/*, TimelineView, positioning selectors and the `scheduleCard` saga changed.
- [ ] **Step 2:** `npm run lint && npx jest && npm run build` in `client/`. All green.
- [ ] **Step 3:** Hand the user this manual test list (board timeline, List grouping unless noted):

1. Four overlapping cards in one list: drag the 2nd to the top row. It shows at the top while dragging and the others slide down. After drop the order holds, and the kanban column shows the same order.
2. Drag a card sideways on its own row. Only the dates change (Undo says "rescheduled"), and the kanban order is unchanged.
3. Drag into another list at row 2. The ghost sits on row 2, not the lane top. After drop the card is between the right neighbours in the kanban column, including when unscheduled cards sit between them.
4. Drop below the last row of a lane. The card goes last.
5. The date label reads correctly at day/week/month zoom.
6. Press Escape mid-drag. The card snaps back, nothing saves, and the card doesn't open.
7. Undo after a reorder. The previous order and dates come back.
8. Hold the bar near the edges. Auto-scroll still works and the lifted bar stays under the pointer.
9. Drag a card onto the unscheduled sidebar. It still unschedules.
10. Drag from the sidebar onto a specific row. It lands there.
11. Member/Label grouping: dragging changes dates only, other bars still make room, and there is no lane change.
12. Recurring card: no reorder, the series rows stay pinned, and the scope modal still appears.
13. Collapsed lane as a drop target still works.
14. Moving into the lane just below a lane that grew: the switch may come up to a row early (known trade-off).
15. With OS "reduce motion" on, bars jump instead of sliding.
16. Home dashboard TeamTimeline packs exactly as before.
