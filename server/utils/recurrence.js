/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * Date math for recurring cards. A series lives in wall-clock terms of its time zone: dates are
 * "YYYY-MM-DD" and times are "HH:mm", so a card at 4 PM stays at 4 PM on both sides of a
 * daylight saving change. Only card dates are real instants.
 */

// How far ahead of its first remaining date a series may reach
const MAX_SPAN_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const parseDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const formatDate = (ms) => new Date(ms).toISOString().slice(0, 10);

// Rejects dates that don't exist, such as 2026-02-30
const isDate = (value) =>
  typeof value === 'string' && DATE_REGEX.test(value) && formatDate(parseDate(value)) === value;

const isTime = (value) => typeof value === 'string' && TIME_REGEX.test(value);

const isTimeZone = (value) => {
  if (typeof value !== 'string' || !value) {
    return false;
  }

  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-US', { timeZone: value });
  } catch (error) {
    return false;
  }

  return true;
};

// Sunday is 0, as in Date#getDay
const isWeekdays = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 7 &&
  new Set(value).size === value.length &&
  value.every((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6);

const addDays = (date, days) => formatDate(parseDate(date) + days * DAY_MS);

const diffDays = (fromDate, toDate) =>
  Math.round((parseDate(toDate) - parseDate(fromDate)) / DAY_MS);

const getWeekday = (date) => new Date(parseDate(date)).getUTCDay();

const shiftWeekdays = (weekdays, days) =>
  weekdays.map((weekday) => (((weekday + days) % 7) + 7) % 7).sort((a, b) => a - b);

const formatterByTimeZone = new Map();

const getFormatter = (timeZone) => {
  let formatter = formatterByTimeZone.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    formatterByTimeZone.set(timeZone, formatter);
  }

  return formatter;
};

// The wall-clock date and time of an instant in a time zone
const getZonedParts = (instant, timeZone) => {
  const valueByType = getFormatter(timeZone)
    .formatToParts(new Date(instant))
    .reduce(
      (result, { type, value }) => ({
        ...result,
        [type]: value,
      }),
      {},
    );

  return {
    date: `${valueByType.year}-${valueByType.month}-${valueByType.day}`,
    time: `${valueByType.hour}:${valueByType.minute}`,
  };
};

const toWallMs = (date, time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return parseDate(date) + (hours * 60 + minutes) * 60 * 1000;
};

// How far the time zone's wall clock is ahead of UTC at an instant, to the minute
const getOffsetMs = (instantMs, timeZone) => {
  const { date, time } = getZonedParts(instantMs, timeZone);
  const flooredInstantMs = Math.floor(instantMs / (60 * 1000)) * 60 * 1000;

  return toWallMs(date, time) - flooredInstantMs;
};

/**
 * The instant a wall-clock date and time happen in a time zone. A time that happens twice when
 * clocks go back resolves to the first one; a time skipped when clocks go forward resolves
 * forward (02:30 becomes 03:30), as calendar apps do.
 */
const toInstant = (date, time, timeZone) => {
  const wallMs = toWallMs(date, time);

  const offsetBeforeMs = getOffsetMs(wallMs - DAY_MS, timeZone);
  const offsetAfterMs = getOffsetMs(wallMs + DAY_MS, timeZone);

  const candidates = [wallMs - offsetBeforeMs, wallMs - offsetAfterMs].filter((instantMs) => {
    const parts = getZonedParts(instantMs, timeZone);
    return parts.date === date && parts.time === time;
  });

  if (candidates.length === 0) {
    return new Date(wallMs - offsetBeforeMs);
  }

  return new Date(Math.min(...candidates));
};

const getToday = (timeZone, now = new Date()) => getZonedParts(now, timeZone).date;

/**
 * The time pattern of a card: the date it happens on, its wall-clock start and due times, and
 * how many days after that date it is due. A card without a start date happens on its due date.
 */
const getTimePattern = ({ startDate, dueDate }, timeZone) => {
  const due = getZonedParts(dueDate, timeZone);

  if (!startDate) {
    return {
      occurrenceDate: due.date,
      startTime: null,
      dueTime: due.time,
      dueDayOffset: 0,
    };
  }

  const start = getZonedParts(startDate, timeZone);

  return {
    occurrenceDate: start.date,
    startTime: start.time,
    dueTime: due.time,
    dueDayOffset: diffDays(start.date, due.date),
  };
};

// The card dates of the occurrence on a date
const getOccurrenceCardDates = (
  { startTime, dueTime, dueDayOffset, timezone },
  occurrenceDate,
) => ({
  startDate: startTime ? toInstant(occurrenceDate, startTime, timezone) : null,
  dueDate: toInstant(addDays(occurrenceDate, dueDayOffset), dueTime, timezone),
});

/**
 * The dates a series lands on: its weekdays from startsOn (or from, if later) to endsOn, both
 * included, minus the excluded ones.
 */
const buildOccurrenceDates = (
  { weekdays, startsOn, endsOn, excludedDates = [] },
  { from } = {},
) => {
  const weekdaysSet = new Set(weekdays);
  const excludedDatesSet = new Set(excludedDates);

  const dates = [];
  for (
    let date = from && from > startsOn ? from : startsOn;
    date <= endsOn;
    date = addDays(date, 1)
  ) {
    if (weekdaysSet.has(getWeekday(date)) && !excludedDatesSet.has(date)) {
      dates.push(date);
    }
  }

  return dates;
};

module.exports = {
  MAX_SPAN_DAYS,
  isDate,
  isTime,
  isTimeZone,
  isWeekdays,
  addDays,
  diffDays,
  getWeekday,
  shiftWeekdays,
  toInstant,
  getToday,
  getTimePattern,
  getOccurrenceCardDates,
  buildOccurrenceDates,
};
