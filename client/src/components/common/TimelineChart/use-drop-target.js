/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { AUTO_SCROLL_SPEED, getAutoScrollDirection } from './use-bar-drag';
import { LANE_HEADER_WIDTH, getDropRange } from './utils';

/**
 * Drag session for a card coming from outside the canvas.
 *
 * The gesture starts elsewhere (the unscheduled sidebar), so this listens on the window rather
 * than taking pointer capture. The drop lands on the row under the cursor, the chart laying the
 * lane out around it, and is always the whole day under the cursor — how far the
 * pointer travelled on the way there does not lengthen it — and releasing commits it to the lane
 * underneath. Duration is set afterwards by resizing the bar.
 *
 * A drop only counts over the dates actually on screen. The canvas runs on off-screen to the left
 * once scrolled, so without this a pointer resting over the sidebar or the lane headers would map
 * onto hidden dates and a card dropped back where it started would be scheduled there.
 *
 * The canvas scrolls itself near its right, top and bottom edges while a card is in flight, but
 * never towards the left: the drag starts over the sidebar, so on its way in the pointer crosses
 * the left band, which would drag the dates out from under the cursor. A pointer pushed onto the
 * date header or past the top, right or bottom edge counts as over the nearest visible column or
 * row, so releasing it out there still drops the card where the preview shows it.
 */
// Whether a point lies over the visible dates: inside the scroll area, right of the sticky lane
// headers and below the sticky date header
export const isPointOverVisibleCanvas = (clientX, clientY, scrollRect, headerHeight) =>
  clientX >= scrollRect.left + LANE_HEADER_WIDTH &&
  clientX <= scrollRect.right &&
  clientY >= scrollRect.top + headerHeight &&
  clientY <= scrollRect.bottom;

// Pulls a point pushed onto the date header or past the top, right or bottom edge of the scroll
// area back onto the visible dates, so the drop resolves against the column or row at that edge.
// The left is left alone: a point over the sidebar or lane headers is not a drop.
export const clampToScrollArea = (clientX, clientY, scrollRect, headerHeight) => ({
  clientX: Math.min(clientX, scrollRect.right - 1),
  clientY: Math.min(Math.max(clientY, scrollRect.top + headerHeight), scrollRect.bottom - 1),
});

const useDropTarget = ({
  isActive,
  scrollRef,
  headerRef,
  canvasRef,
  viewStart,
  zoomLevel,
  totalWidth,
  getDropSlotAtClientY,
  onDrop,
  onCancel,
}) => {
  const [preview, setPreview] = useState(null);

  const pointerRef = useRef(null);
  const previewRef = useRef(null);

  const resolve = useCallback(() => {
    const pointer = pointerRef.current;

    if (!pointer || !canvasRef.current || !scrollRef.current) {
      return;
    }

    const scrollRect = scrollRef.current.getBoundingClientRect();
    const headerHeight = headerRef.current ? headerRef.current.offsetHeight : 0;

    const { clientX, clientY } = clampToScrollArea(
      pointer.clientX,
      pointer.clientY,
      scrollRect,
      headerHeight,
    );

    const isOverVisibleCanvas = isPointOverVisibleCanvas(
      clientX,
      clientY,
      scrollRect,
      headerHeight,
    );

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;

    const slot = isOverVisibleCanvas ? getDropSlotAtClientY(clientY) : null;

    if (!slot || x < 0 || x > totalWidth) {
      previewRef.current = null;
      setPreview(null);

      return;
    }

    const next = {
      laneKey: slot.laneKey,
      targetRow: slot.targetRow,
      ...getDropRange(x, viewStart, zoomLevel),
    };

    previewRef.current = next;

    setPreview((prevPreview) =>
      prevPreview &&
      prevPreview.laneKey === next.laneKey &&
      prevPreview.targetRow === next.targetRow &&
      prevPreview.startDate.getTime() === next.startDate.getTime()
        ? prevPreview
        : next,
    );
  }, [scrollRef, headerRef, canvasRef, getDropSlotAtClientY, totalWidth, viewStart, zoomLevel]);

  useEffect(() => {
    if (!isActive) {
      pointerRef.current = null;
      previewRef.current = null;
      setPreview(null);

      return undefined;
    }

    const handlePointerMove = (event) => {
      pointerRef.current = { clientX: event.clientX, clientY: event.clientY };
      resolve();
    };

    const handlePointerUp = () => {
      const committed = previewRef.current;

      if (committed) {
        onDrop(committed.laneKey, {
          startDate: committed.startDate,
          dueDate: committed.dueDate,
        });
      } else {
        onCancel();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        previewRef.current = null;
        onCancel();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, resolve, onDrop, onCancel]);

  // Edge auto-scroll, as for a bar being moved, except that it never scrolls left. Each frame
  // re-resolves the drop, since scrolling fires no pointer events.
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    let frameId;
    let lastTime = null;

    const tick = (time) => {
      const pointer = pointerRef.current;
      const scrollElement = scrollRef.current;

      if (pointer && scrollElement) {
        const elapsed = lastTime === null ? 0 : Math.min(time - lastTime, 50);

        const scrollRect = scrollElement.getBoundingClientRect();

        const direction = getAutoScrollDirection(
          pointer.clientX,
          pointer.clientY,
          scrollRect,
          headerRef.current ? headerRef.current.offsetHeight : 0,
        );

        // Still over the sidebar it came from, the card scrolls nothing
        if (pointer.clientX < scrollRect.left) {
          direction.y = 0;
        }

        direction.x = Math.max(direction.x, 0);

        if ((direction.x || direction.y) && elapsed > 0) {
          const step = (AUTO_SCROLL_SPEED * elapsed) / 1000;
          const { scrollLeft, scrollTop } = scrollElement;

          scrollElement.scrollLeft += direction.x * step;
          scrollElement.scrollTop += direction.y * step;

          if (scrollElement.scrollLeft !== scrollLeft || scrollElement.scrollTop !== scrollTop) {
            resolve();
          }
        }
      }

      lastTime = time;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [isActive, scrollRef, headerRef, resolve]);

  // Derived rather than returned straight from state: the effect that clears `preview` only runs
  // after the render in which `isActive` went false, and a caller reading a stale preview against
  // a dragged item that is already gone would blow up
  return isActive ? preview : null;
};

export default useDropTarget;
