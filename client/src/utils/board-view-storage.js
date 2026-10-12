/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { BoardViews } from '../constants/Enums';

// The last view picked on a board is remembered in this browser, so the board opens in it again
// instead of in its default view. Private windows may refuse storage, which only means the default.

const buildStorageKey = (boardId) => `boardView:${boardId}`;

const VIEWS = Object.values(BoardViews);

export const readBoardView = (boardId) => {
  try {
    const value = window.localStorage.getItem(buildStorageKey(boardId));
    return VIEWS.includes(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeBoardView = (boardId, view) => {
  try {
    window.localStorage.setItem(buildStorageKey(boardId), view);
  } catch {
    /* empty */
  }
};
