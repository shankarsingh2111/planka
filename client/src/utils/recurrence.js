/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * Local-date helpers for recurring cards. A series is made in the browser's time zone, so the
 * dates shown before saving match the ones the server creates. Weekdays count from Sunday as 0.
 */

// How far ahead of its first date a series may reach, as the server allows
export const MAX_SPAN_DAYS = 366;

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const WORKING_DAYS = [1, 2, 3, 4, 5];

export const getTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  return result;
};

// Moves by calendar days, so a daylight saving change doesn't shift the time of day
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  return result;
};

const pad = (number) => String(number).padStart(2, '0');

export const toDateString = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const fromDateString = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// The day a series of the card starts on: the card's own day, or today if that is already past
export const getSeriesStartDate = ({ startDate, dueDate }, now = new Date()) => {
  const date = startOfDay(startDate || dueDate);
  const today = startOfDay(now);

  return date > today ? date : today;
};

export const getMaxEndDate = (seriesStartDate) => addDays(seriesStartDate, MAX_SPAN_DAYS);

// The days a series lands on between two dates, both included
export const buildOccurrenceDates = (weekdays, fromDate, toDate) => {
  const weekdaysSet = new Set(weekdays);
  const lastDate = startOfDay(toDate);

  const dates = [];
  for (let date = startOfDay(fromDate); date <= lastDate; date = addDays(date, 1)) {
    if (weekdaysSet.has(date.getDay())) {
      dates.push(date);
    }
  }

  return dates;
};

// Weekdays in the order the locale starts its week with
export const sortWeekdays = (weekdays, weekStartsOn = 0) =>
  [...weekdays].sort((a, b) => ((a - weekStartsOn + 7) % 7) - ((b - weekStartsOn + 7) % 7));

export const isSameWeekdays = (a, b) =>
  a.length === b.length && a.every((weekday) => b.includes(weekday));
