/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useSyncExternalStore } from 'react';

import { BoardContexts, BoardViews } from '../constants/Enums';

// Whether the timeline is expanded: the board tabs shrink into the header and the unscheduled
// sidebar folds to its rail so the chart gets the room. Read by the timeline and by the page frame
// around it, so it lives outside either of them, and is remembered in this browser. Private
// windows may refuse storage, which only means it starts collapsed.

const STORAGE_KEY = 'timelineExpanded';

const listeners = new Set();

const readStored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

let isExpanded = readStored();

export const getIsTimelineExpanded = () => isExpanded;

export const setIsTimelineExpanded = (value) => {
  if (value === isExpanded) {
    return;
  }

  isExpanded = value;

  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* empty */
  }

  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const useTimelineExpanded = () => {
  const value = useSyncExternalStore(subscribe, getIsTimelineExpanded);

  const toggle = useCallback(() => setIsTimelineExpanded(!getIsTimelineExpanded()), []);

  return [value, toggle];
};

// Whether the page frame around `board` should take its expanded shape: only a timeline of the
// board itself expands, so other views and the archive or trash keep the full frame
export const useIsBoardTimelineExpanded = (board) => {
  const [value] = useTimelineExpanded();

  return (
    value && !!board && board.view === BoardViews.TIMELINE && board.context === BoardContexts.BOARD
  );
};
