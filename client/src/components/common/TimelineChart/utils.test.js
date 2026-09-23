import {
  ZoomLevels,
  PIXELS_PER_DAY,
  SLOTS_PER_DAY,
  addSlots,
  getSlotOfDay,
  diffInSlots,
  getUnitWidth,
  getOffsetX,
  getDateAtOffsetX,
  getDropRange,
  HOUR_TICK_STEP,
  WORK_DAY_HOURS,
  WORK_DAY_START_HOUR,
  WORK_DAY_END_HOUR,
  getHeaderColumns,
  getZoomLevels,
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

describe('getZoomLevels', () => {
  test('offers quarter only when enabled', () => {
    expect(getZoomLevels(false)).toEqual([ZoomLevels.DAY, ZoomLevels.WEEK, ZoomLevels.MONTH]);
    expect(getZoomLevels(true)).toContain(ZoomLevels.QUARTER);
  });

  test('starts with day, which is the default zoom', () => {
    expect(getZoomLevels(false)[0]).toBe(ZoomLevels.DAY);
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

describe('slots', () => {
  const at = (dateString, hours, minutes = 0) => {
    const date = new Date(`${dateString}T00:00:00`);
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  test('maps times to the slot they fall in, clamped to the working day', () => {
    expect(getSlotOfDay(at('2026-09-21', 9))).toBe(0);
    expect(getSlotOfDay(at('2026-09-21', 12))).toBe(1); // 11-1
    expect(getSlotOfDay(at('2026-09-21', 19))).toBe(5); // 7-9
    expect(getSlotOfDay(at('2026-09-21', 3))).toBe(0); // before hours
    expect(getSlotOfDay(at('2026-09-21', 23))).toBe(SLOTS_PER_DAY - 1); // after hours
  });

  test('moves by whole slots inside the day', () => {
    expect(addSlots(at('2026-09-21', 9), 1)).toEqual(at('2026-09-21', 11));
    expect(addSlots(at('2026-09-21', 9), 2)).toEqual(at('2026-09-21', 13));
    expect(addSlots(at('2026-09-21', 17), -1)).toEqual(at('2026-09-21', 15));
  });

  test('rolls over to the next and previous working day', () => {
    expect(addSlots(at('2026-09-21', 19), 1)).toEqual(at('2026-09-22', 9));
    expect(addSlots(at('2026-09-21', 9), SLOTS_PER_DAY)).toEqual(at('2026-09-22', 9));
    expect(addSlots(at('2026-09-22', 9), -1)).toEqual(at('2026-09-21', 19));
  });

  test('counts slots between two times', () => {
    expect(diffInSlots(at('2026-09-21', 9), at('2026-09-21', 11))).toBe(1);
    expect(diffInSlots(at('2026-09-21', 9), at('2026-09-22', 9))).toBe(SLOTS_PER_DAY);
  });

  test('day zoom drags by one slot, other zoom levels by a whole day', () => {
    expect(getUnitWidth(ZoomLevels.DAY)).toBe(PIXELS_PER_DAY[ZoomLevels.DAY] / SLOTS_PER_DAY);
    expect(getUnitWidth(ZoomLevels.WEEK)).toBe(PIXELS_PER_DAY[ZoomLevels.WEEK]);
  });

  test('positions a time on its slot at day zoom, and on its day elsewhere', () => {
    const viewStart = startOfDay(at('2026-09-21', 0));
    const slotWidth = getUnitWidth(ZoomLevels.DAY);

    expect(getOffsetX(viewStart, at('2026-09-21', 9), ZoomLevels.DAY)).toBe(0);
    expect(getOffsetX(viewStart, at('2026-09-21', 13), ZoomLevels.DAY)).toBeCloseTo(2 * slotWidth);
    expect(getOffsetX(viewStart, at('2026-09-22', 9), ZoomLevels.DAY)).toBeCloseTo(
      PIXELS_PER_DAY[ZoomLevels.DAY],
    );

    // Week zoom ignores the time of day
    expect(getOffsetX(viewStart, at('2026-09-21', 17), ZoomLevels.WEEK)).toBe(0);
  });
});

describe('getHeaderColumns', () => {
  const formatDate = (date, format) => `${format}:${date.getHours()}`;

  test('day zoom splits the working day into six two-hour slots', () => {
    const viewStart = startOfDay(day('2026-09-21'));
    const { hours } = getHeaderColumns(viewStart, 1, ZoomLevels.DAY, formatDate);

    // 9-11, 11-1, 1-3, 3-5, 5-7, 7-9
    expect(hours.map((tick) => tick.startHour)).toEqual([9, 11, 13, 15, 17, 19]);
    expect(hours[0].isDayStart).toBe(true);
    expect(hours[hours.length - 1].isDayEnd).toBe(true);
    expect(WORK_DAY_END_HOUR - WORK_DAY_START_HOUR).toBe(12);
  });

  test('the six slots exactly fill the day column', () => {
    const viewStart = startOfDay(day('2026-09-21'));
    const { hours } = getHeaderColumns(viewStart, 1, ZoomLevels.DAY, formatDate);

    const pixelsPerDay = PIXELS_PER_DAY[ZoomLevels.DAY];

    expect(hours[0].left).toBe(0);
    expect(hours[0].width).toBeCloseTo(pixelsPerDay / 6);

    const lastTick = hours[hours.length - 1];
    expect(lastTick.left + lastTick.width).toBeCloseTo(pixelsPerDay);
  });

  test('slots line up with the day columns on later days', () => {
    const viewStart = startOfDay(day('2026-09-21'));
    const { bottom, hours } = getHeaderColumns(viewStart, 3, ZoomLevels.DAY, formatDate);

    const secondDaySlots = hours.filter((tick) => tick.left >= bottom[1].left);

    expect(secondDaySlots[0].left).toBeCloseTo(bottom[1].left);
    expect(secondDaySlots).toHaveLength(12); // days two and three
  });

  test('other zoom levels have no hour ticks', () => {
    const viewStart = startOfDay(day('2026-09-21'));

    expect(getHeaderColumns(viewStart, 14, ZoomLevels.WEEK, formatDate).hours).toHaveLength(0);
    expect(getHeaderColumns(viewStart, 90, ZoomLevels.MONTH, formatDate).hours).toHaveLength(0);
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

describe('getDateAtOffsetX', () => {
  const viewStart = startOfDay(new Date('2026-09-07T00:00:00'));

  test('lands on the start of the working day at week zoom', () => {
    const result = getDateAtOffsetX(viewStart, 0, ZoomLevels.WEEK);

    expect(result.getDate()).toBe(7);
    expect(result.getHours()).toBe(WORK_DAY_START_HOUR);
    expect(result.getMinutes()).toBe(0);
  });

  test('advances a whole day per unit at week zoom', () => {
    const unitWidth = getUnitWidth(ZoomLevels.WEEK);

    expect(getDateAtOffsetX(viewStart, unitWidth * 3, ZoomLevels.WEEK).getDate()).toBe(10);
  });

  test('snaps anywhere inside a unit back to its start', () => {
    const unitWidth = getUnitWidth(ZoomLevels.WEEK);
    const atStart = getDateAtOffsetX(viewStart, unitWidth * 2, ZoomLevels.WEEK);
    const nearEnd = getDateAtOffsetX(viewStart, unitWidth * 3 - 1, ZoomLevels.WEEK);

    expect(nearEnd.getTime()).toBe(atStart.getTime());
  });

  test('lands on the slot hour at day zoom', () => {
    const unitWidth = getUnitWidth(ZoomLevels.DAY);

    const first = getDateAtOffsetX(viewStart, 0, ZoomLevels.DAY);
    expect(first.getHours()).toBe(WORK_DAY_START_HOUR);

    const second = getDateAtOffsetX(viewStart, unitWidth, ZoomLevels.DAY);
    expect(second.getHours()).toBe(WORK_DAY_START_HOUR + HOUR_TICK_STEP);
    expect(second.getDate()).toBe(7);
  });

  test('rolls into the next day after the last slot at day zoom', () => {
    const unitWidth = getUnitWidth(ZoomLevels.DAY);
    const result = getDateAtOffsetX(viewStart, unitWidth * SLOTS_PER_DAY, ZoomLevels.DAY);

    expect(result.getDate()).toBe(8);
    expect(result.getHours()).toBe(WORK_DAY_START_HOUR);
  });

  test('round-trips with getOffsetX at every zoom level', () => {
    Object.values(ZoomLevels).forEach((zoomLevel) => {
      const unitWidth = getUnitWidth(zoomLevel);

      [0, 1, 5, 17].forEach((unitIndex) => {
        const date = getDateAtOffsetX(viewStart, unitIndex * unitWidth, zoomLevel);

        expect(getOffsetX(viewStart, date, zoomLevel)).toBeCloseTo(unitIndex * unitWidth, 6);
      });
    });
  });
});

describe('getDropRange', () => {
  const viewStart = startOfDay(new Date('2026-09-07T00:00:00'));

  test('covers the whole working day at every zoom level', () => {
    Object.values(ZoomLevels).forEach((zoomLevel) => {
      const dayWidth = PIXELS_PER_DAY[zoomLevel];

      const { startDate, dueDate } = getDropRange(dayWidth * 2, viewStart, zoomLevel);

      expect(startDate.getDate()).toBe(9);
      expect(startDate.getHours()).toBe(WORK_DAY_START_HOUR);
      expect(dueDate.getDate()).toBe(9);
      expect(dueDate.getHours()).toBe(WORK_DAY_END_HOUR);
      expect(diffInDays(startDate, dueDate)).toBe(0);
    });
  });

  test('snaps to the day, not the slot, at day zoom', () => {
    const slotWidth = getUnitWidth(ZoomLevels.DAY);

    // Every slot of the same day has to yield the same full day
    const first = getDropRange(0, viewStart, ZoomLevels.DAY);

    for (let slot = 1; slot < SLOTS_PER_DAY; slot += 1) {
      const atSlot = getDropRange(slotWidth * slot, viewStart, ZoomLevels.DAY);

      expect(atSlot.startDate.getTime()).toBe(first.startDate.getTime());
      expect(atSlot.dueDate.getTime()).toBe(first.dueDate.getTime());
    }

    // The next day's first slot moves on
    const nextDay = getDropRange(slotWidth * SLOTS_PER_DAY, viewStart, ZoomLevels.DAY);
    expect(nextDay.startDate.getDate()).toBe(first.startDate.getDate() + 1);
  });

  test('spans the full working day, not a single slot', () => {
    const { startDate, dueDate } = getDropRange(0, viewStart, ZoomLevels.DAY);

    expect(dueDate.getHours() - startDate.getHours()).toBe(WORK_DAY_HOURS);
    expect(WORK_DAY_HOURS).toBe(SLOTS_PER_DAY * HOUR_TICK_STEP);
  });

  test('never spills into another day, however far along the scale it lands', () => {
    Object.values(ZoomLevels).forEach((zoomLevel) => {
      const dayWidth = PIXELS_PER_DAY[zoomLevel];

      [0, dayWidth, dayWidth * 4, dayWidth * 37 + dayWidth / 3].forEach((x) => {
        const { startDate, dueDate } = getDropRange(x, viewStart, zoomLevel);

        expect(dueDate.getTime()).toBeGreaterThan(startDate.getTime());
        expect(diffInDays(startDate, dueDate)).toBe(0);
      });
    });
  });

  test('starts where the bar would be drawn', () => {
    Object.values(ZoomLevels).forEach((zoomLevel) => {
      const dayWidth = PIXELS_PER_DAY[zoomLevel];
      const x = dayWidth * 5;

      const { startDate } = getDropRange(x, viewStart, zoomLevel);

      expect(getOffsetX(viewStart, startDate, zoomLevel)).toBeCloseTo(x, 6);
    });
  });
});
