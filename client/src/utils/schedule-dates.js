/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// How long a card runs, or 0 when it is missing a date or its dates are out of order
const getSpan = ({ startDate, dueDate }) =>
  startDate && dueDate ? Math.max(dueDate.getTime() - startDate.getTime(), 0) : 0;

/**
 * The update for setting a card's start date. The server refuses a start after the due date, so a
 * start moved past it takes the due date along, keeping the time the card runs for.
 */
export const buildStartDateUpdate = (card, startDate) => {
  if (!startDate || !card.dueDate || startDate <= card.dueDate) {
    return { startDate };
  }

  return {
    startDate,
    dueDate: new Date(startDate.getTime() + getSpan(card)),
  };
};

/**
 * The update for setting a card's due date. The server refuses a due date before the start, so a
 * due date moved ahead of it takes the start along, keeping the time the card runs for.
 */
export const buildDueDateUpdate = (card, dueDate) => {
  if (!dueDate || !card.startDate || dueDate >= card.startDate) {
    return { dueDate };
  }

  return {
    startDate: new Date(dueDate.getTime() - getSpan(card)),
    dueDate,
  };
};
