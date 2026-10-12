/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Moves the item belonging to the logged in user to the front, keeping the rest in order.
export const putCurrentUserFirst = (items, currentUserId, getUserId = (item) => item) => {
  const index = items.findIndex((item) => getUserId(item) === currentUserId);

  if (index <= 0) {
    return items;
  }

  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
};

export default {
  putCurrentUserFirst,
};
