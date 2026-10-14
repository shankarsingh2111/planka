/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

export const ZoomLevels = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
};

export const getZoomLevels = (withQuarter) =>
  withQuarter
    ? [ZoomLevels.DAY, ZoomLevels.WEEK, ZoomLevels.MONTH, ZoomLevels.QUARTER]
    : [ZoomLevels.DAY, ZoomLevels.WEEK, ZoomLevels.MONTH];

// A single continuous scale per zoom level, so bars, headers, markers and arrows all agree
export const PIXELS_PER_DAY = {
  [ZoomLevels.DAY]: 144,
  [ZoomLevels.WEEK]: 18,
  [ZoomLevels.MONTH]: 6,
  [ZoomLevels.QUARTER]: 2.5,
};

// At day zoom a column spans the working day only (9 AM to 9 PM), split into blocks of
// HOUR_TICK_STEP hours, so the whole column width is the six slots 9, 11, 1, 3, 5, 7
export const WORK_DAY_START_HOUR = 9;
export const WORK_DAY_END_HOUR = 21;
export const HOUR_TICK_STEP = 2;
export const WORK_DAY_HOURS = WORK_DAY_END_HOUR - WORK_DAY_START_HOUR;
export const SLOTS_PER_DAY = WORK_DAY_HOURS / HOUR_TICK_STEP;

export const LANE_HEADER_WIDTH = 220;
export const ROW_HEIGHT = 36;
export const BAR_HEIGHT = 26;
// A card with members gets a second line under its name for their avatars
export const BAR_WITH_AVATARS_HEIGHT = 44;
export const ROW_GAP = ROW_HEIGHT - BAR_HEIGHT;
// A collapsed series row: a thin strip with a mark per card
export const COMPACT_ROW_HEIGHT = 20;
export const COMPACT_BAR_HEIGHT = 10;
export const LANE_PADDING = 6;
export const MIN_LANE_HEIGHT = ROW_HEIGHT + LANE_PADDING * 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Calendar-day difference, robust to DST shifts
export const diffInDays = (from, to) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);

export const startOfWeek = (date) => {
  const result = startOfDay(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1)); // Monday start
  return result;
};

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

export const startOfQuarter = (date) =>
  new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);

export const addMonths = (date, months) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// Which of the day's slots a time falls in, clamped to the working day
export const getSlotOfDay = (date) => {
  const hour = date.getHours() + date.getMinutes() / 60;

  if (hour <= WORK_DAY_START_HOUR) {
    return 0;
  }

  if (hour >= WORK_DAY_END_HOUR) {
    return SLOTS_PER_DAY - 1;
  }

  return Math.floor((hour - WORK_DAY_START_HOUR) / HOUR_TICK_STEP);
};

// Moves a date by whole slots, rolling over to the next/previous working day
export const addSlots = (date, deltaSlots) => {
  const total = getSlotOfDay(date) + deltaSlots;
  const dayShift = Math.floor(total / SLOTS_PER_DAY);
  const slot = total - dayShift * SLOTS_PER_DAY;

  const result = addDays(startOfDay(date), dayShift);
  result.setHours(WORK_DAY_START_HOUR + slot * HOUR_TICK_STEP, 0, 0, 0);

  return result;
};

// How far through the working day a time is, from 0 at 9 AM to 1 at 9 PM, pinned at both ends
export const getWorkDayProgress = (date) => {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  return Math.min(Math.max((hour - WORK_DAY_START_HOUR) / WORK_DAY_HOURS, 0), 1);
};

// X offset of the current time: continuous within the working day, unlike getOffsetX which snaps
export const getNowOffsetX = (viewStart, now, zoomLevel) =>
  (diffInDays(viewStart, now) + getWorkDayProgress(now)) * PIXELS_PER_DAY[zoomLevel];

export const diffInSlots = (from, to) =>
  diffInDays(from, to) * SLOTS_PER_DAY + getSlotOfDay(to) - getSlotOfDay(from);

// Day zoom snaps to slots, every other zoom level snaps to whole days
export const isSlotZoom = (zoomLevel) => zoomLevel === ZoomLevels.DAY;

export const getUnitWidth = (zoomLevel) =>
  isSlotZoom(zoomLevel) ? PIXELS_PER_DAY[zoomLevel] / SLOTS_PER_DAY : PIXELS_PER_DAY[zoomLevel];

export const shiftByUnits = (date, units, zoomLevel) =>
  isSlotZoom(zoomLevel) ? addSlots(date, units) : addDays(date, units);

export const diffInUnits = (from, to, zoomLevel) =>
  isSlotZoom(zoomLevel) ? diffInSlots(from, to) : diffInDays(from, to);

// X offset of a date, to the slot at day zoom and to the day elsewhere
export const getOffsetX = (viewStart, date, zoomLevel) => {
  const pixelsPerDay = PIXELS_PER_DAY[zoomLevel];
  const dayOffset = diffInDays(viewStart, date) * pixelsPerDay;

  return isSlotZoom(zoomLevel)
    ? dayOffset + getSlotOfDay(date) * getUnitWidth(zoomLevel)
    : dayOffset;
};

// Inverse of getOffsetX: the date at the start of the unit an x offset falls in. Day zoom lands
// on the slot's hour, coarser zoom levels on the start of the working day.
export const getDateAtOffsetX = (viewStart, x, zoomLevel) => {
  const unitIndex = Math.floor(x / getUnitWidth(zoomLevel));

  if (!isSlotZoom(zoomLevel)) {
    const result = addDays(startOfDay(viewStart), unitIndex);
    result.setHours(WORK_DAY_START_HOUR, 0, 0, 0);

    return result;
  }

  const dayIndex = Math.floor(unitIndex / SLOTS_PER_DAY);
  const slot = unitIndex - dayIndex * SLOTS_PER_DAY;

  const result = addDays(startOfDay(viewStart), dayIndex);
  result.setHours(WORK_DAY_START_HOUR + slot * HOUR_TICK_STEP, 0, 0, 0);

  return result;
};

/**
 * Dates for a card dropped onto the canvas at an x offset: always the whole working day it lands
 * on, at every zoom level. Day zoom snaps to the day rather than to the two-hour slot under the
 * cursor, since a dropped card is scheduled work, not a two-hour appointment. Narrower or longer
 * spans are set afterwards by resizing the bar.
 */
export const getDropRange = (x, viewStart, zoomLevel) => {
  const startDate = startOfDay(getDateAtOffsetX(viewStart, x, zoomLevel));
  startDate.setHours(WORK_DAY_START_HOUR, 0, 0, 0);

  const dueDate = startOfDay(startDate);
  dueDate.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

  return { startDate, dueDate };
};

// Inclusive range [start, end] for an item, or null when it has no dates. Times of day are
// kept so day zoom can place bars on slots; coarser zoom levels round to days when drawing.
export const getItemRange = ({ startDate, dueDate }) => {
  if (startDate && dueDate) {
    return { start: startDate, end: dueDate };
  }

  // Due-only: drawn over the whole working day it is due on, flagged so the bar can show that
  // its start is still to be set
  if (dueDate) {
    const start = startOfDay(dueDate);
    start.setHours(WORK_DAY_START_HOUR, 0, 0, 0);

    const end = startOfDay(dueDate);
    end.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

    return { start, end, isStartMissing: true };
  }

  // Start-only: drawn over a working day's worth of slots from the one it starts in, rolling over
  // to the next working day when it starts late, and flagged so the bar can show that its end is
  // still to be set. The end is the slot drawn last; one in the last slot of a day says 9 PM,
  // like a due-only or dropped card's.
  if (startDate) {
    const end = addSlots(startDate, SLOTS_PER_DAY - 1);

    if (getSlotOfDay(end) === SLOTS_PER_DAY - 1) {
      end.setHours(WORK_DAY_END_HOUR, 0, 0, 0);
    }

    return { start: startDate, end, isOpenEnded: true };
  }

  return null;
};

export const getViewRange = (ranges, zoomLevel) => {
  const today = startOfDay(new Date());

  let min = addDays(today, -14);
  let max = addDays(today, 42);

  ranges.forEach(({ start, end }) => {
    if (start < min) min = start;
    if (end > max) max = end;
  });

  min = addDays(min, -7);
  max = addDays(max, 21);

  // Align to column boundaries so weekend stripes and headers line up with the scale
  let viewStart;
  if (zoomLevel === ZoomLevels.DAY || zoomLevel === ZoomLevels.WEEK) {
    viewStart = startOfWeek(min);
  } else if (zoomLevel === ZoomLevels.MONTH) {
    viewStart = startOfMonth(min);
  } else {
    viewStart = startOfQuarter(min);
  }

  return {
    viewStart,
    totalDays: diffInDays(viewStart, max) + 1,
  };
};

/**
 * Packs completed cards on rows of their own under the open ones, so a closed card never sits
 * among (or claims a row above) work still to do. `pack` must return its entries in the order it
 * was given them; so does this.
 */
const packOpenFirst = (entries, pack) => {
  const openIndexes = [];
  const completedIndexes = [];

  entries.forEach(({ item }, index) => {
    (item && item.isCompleted ? completedIndexes : openIndexes).push(index);
  });

  if (openIndexes.length === 0 || completedIndexes.length === 0) {
    return pack(entries);
  }

  const openPacked = pack(openIndexes.map((index) => entries[index]));
  const completedPacked = pack(completedIndexes.map((index) => entries[index]));
  const openRowCount = openPacked.reduce((max, { rowIndex }) => Math.max(max, rowIndex + 1), 0);

  const result = [];

  openPacked.forEach((entry, position) => {
    result[openIndexes[position]] = entry;
  });

  completedPacked.forEach((entry, position) => {
    result[completedIndexes[position]] = {
      ...entry,
      rowIndex: entry.rowIndex + openRowCount,
    };
  });

  return result;
};

const sortByStart = (entries) =>
  entries.slice().sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);

const packByStart = (entries) => {
  const rowEnds = [];

  return entries.map((entry) => {
    const start = startOfDay(entry.range.start);
    const end = startOfDay(entry.range.end);

    let rowIndex = rowEnds.findIndex((rowEnd) => rowEnd < start);

    if (rowIndex === -1) {
      rowIndex = rowEnds.length;
      rowEnds.push(end);
    } else {
      rowEnds[rowIndex] = end;
    }

    return {
      ...entry,
      rowIndex,
    };
  });
};

// Greedy interval packing: places each item in the first row where it doesn't overlap.
// Packing works on whole days, so bars stay clear of each other at every zoom level.
// Completed cards go on rows under the open ones. Entries come back sorted by start.
export const packRows = (entries) => packOpenFirst(sortByStart(entries), packByStart);

// Whole-day overlap, matching packRows: a bar ending on the day another starts still collides
const overlapsAny = (intervals, start, end) =>
  intervals.some((interval) => !(interval.end < start || interval.start > end));

const packFirstFit = (entries) => {
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

// First fit in the order given: each entry takes the topmost row it does not collide with, so
// whatever comes first in the sequence gets first claim on the upper rows. Completed cards go on
// rows under the open ones. Entries come back in the order given.
export const packInSequence = (entries) => packOpenFirst(entries, packFirstFit);

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

const packOthersByDefault = (entries) =>
  isOrdered(entries) ? packRowsByOrder(entries) : packRows(entries);

/**
 * Packs a lane's cards with `packOthers` (order-aware when every card has an order, by start date
 * otherwise), except that the cards of each recurring series get a row of their own under the
 * lane's other cards, in the order the series start. A series then reads as one line, and never
 * splits across rows or pushes other cards around. A lane holding only series keeps its first row
 * free, since the lane's name sits there in the column beside it.
 */
export const packRowsWithSeries = (entries, packOthers = packOthersByDefault) => {
  const packed = packOthers(entries.filter(({ item }) => !item.seriesId));
  const seriesEntries = entries.filter(({ item }) => item.seriesId);

  if (seriesEntries.length === 0) {
    return packed;
  }

  const firstRowIndex = Math.max(1, ...packed.map(({ rowIndex }) => rowIndex + 1));

  const startBySeriesId = {};
  seriesEntries.forEach(({ item, range }) => {
    const start = range.start.getTime();

    if (!(item.seriesId in startBySeriesId) || start < startBySeriesId[item.seriesId]) {
      startBySeriesId[item.seriesId] = start;
    }
  });

  const rowIndexBySeriesId = {};
  Object.keys(startBySeriesId)
    .sort((a, b) => startBySeriesId[a] - startBySeriesId[b] || a.localeCompare(b))
    .forEach((seriesId, index) => {
      rowIndexBySeriesId[seriesId] = firstRowIndex + index;
    });

  return [
    ...packed,
    ...seriesEntries.map((entry) => ({
      ...entry,
      rowIndex: rowIndexBySeriesId[entry.item.seriesId],
    })),
  ];
};

export const hasAvatars = (item) => !!item.memberIds && item.memberIds.length > 0;

export const getBarHeight = (item) => (hasAvatars(item) ? BAR_WITH_AVATARS_HEIGHT : BAR_HEIGHT);

// Each row is as tall as its tallest bar, so only rows holding cards with members take the
// extra space, and a collapsed series row takes less. Returns the offset of every row from the
// top of the lane's content.
export const getRowOffsets = (entries) => {
  const rowHeights = [];

  entries.forEach(({ item, rowIndex, isCompact }) => {
    const height = isCompact
      ? COMPACT_ROW_HEIGHT
      : Math.max(ROW_HEIGHT, getBarHeight(item) + ROW_GAP);

    rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] || 0, height);
  });

  const rowTops = [];
  let totalHeight = 0;

  for (let rowIndex = 0; rowIndex < rowHeights.length; rowIndex += 1) {
    rowTops.push(totalHeight);
    totalHeight += rowHeights[rowIndex] || ROW_HEIGHT;
  }

  return {
    rowTops,
    totalHeight,
  };
};

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

export const getHeaderColumns = (viewStart, totalDays, zoomLevel, formatDate) => {
  const pixelsPerDay = PIXELS_PER_DAY[zoomLevel];
  const viewEnd = addDays(viewStart, totalDays);
  const today = startOfDay(new Date());

  const top = [];
  const bottom = [];
  const hours = [];

  const pushColumn = (columns, start, end, label, extra = {}) => {
    const from = start < viewStart ? viewStart : start;
    const to = end > viewEnd ? viewEnd : end;

    if (to <= from) {
      return;
    }

    columns.push({
      key: `${start.getTime()}`,
      label,
      left: diffInDays(viewStart, from) * pixelsPerDay,
      width: diffInDays(from, to) * pixelsPerDay,
      isCurrent: today >= start && today < end,
      ...extra,
    });
  };

  if (zoomLevel === ZoomLevels.QUARTER) {
    for (let date = startOfQuarter(viewStart); date < viewEnd; date = addMonths(date, 12)) {
      const year = new Date(date.getFullYear(), 0, 1);
      pushColumn(top, year, new Date(date.getFullYear() + 1, 0, 1), `${date.getFullYear()}`);
    }

    for (let date = startOfQuarter(viewStart); date < viewEnd; date = addMonths(date, 3)) {
      pushColumn(bottom, date, addMonths(date, 3), `Q${Math.floor(date.getMonth() / 3) + 1}`);
    }
  } else {
    for (let date = startOfMonth(viewStart); date < viewEnd; date = addMonths(date, 1)) {
      pushColumn(top, date, addMonths(date, 1), formatDate(date, 'LLLL yyyy'));
    }

    if (zoomLevel === ZoomLevels.DAY) {
      const hourWidth = pixelsPerDay / WORK_DAY_HOURS;

      for (let date = viewStart; date < viewEnd; date = addDays(date, 1)) {
        pushColumn(bottom, date, addDays(date, 1), formatDate(date, 'EEE d'), {
          isWeekend: isWeekend(date),
        });

        const dayLeft = diffInDays(viewStart, date) * pixelsPerDay;

        for (let hour = WORK_DAY_START_HOUR; hour < WORK_DAY_END_HOUR; hour += HOUR_TICK_STEP) {
          const at = new Date(date);
          at.setHours(hour, 0, 0, 0);

          hours.push({
            key: `${at.getTime()}`,
            label: formatDate(at, 'h'),
            left: dayLeft + (hour - WORK_DAY_START_HOUR) * hourWidth,
            width: HOUR_TICK_STEP * hourWidth,
            startHour: hour,
            isDayStart: hour === WORK_DAY_START_HOUR,
            isDayEnd: hour + HOUR_TICK_STEP >= WORK_DAY_END_HOUR,
          });
        }
      }
    } else if (zoomLevel === ZoomLevels.WEEK) {
      for (let date = viewStart; date < viewEnd; date = addDays(date, 7)) {
        pushColumn(bottom, date, addDays(date, 7), formatDate(date, 'd MMM'));
      }
    } else {
      top.splice(0, top.length);

      for (let year = viewStart.getFullYear(); year <= viewEnd.getFullYear(); year += 1) {
        pushColumn(top, new Date(year, 0, 1), new Date(year + 1, 0, 1), `${year}`);
      }

      for (let date = startOfMonth(viewStart); date < viewEnd; date = addMonths(date, 1)) {
        pushColumn(bottom, date, addMonths(date, 1), formatDate(date, 'MMM'));
      }
    }
  }

  return { top, bottom, hours };
};

// Cubic Bézier from the predecessor's end to the successor's start, detouring when the
// successor starts before the predecessor ends
export const buildArrowPath = (from, to) => {
  const startX = from.x;
  const startY = from.y;
  const endX = to.x;
  const endY = to.y;

  const offset = Math.max(16, Math.min(60, Math.abs(endX - startX) / 2));

  return `M ${startX} ${startY} C ${startX + offset} ${startY}, ${endX - offset} ${endY}, ${endX} ${endY}`;
};
