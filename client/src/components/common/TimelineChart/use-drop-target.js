/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { PIXELS_PER_DAY, getDropRange } from './utils';

/**
 * Drag session for a card coming from outside the canvas.
 *
 * The gesture starts elsewhere (the unscheduled sidebar), so this listens on the window rather
 * than taking pointer capture. The drop is always the whole day under the cursor — how far the
 * pointer travelled on the way there does not lengthen it — and releasing commits it to the lane
 * underneath. Duration is set afterwards by resizing the bar.
 *
 * The canvas deliberately does not scroll itself while a card is in flight: the drag starts over
 * the sidebar, well to the left of the scroll area, so any edge-proximity rule fires immediately
 * and drags the dates out from under the cursor. Scroll to the dates you want first, then drag.
 */
const useDropTarget = ({
  isActive,
  canvasRef,
  viewStart,
  zoomLevel,
  totalWidth,
  layout,
  onDrop,
  onCancel,
}) => {
  const [preview, setPreview] = useState(null);

  const pointerRef = useRef(null);
  const previewRef = useRef(null);

  const resolve = useCallback(() => {
    const pointer = pointerRef.current;

    if (!pointer || !canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = pointer.clientX - rect.left;
    const y = pointer.clientY - rect.top;

    const laneLayout = layout.lanes.find(
      (candidate) => y >= candidate.top && y < candidate.top + candidate.height,
    );

    if (!laneLayout || x < 0 || x > totalWidth) {
      previewRef.current = null;
      setPreview(null);

      return;
    }

    // A whole day wide, so the ghost matches the dates the drop will actually commit
    const dayWidth = PIXELS_PER_DAY[zoomLevel];

    const next = {
      laneKey: laneLayout.lane.key,
      laneTop: laneLayout.top,
      laneHeight: laneLayout.height,
      left: Math.floor(x / dayWidth) * dayWidth,
      width: dayWidth,
      ...getDropRange(x, viewStart, zoomLevel),
    };

    previewRef.current = next;

    setPreview((prevPreview) =>
      prevPreview &&
      prevPreview.laneKey === next.laneKey &&
      prevPreview.left === next.left &&
      prevPreview.width === next.width
        ? prevPreview
        : next,
    );
  }, [canvasRef, layout, totalWidth, viewStart, zoomLevel]);

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

  // Derived rather than returned straight from state: the effect that clears `preview` only runs
  // after the render in which `isActive` went false, and a caller reading a stale preview against
  // a dragged item that is already gone would blow up
  return isActive ? preview : null;
};

export default useDropTarget;
