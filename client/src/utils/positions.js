/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import isUndefined from 'lodash/isUndefined';

import Config from '../constants/Config';

export const nextPosition = (items, index, excludedId) => {
  const filteredItems = isUndefined(excludedId)
    ? items
    : items.filter((item) => item.id !== excludedId);

  if (isUndefined(index)) {
    const lastItem = filteredItems[filteredItems.length - 1];
    return (lastItem ? lastItem.position : 0) + Config.POSITION_GAP;
  }

  const prevItem = filteredItems[index - 1];
  const nextItem = filteredItems[index];

  const prevPosition = prevItem ? prevItem.position : 0;

  if (!nextItem) {
    return prevPosition + Config.POSITION_GAP;
  }

  return prevPosition + (nextItem.position - prevPosition) / 2;
};

// A position between named neighbours rather than at an index: the caller only sees some of the
// list (a timeline lane hides unscheduled and filtered-out cards), so it says which cards the item
// goes between and the full list decides the number
export const getPositionBetween = (items, { beforeId, afterId }, excludedId) => {
  const filteredItems = items.filter((item) => item.id !== excludedId);

  const beforeIndex = beforeId ? filteredItems.findIndex((item) => item.id === beforeId) : -1;

  if (beforeIndex !== -1) {
    return nextPosition(filteredItems, beforeIndex);
  }

  const afterIndex = afterId ? filteredItems.findIndex((item) => item.id === afterId) : -1;

  return nextPosition(filteredItems, afterIndex !== -1 ? afterIndex + 1 : undefined);
};
