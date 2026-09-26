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
export const LANE_PADDING = 6;
export const MIN_LANE_HEIGHT = ROW_HEIGHT + LANE_PADDING * 2;
export const OPEN_ENDED_DURATION_DAYS = 7;

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

  if (startDate) {
    return {
      start: startDate,
      end: addDays(startDate, OPEN_ENDED_DURATION_DAYS - 1),
      isOpenEnded: true,
    };
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

// Greedy interval packing: places each item in the first row where it doesn't overlap.
// Packing works on whole days, so bars stay clear of each other at every zoom level.
export const packRows = (entries) => {
  const rowEnds = [];

  return entries
    .slice()
    .sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end)
    .map((entry) => {
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
