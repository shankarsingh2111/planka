import buildLayout, { getSlotAtY } from './layout';
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
    lanes: [
      { key: 'l1', label: 'L1' },
      { key: 'l2', label: 'L2' },
    ],
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

describe('dragging a stacked card sideways', () => {
  // a and c share the top row; b overlaps a, so it sits alone on the row below
  const items = [
    card('a', 1, '2026-09-01', '2026-09-02'),
    card('b', 2, '2026-09-01', '2026-09-05'),
    card('c', 3, '2026-09-08', '2026-09-09'),
  ];

  test('reads the pointer over its bar as its own lane and row', () => {
    const layout = build(items);
    const y = layout.lanes[0].top + LANE_PADDING + ROW_HEIGHT + ROW_HEIGHT / 2;

    expect(getSlotAtY(layout, y)).toEqual({ laneKey: 'l1', targetRow: 1 });
  });

  test('does not reorder it', () => {
    const b = items[1];

    const layout = build(items, {
      placement: {
        item: b,
        range: getItemRange({ startDate: day('2026-09-02'), dueDate: day('2026-09-06') }),
        laneKey: 'l1',
        targetRow: 1,
      },
    });

    expect(layout.placementResult.isReordered).toBe(false);
  });

  test('reads a pointer between lanes as no slot', () => {
    const layout = build(items);

    expect(getSlotAtY(layout, layout.totalHeight + 5)).toBeNull();
  });
});

describe('completed cards', () => {
  const items = [
    { ...card('done', 1, '2026-09-01', '2026-09-05'), isCompleted: true },
    card('open', 2, '2026-09-03', '2026-09-08'),
  ];

  test('go on rows under the open cards, whatever their order', () => {
    const [lane] = build(items).lanes;

    expect(rowsOf(lane)).toEqual({ open: 0, done: 1 });
  });

  test('are drawn first in a collapsed lane, so open bars sit on top', () => {
    const [lane] = build(items, { collapsedLaneKeys: ['l1'] }).lanes;

    expect(lane.entries.map(({ item }) => item.id)).toEqual(['done', 'open']);
    expect(rowsOf(lane)).toEqual({ open: 0, done: 0 });
  });
});
