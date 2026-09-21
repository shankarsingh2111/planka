import {
  ZoomLevels,
  addDays,
  diffInDays,
  getItemRange,
  getViewRange,
  packRows,
  startOfDay,
} from './utils';
import findCriticalPath from './find-critical-path';

const day = (dateString) => new Date(`${dateString}T10:00:00`);

describe('getItemRange', () => {
  test('uses start and due dates when both are set', () => {
    const range = getItemRange({ startDate: day('2026-09-01'), dueDate: day('2026-09-05') });

    expect(diffInDays(range.start, range.end)).toBe(4);
    expect(range.isPoint).toBe(false);
  });

  test('treats due-only items as point markers', () => {
    expect(getItemRange({ dueDate: day('2026-09-05') }).isPoint).toBe(true);
  });

  test('gives start-only items an open-ended week', () => {
    const range = getItemRange({ startDate: day('2026-09-01') });

    expect(range.isOpenEnded).toBe(true);
    expect(diffInDays(range.start, range.end)).toBe(6);
  });

  test('returns null without dates', () => {
    expect(getItemRange({})).toBeNull();
  });
});

describe('getViewRange', () => {
  test('aligns week zoom to a Monday and covers every range', () => {
    const start = startOfDay(day('2020-01-15'));
    const end = startOfDay(day('2020-02-10'));

    const { viewStart, totalDays } = getViewRange([{ start, end }], ZoomLevels.WEEK);

    expect(viewStart.getDay()).toBe(1);
    expect(viewStart <= start).toBe(true);
    expect(addDays(viewStart, totalDays) > end).toBe(true);
  });

  test('aligns month zoom to the first of a month', () => {
    const { viewStart } = getViewRange([], ZoomLevels.MONTH);

    expect(viewStart.getDate()).toBe(1);
  });
});

describe('packRows', () => {
  const entry = (id, start, end) => ({
    id,
    range: { start: startOfDay(day(start)), end: startOfDay(day(end)) },
  });

  test('puts non-overlapping items on the same row', () => {
    const rows = packRows([
      entry('a', '2026-09-01', '2026-09-03'),
      entry('b', '2026-09-04', '2026-09-06'),
    ]);

    expect(rows.map((row) => row.rowIndex)).toEqual([0, 0]);
  });

  test('stacks items that share a day', () => {
    const rows = packRows([
      entry('a', '2026-09-01', '2026-09-03'),
      entry('b', '2026-09-03', '2026-09-06'),
    ]);

    expect(rows.map((row) => row.rowIndex)).toEqual([0, 1]);
  });

  test('reuses the first free row', () => {
    const rows = packRows([
      entry('a', '2026-09-01', '2026-09-03'),
      entry('b', '2026-09-03', '2026-09-06'),
      entry('c', '2026-09-02', '2026-09-02'),
    ]);

    const rowIndexById = Object.fromEntries(rows.map((row) => [row.id, row.rowIndex]));

    expect(rowIndexById).toEqual({ a: 0, c: 1, b: 1 });
  });
});

describe('findCriticalPath', () => {
  const range = (start, end) => ({ start: startOfDay(day(start)), end: startOfDay(day(end)) });

  test('picks the longest chain by total duration', () => {
    const rangeById = {
      a: range('2026-09-01', '2026-09-02'), // 2 days
      b: range('2026-09-03', '2026-09-12'), // 10 days
      c: range('2026-09-03', '2026-09-04'), // 2 days
      d: range('2026-09-13', '2026-09-14'), // 2 days
    };

    const dependencies = [
      { id: 'ab', predecessorId: 'a', successorId: 'b' },
      { id: 'ac', predecessorId: 'a', successorId: 'c' },
      { id: 'bd', predecessorId: 'b', successorId: 'd' },
      { id: 'cd', predecessorId: 'c', successorId: 'd' },
    ];

    const { itemIds, dependencyIds } = findCriticalPath(dependencies, rangeById);

    expect([...itemIds]).toEqual(['a', 'b', 'd']);
    expect([...dependencyIds]).toEqual(['ab', 'bd']);
  });

  test('does not loop forever on a stale cycle', () => {
    const rangeById = {
      a: range('2026-09-01', '2026-09-02'),
      b: range('2026-09-03', '2026-09-04'),
    };

    const dependencies = [
      { id: 'ab', predecessorId: 'a', successorId: 'b' },
      { id: 'ba', predecessorId: 'b', successorId: 'a' },
    ];

    expect(() => findCriticalPath(dependencies, rangeById)).not.toThrow();
  });
});
