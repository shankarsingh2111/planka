/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { GroupByOptions, NO_VALUE_KEY } from './constants';

/**
 * What the Add Card dialog opens with after a double-click on a lane: the day's dates always,
 * plus whatever the lane stands for. A list lane names the list; a member or label lane is
 * pre-selected on the card, which then goes to the default list. The unassigned and no-labels
 * lanes stand for nothing, so they add nothing.
 */
// eslint-disable-next-line import/prefer-default-export
export const getAddCardDefaults = (groupBy, laneKey, { startDate, dueDate }, defaultListId) => {
  const isValueLane = laneKey !== NO_VALUE_KEY;

  return {
    listId: groupBy === GroupByOptions.LIST ? laneKey : defaultListId,
    userIds: groupBy === GroupByOptions.MEMBER && isValueLane ? [laneKey] : [],
    labelIds: groupBy === GroupByOptions.LABEL && isValueLane ? [laneKey] : [],
    startDate,
    dueDate,
  };
};
