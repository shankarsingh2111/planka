/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * The create request carries only what was filled in: the API rejects a null date and an empty
 * description on create, and a card starts out without either anyway.
 */
export const buildCardData = ({ type, name, description, startDate, dueDate }) => ({
  type,
  name: name.trim(),
  ...(description && { description }),
  ...(startDate && { startDate }),
  ...(dueDate && { dueDate }),
});

// Mirrors the API rule, which refuses a start after the due date but accepts the two being equal
export const areDatesInOrder = (startDate, dueDate) =>
  !startDate || !dueDate || startDate.getTime() <= dueDate.getTime();
