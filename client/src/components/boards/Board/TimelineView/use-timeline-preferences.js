/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import { readBoardPreferences, writeBoardPreferences, toggleInArray } from './board-preferences';

/**
 * Timeline state that outlives the visit: zoom, grouping and coloring are global to the user,
 * while hidden and collapsed lanes are per board. Writes go straight out — every one of them is
 * a discrete click, and `updateCurrentUser` already updates the store before it reaches the API.
 */
const useTimelinePreferences = (boardId) => {
  const user = useSelector(selectors.selectCurrentUser);
  const dispatch = useDispatch();

  const boardPreferences = useMemo(
    () => readBoardPreferences(user.timelineBoardPreferences, boardId),
    [user.timelineBoardPreferences, boardId],
  );

  const update = useCallback((data) => dispatch(entryActions.updateCurrentUser(data)), [dispatch]);

  const updateForBoard = useCallback(
    (patch) =>
      update({
        timelineBoardPreferences: writeBoardPreferences(user.timelineBoardPreferences, boardId, {
          ...boardPreferences,
          ...patch,
        }),
      }),
    [update, user.timelineBoardPreferences, boardId, boardPreferences],
  );

  const setZoomLevel = useCallback((value) => update({ timelineZoomLevel: value }), [update]);
  const setGroupBy = useCallback((value) => update({ timelineGroupBy: value }), [update]);
  const setColorBy = useCallback((value) => update({ timelineColorBy: value }), [update]);

  const setIsSidebarOpened = useCallback(
    (value) => update({ timelineSidebarOpened: value }),
    [update],
  );

  const getHiddenLaneKeys = useCallback(
    (groupBy) => boardPreferences.hiddenLaneKeys[groupBy] || [],
    [boardPreferences],
  );

  const toggleLaneHidden = useCallback(
    (groupBy, laneKey) =>
      updateForBoard({
        hiddenLaneKeys: {
          ...boardPreferences.hiddenLaneKeys,
          [groupBy]: toggleInArray(getHiddenLaneKeys(groupBy), laneKey),
        },
      }),
    [updateForBoard, boardPreferences, getHiddenLaneKeys],
  );

  const showAllLanes = useCallback(
    (groupBy) =>
      updateForBoard({
        hiddenLaneKeys: {
          ...boardPreferences.hiddenLaneKeys,
          [groupBy]: [],
        },
      }),
    [updateForBoard, boardPreferences],
  );

  const toggleLaneCollapsed = useCallback(
    (laneKey) =>
      updateForBoard({
        collapsedLaneKeys: toggleInArray(boardPreferences.collapsedLaneKeys, laneKey),
      }),
    [updateForBoard, boardPreferences],
  );

  return {
    zoomLevel: user.timelineZoomLevel,
    groupBy: user.timelineGroupBy,
    colorBy: user.timelineColorBy,
    isSidebarOpened: user.timelineSidebarOpened,
    collapsedLaneKeys: boardPreferences.collapsedLaneKeys,
    getHiddenLaneKeys,
    setZoomLevel,
    setGroupBy,
    setColorBy,
    setIsSidebarOpened,
    toggleLaneHidden,
    showAllLanes,
    toggleLaneCollapsed,
  };
};

export default useTimelinePreferences;
