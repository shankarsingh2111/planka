/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { LANE_HEADER_WIDTH, shiftByUnits, diffInUnits } from './utils';

export const DragModes = {
  MOVE: 'move',
  RESIZE_START: 'resizeStart',
  RESIZE_END: 'resizeEnd',
};

const DRAG_THRESHOLD = 3;

// Auto-scroll while dragging near an edge of the scroll area. The speed is fixed and time based
// rather than ramping with proximity, so it reads the same on every display and never races off.
const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_SPEED = 360; // px per second

// -1, 0 or 1 per axis for a pointer inside the scroll area. The bands sit just inside the sticky
// lane headers and date header, so a pointer over those (on its way to the sidebar) never scrolls.
export const getAutoScrollDirection = (clientX, clientY, rect, headerHeight) => {
  const isInside =
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;

  if (!isInside) {
    return { x: 0, y: 0 };
  }

  const contentLeft = rect.left + LANE_HEADER_WIDTH;
  const contentTop = rect.top + headerHeight;

  let x = 0;
  if (clientX >= contentLeft && clientX < contentLeft + AUTO_SCROLL_EDGE) {
    x = -1;
  } else if (clientX > rect.right - AUTO_SCROLL_EDGE) {
    x = 1;
  }

  let y = 0;
  if (clientY >= contentTop && clientY < contentTop + AUTO_SCROLL_EDGE) {
    y = -1;
  } else if (clientY > rect.bottom - AUTO_SCROLL_EDGE) {
    y = 1;
  }

  return { x, y };
};

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
 *
 * Holding the pointer near an edge of the scroll area scrolls it at a fixed speed, and the scroll
 * travelled counts towards the drag, so a bar can be carried to lanes and dates off screen.
 */
const useBarDrag = ({
  scrollRef,
  headerRef,
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
        startScrollLeft: scrollRef.current ? scrollRef.current.scrollLeft : 0,
        clientX: event.clientX,
        clientY: event.clientY,
        isDragging: false,
      };

      if (isItemEditable) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [canEdit, onItemDatesChange, itemById, scrollRef],
  );

  // Horizontal travel of the drag: pointer movement plus however far the canvas has scrolled
  const getDeltaX = useCallback(
    (current, clientX) => {
      const scrollLeft = scrollRef.current ? scrollRef.current.scrollLeft : 0;
      return clientX - current.startX + (scrollLeft - current.startScrollLeft);
    },
    [scrollRef],
  );

  const updateDrag = useCallback(() => {
    const { current } = dragRef;

    if (!current || !current.isItemEditable) {
      return;
    }

    const { clientX, clientY } = current;
    const deltaX = getDeltaX(current, clientX);

    if (!current.isDragging && Math.abs(deltaX) < DRAG_THRESHOLD) {
      return;
    }

    current.isDragging = true;

    const deltaUnits = Math.round(deltaX / unitWidth);

    const isMove = current.mode === DragModes.MOVE;

    // Only a whole-bar move can change lanes; resizing an edge stays put
    const toLaneKey = onItemLaneChange && isMove ? getLaneKeyAtClientY(clientY) : null;

    const isOverUnscheduleZone =
      !!onItemUnschedule && isMove && isPointOverUnscheduleZone({ clientX, clientY });

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
  }, [unitWidth, onItemLaneChange, onItemUnschedule, getLaneKeyAtClientY, getDeltaX]);

  const handlePointerMove = useCallback(
    (event) => {
      const { current } = dragRef;

      if (!current) {
        return;
      }

      current.clientX = event.clientX;
      current.clientY = event.clientY;

      updateDrag();
    },
    [updateDrag],
  );

  const isDragging = !!drag;

  // Edge auto-scroll. Runs only once a drag is under way; each frame scrolls by a fixed amount
  // per elapsed millisecond and re-resolves the drag, since scrolling fires no pointer events.
  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    let frameId;
    let lastTime = null;

    const tick = (time) => {
      const { current } = dragRef;
      const scrollElement = scrollRef.current;

      if (current && current.isDragging && scrollElement) {
        const elapsed = lastTime === null ? 0 : Math.min(time - lastTime, 50);

        const direction = getAutoScrollDirection(
          current.clientX,
          current.clientY,
          scrollElement.getBoundingClientRect(),
          headerRef.current ? headerRef.current.offsetHeight : 0,
        );

        // Resizing edits dates only, so it never needs to scroll between lanes
        if (current.mode !== DragModes.MOVE) {
          direction.y = 0;
        }

        if ((direction.x || direction.y) && elapsed > 0) {
          const step = (AUTO_SCROLL_SPEED * elapsed) / 1000;
          const { scrollLeft, scrollTop } = scrollElement;

          scrollElement.scrollLeft += direction.x * step;
          scrollElement.scrollTop += direction.y * step;

          if (scrollElement.scrollLeft !== scrollLeft || scrollElement.scrollTop !== scrollTop) {
            updateDrag();
          }
        }
      }

      lastTime = time;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [isDragging, scrollRef, headerRef, updateDrag]);

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

      const deltaUnits = Math.round(getDeltaX(current, event.clientX) / unitWidth);
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
      getDeltaX,
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
