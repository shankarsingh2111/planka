/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useRef, useState } from 'react';

import { shiftByUnits, diffInUnits } from './utils';

export const DragModes = {
  MOVE: 'move',
  RESIZE_START: 'resizeStart',
  RESIZE_END: 'resizeEnd',
};

const DRAG_THRESHOLD = 3;

const UNSCHEDULE_ZONE_SELECTOR = '[data-timeline-unschedule-zone]';

// Hit test rather than a cached rect, so the zone can move or resize mid-drag without going stale
const isPointOverUnscheduleZone = (event) => {
  const target = document.elementFromPoint(event.clientX, event.clientY);

  return !!target && !!target.closest(UNSCHEDULE_ZONE_SELECTOR);
};

// Applies a drag delta to an item's dates. The unit is a two-hour slot at day zoom and a
// whole day at every other zoom level.
export const getDraggedDates = (item, range, mode, deltaUnits, zoomLevel) => {
  const shift = (date, units) => (date ? shiftByUnits(date, units, zoomLevel) : date);
  const span = diffInUnits(range.start, range.end, zoomLevel);

  // Moving or dragging the start edge works from the start as drawn, which for a due-only item is
  // the beginning of its due day, so either gesture gives it the start date it was missing
  if (mode === DragModes.MOVE) {
    return {
      startDate: shift(range.start, deltaUnits),
      dueDate: shift(item.dueDate, deltaUnits),
    };
  }

  if (mode === DragModes.RESIZE_START) {
    return {
      startDate: shift(range.start, Math.min(deltaUnits, span)),
      dueDate: item.dueDate,
    };
  }

  const delta = Math.max(deltaUnits, -span);

  if (item.dueDate) {
    return {
      startDate: item.startDate,
      dueDate: shift(item.dueDate, delta),
    };
  }

  // Open-ended item: resizing the end commits a real due date
  return {
    startDate: item.startDate,
    dueDate: shift(range.end, delta),
  };
};

/**
 * Pointer handling for moving and resizing bars already on the canvas.
 *
 * A press that never crosses DRAG_THRESHOLD is a click, so the same handlers serve both
 * opening a card and rescheduling it. The in-flight delta is kept in a ref and mirrored into
 * state only when it changes, so a drag re-renders once per unit rather than once per pixel.
 */
const useBarDrag = ({
  zoomLevel,
  unitWidth,
  canEdit,
  itemById,
  rangeById,
  getLaneKeyAtClientY,
  onItemClick,
  onItemDatesChange,
  onItemLaneChange,
  onItemUnschedule,
}) => {
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);

  const handlePointerDown = useCallback(
    (event, itemId, mode) => {
      if (event.button !== 0) {
        return;
      }

      event.stopPropagation();

      const isItemEditable =
        canEdit && !!onItemDatesChange && itemById[itemId].isEditable !== false;

      dragRef.current = {
        itemId,
        mode,
        isItemEditable,
        startX: event.clientX,
        isDragging: false,
      };

      if (isItemEditable) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [canEdit, onItemDatesChange, itemById],
  );

  const handlePointerMove = useCallback(
    (event) => {
      const { current } = dragRef;

      if (!current || !current.isItemEditable) {
        return;
      }

      const deltaX = event.clientX - current.startX;

      if (!current.isDragging && Math.abs(deltaX) < DRAG_THRESHOLD) {
        return;
      }

      current.isDragging = true;

      const deltaUnits = Math.round(deltaX / unitWidth);

      const isMove = current.mode === DragModes.MOVE;

      // Only a whole-bar move can change lanes; resizing an edge stays put
      const toLaneKey = onItemLaneChange && isMove ? getLaneKeyAtClientY(event.clientY) : null;

      const isOverUnscheduleZone = !!onItemUnschedule && isMove && isPointOverUnscheduleZone(event);

      current.toLaneKey = toLaneKey;

      setDrag((prevDrag) =>
        prevDrag &&
        prevDrag.itemId === current.itemId &&
        prevDrag.mode === current.mode &&
        prevDrag.deltaUnits === deltaUnits &&
        prevDrag.toLaneKey === toLaneKey &&
        prevDrag.isOverUnscheduleZone === isOverUnscheduleZone
          ? prevDrag
          : {
              itemId: current.itemId,
              mode: current.mode,
              laneKey: current.laneKey,
              deltaUnits,
              toLaneKey,
              isOverUnscheduleZone,
            },
      );
    },
    [unitWidth, onItemLaneChange, onItemUnschedule, getLaneKeyAtClientY],
  );

  const handlePointerUp = useCallback(
    (event) => {
      const { current } = dragRef;
      dragRef.current = null;

      if (!current) {
        return;
      }

      if (!current.isDragging) {
        setDrag(null);

        if (current.mode === DragModes.MOVE) {
          onItemClick(current.itemId);
        }

        return;
      }

      const deltaUnits = Math.round((event.clientX - current.startX) / unitWidth);
      setDrag(null);

      // Released over the unscheduled sidebar: clear the dates instead of moving the bar
      if (onItemUnschedule && isPointOverUnscheduleZone(event)) {
        onItemUnschedule(current.itemId);
        return;
      }

      const item = itemById[current.itemId];

      const dates =
        deltaUnits === 0
          ? { startDate: item.startDate, dueDate: item.dueDate }
          : getDraggedDates(item, rangeById[current.itemId], current.mode, deltaUnits, zoomLevel);

      // A lane change carries the dates with it, so the drop is a single update either way
      if (
        onItemLaneChange &&
        current.mode === DragModes.MOVE &&
        current.toLaneKey &&
        current.toLaneKey !== current.laneKey
      ) {
        onItemLaneChange(current.itemId, current.toLaneKey, dates);
        return;
      }

      if (deltaUnits !== 0) {
        onItemDatesChange(current.itemId, dates);
      }
    },
    [
      unitWidth,
      zoomLevel,
      itemById,
      rangeById,
      onItemClick,
      onItemDatesChange,
      onItemLaneChange,
      onItemUnschedule,
    ],
  );

  const handleKeyDown = useCallback(
    (event, itemId) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onItemClick(itemId);
      }
    },
    [onItemClick],
  );

  return {
    drag,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
  };
};

export default useBarDrag;
