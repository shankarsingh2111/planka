/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * Reading and writing the per-board half of the timeline preferences, kept free of store access
 * so the pruning rules can be tested on their own.
 */

const EMPTY_BOARD_PREFERENCES = {
  hiddenLaneKeys: {},
  collapsedLaneKeys: [],
};

export const readBoardPreferences = (boardPreferences, boardId) => {
  const stored = (boardPreferences || {})[boardId];

  if (!stored) {
    return EMPTY_BOARD_PREFERENCES;
  }

  return {
    hiddenLaneKeys: stored.hiddenLaneKeys || {},
    collapsedLaneKeys: stored.collapsedLaneKeys || [],
  };
};

const isEmptyBoardPreferences = ({ hiddenLaneKeys, collapsedLaneKeys }) =>
  collapsedLaneKeys.length === 0 &&
  Object.values(hiddenLaneKeys).every((keys) => !keys || keys.length === 0);

/**
 * Replaces one board's entry, dropping it entirely once nothing is hidden or collapsed, so the
 * stored map only ever holds boards the user has actually customised.
 */
export const writeBoardPreferences = (boardPreferences, boardId, nextForBoard) => {
  const result = { ...(boardPreferences || {}) };

  if (isEmptyBoardPreferences(nextForBoard)) {
    delete result[boardId];
  } else {
    result[boardId] = nextForBoard;
  }

  return result;
};

export const toggleInArray = (values, value) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
