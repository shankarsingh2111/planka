/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Zoom level configurations
export const ZoomLevels = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
};

export const GroupByOptions = {
  LIST: 'list',
  USER: 'user',
  LABEL: 'label',
};

// Pixel width per unit for each zoom level
export const COLUMN_WIDTH = {
  [ZoomLevels.DAY]: 40,
  [ZoomLevels.WEEK]: 120,
  [ZoomLevels.MONTH]: 160,
};

// Swimlane row height
export const SWIMLANE_HEIGHT = 48;
export const SWIMLANE_HEADER_WIDTH = 200;
export const CARD_BAR_HEIGHT = 32;
export const CARD_BAR_MARGIN = 4;
export const HEADER_HEIGHT = 56;

// Helpers

export const getDaysBetween = (startDate, endDate) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
};

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const startOfWeek = (date) => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const startOfMonth = (date) => {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const endOfMonth = (date) => {
  const result = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
};

export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const isSameDay = (date1, date2) =>
  date1.getFullYear() === date2.getFullYear() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getDate() === date2.getDate();

export const formatShortDate = (date) => {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

export const formatMonthYear = (date) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const getCardDateRange = (card) => {
  const start = card.startDate ? new Date(card.startDate) : null;
  const end = card.dueDate ? new Date(card.dueDate) : null;

  if (start && end) {
    return { start: startOfDay(start), end: startOfDay(end) };
  }
  if (end) {
    // Point marker: single day
    return { start: startOfDay(end), end: startOfDay(end) };
  }
  if (start) {
    // Open-ended: show 7 days from start
    return { start: startOfDay(start), end: addDays(startOfDay(start), 7) };
  }
  return null;
};
