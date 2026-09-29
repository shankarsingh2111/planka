/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import {
  ZoomLevels,
  PIXELS_PER_DAY,
  LANE_HEADER_WIDTH,
  ROW_HEIGHT,
  BAR_HEIGHT,
  ROW_GAP,
  COMPACT_ROW_HEIGHT,
  COMPACT_BAR_HEIGHT,
  LANE_PADDING,
  MIN_LANE_HEIGHT,
  diffInDays,
  startOfDay,
  getUnitWidth,
  getOffsetX,
  getNowOffsetX,
  getItemRange,
  getViewRange,
  getDropRange,
  packRowsWithSeries,
  getBarHeight,
  getRowOffsets,
  getHeaderColumns,
  buildArrowPath,
} from './utils';
import useBarDrag, { DragModes, getDraggedDates } from './use-bar-drag';
import useDropTarget from './use-drop-target';
import findCriticalPath from './find-critical-path';
import Toolbar from './Toolbar';
import Bar from './Bar';
import { formatWeekdays } from '../../card-recurrences/weekdays';

import styles from './TimelineChart.module.scss';

const NOW_TICK_INTERVAL = 60 * 1000;

const DEFAULT_ZOOM_LEVELS = [ZoomLevels.DAY, ZoomLevels.WEEK, ZoomLevels.MONTH];

// Remembered per browser: a view choice rather than something about the board
const REPEATS_COLLAPSED_STORAGE_KEY = 'timeline.isRepeatsCollapsed';

const readIsRepeatsCollapsed = () => {
  try {
    return window.localStorage.getItem(REPEATS_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * The rows of a lane that belong to a recurring series, with what their label in the lane column
 * shows: the name of the series' first card, the weekdays its cards fall on and how many there are.
 */
const getSeriesRows = (entries, rowTops, rowsHeight) => {
  const seriesRowById = {};

  entries.forEach(({ item, range, rowIndex }) => {
    if (!item.seriesId) {
      return;
    }

    const weekday = range.start.getDay();
    const seriesRow = seriesRowById[item.seriesId];

    if (!seriesRow) {
      const nextRowTop = rowIndex + 1 < rowTops.length ? rowTops[rowIndex + 1] : rowsHeight;

      seriesRowById[item.seriesId] = {
        seriesId: item.seriesId,
        top: rowTops[rowIndex],
        height: nextRowTop - rowTops[rowIndex],
        name: item.name,
        start: range.start,
        total: 1,
        weekdays: [weekday],
      };

      return;
    }

    seriesRow.total += 1;

    if (!seriesRow.weekdays.includes(weekday)) {
      seriesRow.weekdays.push(weekday);
    }

    if (range.start < seriesRow.start) {
      seriesRow.start = range.start;
      seriesRow.name = item.name;
    }
  });

  return Object.values(seriesRowById);
};

const TimelineChart = React.memo(
  ({
    items,
    lanes,
    dependencies,
    zoomLevels,
    canEdit,
    externalDragItem,
    zoomLevel: zoomLevelProp,
    collapsedLaneKeys,
    leadingToolbarChildren,
    toolbarActionChildren,
    toolbarChildren,
    unscheduledCount,
    emptyMessage,
    onItemClick,
    onItemDatesChange,
    onItemLaneChange,
    onItemUnschedule,
    onUnscheduleHoverChange,
    onExternalDrop,
    onExternalDragCancel,
    onZoomLevelChange,
    onLaneToggle,
    onDependencyCreate,
    onDependencyDelete,
    onCanvasDoubleClick,
  }) => {
    const [t, i18n] = useTranslation();
    const [internalZoomLevel, setInternalZoomLevel] = useState(zoomLevels[0]);
    const [linking, setLinking] = useState(null);
    const [hoveredItemId, setHoveredItemId] = useState(null);
    const [isCriticalPathShown, setIsCriticalPathShown] = useState(false);
    const [isRepeatsCollapsed, setIsRepeatsCollapsed] = useState(readIsRepeatsCollapsed);
    const [now, setNow] = useState(() => new Date());

    // Keeps the current-time marker moving; a minute is well under a pixel at every zoom level
    useEffect(() => {
      const interval = setInterval(() => setNow(new Date()), NOW_TICK_INTERVAL);
      return () => clearInterval(interval);
    }, []);

    // Optionally controlled: a persisted level is honoured only while it is still on offer, so
    // a stored "quarter" cannot strand the chart when quarter zoom is switched off
    const zoomLevel =
      zoomLevelProp && zoomLevels.includes(zoomLevelProp) ? zoomLevelProp : internalZoomLevel;

    const scrollRef = useRef(null);
    const canvasRef = useRef(null);

    const pixelsPerDay = PIXELS_PER_DAY[zoomLevel];
    const unitWidth = getUnitWidth(zoomLevel);

    const itemById = useMemo(
      () =>
        items.reduce(
          (result, item) => ({
            ...result,
            [item.id]: item,
          }),
          {},
        ),
      [items],
    );

    const rangeById = useMemo(
      () =>
        items.reduce((result, item) => {
          const range = getItemRange(item);

          return range
            ? {
                ...result,
                [item.id]: range,
              }
            : result;
        }, {}),
      [items],
    );

    const { viewStart, totalDays } = useMemo(
      () => getViewRange(Object.values(rangeById), zoomLevel),
      [rangeById, zoomLevel],
    );

    const totalWidth = totalDays * pixelsPerDay;

    const hasSeries = useMemo(() => items.some((item) => item.seriesId), [items]);

    useEffect(() => {
      try {
        window.localStorage.setItem(REPEATS_COLLAPSED_STORAGE_KEY, String(isRepeatsCollapsed));
      } catch {
        // Only a convenience: the choice then lasts until the page is reloaded
      }
    }, [isRepeatsCollapsed]);

    const handleRepeatsCollapseToggle = useCallback(() => {
      setIsRepeatsCollapsed((prevIsRepeatsCollapsed) => !prevIsRepeatsCollapsed);
    }, []);

    // Rows are packed from committed dates only, so bars don't jump between rows mid-drag
    const layout = useMemo(() => {
      let top = 0;

      const laneLayouts = lanes.map((lane) => {
        const isCollapsed = collapsedLaneKeys.includes(lane.key);

        const packed = packRowsWithSeries(
          items
            .filter((item) => rangeById[item.id] && item.laneKeys.includes(lane.key))
            .map((item) => ({
              item,
              range: rangeById[item.id],
            })),
        );

        // A collapsed lane keeps every bar but squashes them onto one row, so it stays a
        // drop target and still shows where its work sits on the scale
        const rowEntries = isCollapsed
          ? packed.map((entry) => ({ ...entry, rowIndex: 0 }))
          : packed.map((entry) =>
              isRepeatsCollapsed && entry.item.seriesId
                ? {
                    ...entry,
                    isCompact: true,
                  }
                : entry,
            );

        const { rowTops, totalHeight: rowsHeight } = getRowOffsets(rowEntries);

        const entries = rowEntries.map((entry) => ({
          ...entry,
          rowTop: rowTops[entry.rowIndex],
        }));

        const height = Math.max(MIN_LANE_HEIGHT, rowsHeight + LANE_PADDING * 2);

        const laneLayout = {
          lane,
          top,
          height,
          entries,
          isCollapsed,
          seriesRows: isCollapsed ? [] : getSeriesRows(entries, rowTops, rowsHeight),
        };

        top += height;
        return laneLayout;
      });

      return {
        lanes: laneLayouts,
        totalHeight: top,
      };
    }, [lanes, items, rangeById, collapsedLaneKeys, isRepeatsCollapsed]);

    const getLaneKeyAtClientY = useCallback(
      (clientY) => {
        if (!canvasRef.current) {
          return null;
        }

        const y = clientY - canvasRef.current.getBoundingClientRect().top;

        const laneLayout = layout.lanes.find(
          (candidate) => y >= candidate.top && y < candidate.top + candidate.height,
        );

        return laneLayout ? laneLayout.lane.key : null;
      },
      [layout],
    );

    const {
      drag,
      handlePointerDown: handleBarPointerDown,
      handlePointerMove: handleBarPointerMove,
      handlePointerUp: handleBarPointerUp,
      handleKeyDown: handleBarKeyDown,
    } = useBarDrag({
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
    });

    /**
     * Resizing drags an edge of the bar itself, so it has to grow and shrink under the cursor.
     * Moving is the one mode that leaves the bar where it is and sends a ghost instead.
     */
    const getRenderRange = useCallback(
      (itemId, committedRange) => {
        if (
          !drag ||
          drag.itemId !== itemId ||
          drag.deltaUnits === 0 ||
          drag.mode === DragModes.MOVE
        ) {
          return committedRange;
        }

        return (
          getItemRange({
            ...itemById[itemId],
            ...getDraggedDates(
              itemById[itemId],
              committedRange,
              drag.mode,
              drag.deltaUnits,
              zoomLevel,
            ),
          }) || committedRange
        );
      },
      [drag, itemById, zoomLevel],
    );

    const bars = useMemo(
      () =>
        layout.lanes.flatMap(({ lane, top, entries }) =>
          entries.map(({ item, rowTop, range: committedRange, isCompact }) => {
            const range = getRenderRange(item.id, committedRange);
            const left = getOffsetX(viewStart, range.start, zoomLevel);
            const width = Math.max(
              getOffsetX(viewStart, range.end, zoomLevel) + unitWidth - left,
              8,
            );

            const rowGap = isCompact ? COMPACT_ROW_HEIGHT - COMPACT_BAR_HEIGHT : ROW_GAP;

            return {
              key: `${lane.key}:${item.id}`,
              item,
              laneKey: lane.key,
              range,
              left,
              width,
              top: top + LANE_PADDING + rowTop + rowGap / 2,
              height: isCompact ? COMPACT_BAR_HEIGHT : getBarHeight(item),
              isCompact: !!isCompact,
            };
          }),
        ),
      [layout, getRenderRange, viewStart, zoomLevel, unitWidth],
    );

    // A collapsed series row gets a strip joining its marks, from the first card to the last
    const seriesTracks = useMemo(() => {
      if (!isRepeatsCollapsed) {
        return [];
      }

      const trackByKey = {};

      bars.forEach(({ item, laneKey, left, width, top, height, isCompact }) => {
        if (!isCompact) {
          return;
        }

        const key = `${laneKey}:${item.seriesId}`;
        const track = trackByKey[key];

        if (!track) {
          trackByKey[key] = {
            key,
            seriesId: item.seriesId,
            left,
            right: left + width,
            top: top + height / 2,
          };

          return;
        }

        track.left = Math.min(track.left, left);
        track.right = Math.max(track.right, left + width);
      });

      return Object.values(trackByKey);
    }, [bars, isRepeatsCollapsed]);

    // Where each card of a series falls in it, for the tooltip
    const seriesPositionById = useMemo(() => {
      const itemIdsBySeriesId = {};

      items.forEach((item) => {
        if (item.seriesId && rangeById[item.id]) {
          itemIdsBySeriesId[item.seriesId] = [...(itemIdsBySeriesId[item.seriesId] || []), item.id];
        }
      });

      const positionById = {};

      Object.values(itemIdsBySeriesId).forEach((itemIds) => {
        itemIds
          .sort((a, b) => rangeById[a].start - rangeById[b].start)
          .forEach((itemId, index) => {
            positionById[itemId] = {
              index: index + 1,
              total: itemIds.length,
            };
          });
      });

      return positionById;
    }, [items, rangeById]);

    /**
     * The bar being dragged stays put and a ghost carries the movement instead, so the original
     * dates remain visible to compare against right up to the drop. The ghost tracks the drag in
     * both axes: sideways for the new dates, and into another lane when the card would change
     * list. Across lanes it sits on the first row, since the real packing only happens on commit.
     * Resizing is excluded — that mode changes the bar in place, see getRenderRange.
     */
    const dragGhost = useMemo(() => {
      if (!drag || drag.mode !== DragModes.MOVE || drag.isOverUnscheduleZone) {
        return null;
      }

      const item = itemById[drag.itemId];
      const committedRange = rangeById[drag.itemId];

      const isLaneChange = !!drag.toLaneKey && drag.toLaneKey !== drag.laneKey;

      if (!item || !committedRange || (drag.deltaUnits === 0 && !isLaneChange)) {
        return null;
      }

      const range = getItemRange({
        ...item,
        ...getDraggedDates(item, committedRange, drag.mode, drag.deltaUnits, zoomLevel),
      });

      const target = layout.lanes.find(
        (candidate) => candidate.lane.key === (isLaneChange ? drag.toLaneKey : drag.laneKey),
      );

      if (!range || !target) {
        return null;
      }

      // Staying in the same lane, the ghost rides the bar's own row so the two line up
      const entry = isLaneChange
        ? null
        : target.entries.find((candidate) => candidate.item.id === drag.itemId);

      const left = getOffsetX(viewStart, range.start, zoomLevel);

      return {
        item,
        range,
        left,
        width: Math.max(getOffsetX(viewStart, range.end, zoomLevel) + unitWidth - left, 8),
        top: target.top + LANE_PADDING + (entry ? entry.rowTop : 0) + ROW_GAP / 2,
        height: getBarHeight(item),
        laneTop: target.top,
        laneHeight: target.height,
        isLaneChange,
      };
    }, [drag, layout, itemById, rangeById, viewStart, zoomLevel, unitWidth]);

    // Arrows attach to the first occurrence of each item (items may sit in several lanes)
    const anchorById = useMemo(
      () =>
        bars.reduce(
          (result, bar) =>
            result[bar.item.id]
              ? result
              : {
                  ...result,
                  [bar.item.id]: bar,
                },
          {},
        ),
      [bars],
    );

    const criticalPath = useMemo(
      () =>
        isCriticalPathShown
          ? findCriticalPath(dependencies, rangeById)
          : { itemIds: new Set(), dependencyIds: new Set() },
      [isCriticalPathShown, dependencies, rangeById],
    );

    const arrows = useMemo(
      () =>
        dependencies.flatMap((dependency) => {
          const from = anchorById[dependency.predecessorId];
          const to = anchorById[dependency.successorId];

          if (!from || !to) {
            return [];
          }

          const startPoint = {
            x: from.left + from.width,
            y: from.top + from.height / 2,
          };

          const endPoint = {
            x: to.left,
            y: to.top + to.height / 2,
          };

          return {
            dependency,
            path: buildArrowPath(startPoint, endPoint),
            midPoint: {
              x: (startPoint.x + endPoint.x) / 2,
              y: (startPoint.y + endPoint.y) / 2,
            },
            isConflict: to.range.start <= from.range.end && !from.item.isCompleted,
            isCritical: criticalPath.dependencyIds.has(dependency.id),
          };
        }),
      [dependencies, anchorById, criticalPath],
    );

    const headerColumns = useMemo(
      () =>
        getHeaderColumns(viewStart, totalDays, zoomLevel, (date, format) =>
          i18n.dateFns.format(date, format),
        ),
      [viewStart, totalDays, zoomLevel, i18n],
    );

    const todayLeft = diffInDays(viewStart, startOfDay(now)) * pixelsPerDay;
    const nowLeft = getNowOffsetX(viewStart, now, zoomLevel);

    const scrollToToday = useCallback(() => {
      if (scrollRef.current) {
        const { clientWidth } = scrollRef.current;
        scrollRef.current.scrollLeft = todayLeft - (clientWidth - LANE_HEADER_WIDTH) / 3;
      }
    }, [todayLeft]);

    useLayoutEffect(() => {
      scrollToToday();
    }, [zoomLevel]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleExternalDrop = useCallback(
      (laneKey, dates) => {
        onExternalDrop(externalDragItem.id, { laneKey, ...dates });
      },
      [externalDragItem, onExternalDrop],
    );

    const dropPreview = useDropTarget({
      isActive: !!externalDragItem && !!onExternalDrop,
      canvasRef,
      viewStart,
      zoomLevel,
      totalWidth,
      layout,
      onDrop: handleExternalDrop,
      onCancel: onExternalDragCancel,
    });

    // Told to the consumer rather than drawn here: the sidebar that shows the card in flight is
    // outside this component
    const unscheduleHoverItemId = drag && drag.isOverUnscheduleZone ? drag.itemId : null;

    useEffect(() => {
      if (onUnscheduleHoverChange) {
        onUnscheduleHoverChange(unscheduleHoverItemId);
      }
    }, [unscheduleHoverItemId, onUnscheduleHoverChange]);

    const handleZoomLevelChange = useCallback(
      (value) => {
        setInternalZoomLevel(value);

        if (onZoomLevelChange) {
          onZoomLevelChange(value);
        }
      },
      [onZoomLevelChange],
    );

    const getCanvasPoint = useCallback((event) => {
      const rect = canvasRef.current.getBoundingClientRect();

      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }, []);

    /* Linking bars */

    const handleLinkPointerDown = useCallback(
      (event, itemId) => {
        if (event.button !== 0) {
          return;
        }

        event.stopPropagation();
        event.preventDefault();

        const point = getCanvasPoint(event);

        setLinking({
          fromId: itemId,
          point,
        });
      },
      [getCanvasPoint],
    );

    useEffect(() => {
      if (!linking) {
        return undefined;
      }

      const handleWindowPointerMove = (event) => {
        const point = getCanvasPoint(event);

        setLinking(
          (prevLinking) =>
            prevLinking && {
              ...prevLinking,
              point,
            },
        );
      };

      const handleWindowPointerUp = (event) => {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const barElement = target && target.closest('[data-timeline-item-id]');

        if (barElement) {
          const toId = barElement.getAttribute('data-timeline-item-id');

          if (toId !== linking.fromId) {
            onDependencyCreate(linking.fromId, toId);
          }
        }

        setLinking(null);
      };

      window.addEventListener('pointermove', handleWindowPointerMove);
      window.addEventListener('pointerup', handleWindowPointerUp);

      return () => {
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
      };
    }, [linking, getCanvasPoint, onDependencyCreate]);

    const linkingFrom = linking && anchorById[linking.fromId];

    /* Creating from empty space */

    /**
     * A double-click on an empty stretch of a lane hands the consumer that lane and the whole
     * working day under the cursor — the same day a card dropped there would get. Bars and the
     * dependency arrows sit on top of the canvas and keep their own meaning.
     */
    const handleCanvasDoubleClick = useCallback(
      (event) => {
        if (event.target.closest('[data-timeline-item-id], svg')) {
          return;
        }

        const laneKey = getLaneKeyAtClientY(event.clientY);

        if (!laneKey) {
          return;
        }

        const { x } = getCanvasPoint(event);

        onCanvasDoubleClick(laneKey, getDropRange(x, viewStart, zoomLevel));
      },
      [getLaneKeyAtClientY, getCanvasPoint, viewStart, zoomLevel, onCanvasDoubleClick],
    );

    /* Rendering */

    const isEditable = canEdit && !!onItemDatesChange;
    const isLinkable = canEdit && !!onDependencyCreate;
    const isCreatable = canEdit && !!onCanvasDoubleClick;

    const hoveredBar = hoveredItemId && !drag && !linking ? anchorById[hoveredItemId] : null;

    // Hovering a card of a series brings out the whole series and fades everything else
    const hoveredSeriesId = hoveredBar ? hoveredBar.item.seriesId || null : null;

    // Weekend columns are shaded with a repeating gradient rather than extra elements
    const backgroundLayers = [];

    if (zoomLevel === ZoomLevels.DAY || zoomLevel === ZoomLevels.WEEK) {
      backgroundLayers.push(
        `repeating-linear-gradient(90deg, transparent 0, transparent ${
          5 * pixelsPerDay
        }px, rgba(9, 30, 66, 0.04) ${5 * pixelsPerDay}px, rgba(9, 30, 66, 0.04) ${
          7 * pixelsPerDay
        }px)`,
      );
    }

    const backgroundStripes =
      backgroundLayers.length > 0 ? { backgroundImage: backgroundLayers.join(', ') } : undefined;

    return (
      <div className={styles.wrapper}>
        <Toolbar
          zoomLevel={zoomLevel}
          zoomLevels={zoomLevels}
          unscheduledCount={unscheduledCount}
          withCriticalPath={dependencies.length > 0}
          isCriticalPathShown={isCriticalPathShown}
          withRepeatsCollapse={hasSeries}
          isRepeatsCollapsed={isRepeatsCollapsed}
          leadingChildren={leadingToolbarChildren}
          actionChildren={toolbarActionChildren}
          onZoomLevelChange={handleZoomLevelChange}
          onScrollToToday={scrollToToday}
          onCriticalPathToggle={() => setIsCriticalPathShown(!isCriticalPathShown)}
          onRepeatsCollapseToggle={handleRepeatsCollapseToggle}
        >
          {toolbarChildren}
        </Toolbar>
        {(isLinkable || isCreatable) && (
          <div className={styles.hint}>
            {[
              isLinkable && t('common.dragFromDotToLinkDependency'),
              isCreatable && t('common.doubleClickToAddCard'),
            ]
              .filter(Boolean)
              .join(' ')}
          </div>
        )}
        <div ref={scrollRef} className={styles.scroll}>
          <div className={styles.inner} style={{ width: LANE_HEADER_WIDTH + totalWidth }}>
            <div className={styles.header}>
              <div className={styles.corner} style={{ width: LANE_HEADER_WIDTH }} />
              <div className={styles.headerScale} style={{ width: totalWidth }}>
                <div className={styles.headerRow}>
                  {headerColumns.top.map((column) => (
                    <div
                      key={column.key}
                      className={styles.headerCell}
                      style={{ left: column.left, width: column.width }}
                    >
                      <span className={styles.headerCellLabelSticky}>{column.label}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.headerRow}>
                  {headerColumns.bottom.map((column) => (
                    <div
                      key={column.key}
                      className={classNames(styles.headerCell, styles.headerCellMinor, {
                        [styles.headerCellCurrent]: column.isCurrent,
                        [styles.headerCellWeekend]: column.isWeekend,
                      })}
                      style={{ left: column.left, width: column.width }}
                    >
                      {column.width >= 18 && column.label}
                    </div>
                  ))}
                </div>
                {headerColumns.hours.length > 0 && (
                  <div className={classNames(styles.headerRow, styles.headerRowHours)}>
                    {headerColumns.hours.map((tick) => (
                      <div
                        key={tick.key}
                        className={classNames(styles.hourCell, {
                          [styles.hourCellDayStart]: tick.isDayStart,
                          [styles.hourCellDayEnd]: tick.isDayEnd,
                        })}
                        style={{ left: tick.left, width: tick.width }}
                      >
                        {tick.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {lanes.length === 0 ? (
              <div className={styles.empty}>{emptyMessage}</div>
            ) : (
              <div className={styles.body}>
                <div className={styles.laneHeaders} style={{ width: LANE_HEADER_WIDTH }}>
                  {layout.lanes.map(({ lane, height, entries, isCollapsed, seriesRows }) => (
                    <div
                      key={lane.key}
                      className={classNames(
                        styles.laneHeader,
                        onLaneToggle && styles.laneHeaderToggleable,
                      )}
                      style={{ height }}
                      {...(onLaneToggle && {
                        role: 'button',
                        tabIndex: 0,
                        onClick: () => onLaneToggle(lane.key),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onLaneToggle(lane.key);
                          }
                        },
                      })}
                    >
                      {onLaneToggle && (
                        <Icon
                          fitted
                          name={isCollapsed ? 'caret right' : 'caret down'}
                          className={styles.laneCaret}
                        />
                      )}
                      {lane.icon}
                      <span className={styles.laneLabel} title={lane.label}>
                        {lane.label}
                      </span>
                      <span className={styles.laneCount}>{entries.length}</span>
                      {seriesRows.map((seriesRow) => (
                        <div
                          key={seriesRow.seriesId}
                          className={classNames(styles.seriesLabel, {
                            [styles.seriesLabelCompact]: seriesRow.height < ROW_HEIGHT,
                            [styles.seriesLabelHighlighted]:
                              seriesRow.seriesId === hoveredSeriesId,
                          })}
                          style={{ top: LANE_PADDING + seriesRow.top, height: seriesRow.height }}
                          title={seriesRow.name}
                        >
                          <Icon name="sync alternate" className={styles.seriesLabelIcon} />
                          <span className={styles.seriesLabelText}>
                            <span className={styles.seriesLabelName}>{seriesRow.name}</span>
                            <span className={styles.seriesLabelMeta}>
                              {formatWeekdays(t, i18n, seriesRow.weekdays)}
                              {' · '}
                              {t('common.cardsInSeries', { count: seriesRow.total })}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div
                  ref={canvasRef}
                  className={classNames(styles.canvas, isCreatable && styles.canvasCreatable)}
                  style={{ width: totalWidth, height: layout.totalHeight, ...backgroundStripes }}
                  onDoubleClick={isCreatable ? handleCanvasDoubleClick : undefined}
                >
                  {headerColumns.bottom.map((column) => (
                    <div
                      key={column.key}
                      className={styles.gridLine}
                      style={{ left: column.left }}
                    />
                  ))}
                  {headerColumns.hours.map((tick) => (
                    <React.Fragment key={tick.key}>
                      <div className={styles.hourLine} style={{ left: tick.left }} />
                      {tick.isDayEnd && (
                        <div className={styles.hourLine} style={{ left: tick.left + tick.width }} />
                      )}
                    </React.Fragment>
                  ))}
                  {layout.lanes.map(({ lane, top, height }) => (
                    <div key={lane.key} className={styles.laneBackground} style={{ top, height }} />
                  ))}
                  {nowLeft >= 0 && nowLeft <= totalWidth && (
                    <div className={styles.todayMarker} style={{ left: nowLeft }} />
                  )}
                  <svg
                    className={styles.arrows}
                    width={totalWidth}
                    height={layout.totalHeight}
                    aria-hidden="true"
                  >
                    <defs>
                      {['default', 'conflict', 'critical'].map((variant) => (
                        <marker
                          key={variant}
                          id={`timeline-arrowhead-${variant}`}
                          viewBox="0 0 10 10"
                          refX="9"
                          refY="5"
                          markerWidth="7"
                          markerHeight="7"
                          orient="auto-start-reverse"
                        >
                          <path
                            d="M 0 0 L 10 5 L 0 10 z"
                            className={styles[`arrowHead${variant}`]}
                          />
                        </marker>
                      ))}
                    </defs>
                    {arrows.map(({ dependency, path, midPoint, isConflict, isCritical }) => {
                      let variant = 'default';
                      if (isCritical) {
                        variant = 'critical';
                      } else if (isConflict) {
                        variant = 'conflict';
                      }

                      return (
                        <g key={dependency.id} className={styles.arrowGroup}>
                          <path
                            d={path}
                            className={classNames(styles.arrow, styles[`arrow${variant}`])}
                            markerEnd={`url(#timeline-arrowhead-${variant})`}
                          />
                          {canEdit && onDependencyDelete && dependency.isPersisted !== false && (
                            <>
                              <path d={path} className={styles.arrowHitArea} />
                              <g
                                className={styles.arrowDelete}
                                transform={`translate(${midPoint.x} ${midPoint.y})`}
                                role="button"
                                tabIndex={0}
                                aria-label={t('common.removeDependency')}
                                onClick={() => onDependencyDelete(dependency.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    onDependencyDelete(dependency.id);
                                  }
                                }}
                              >
                                <circle r="8" />
                                <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" />
                              </g>
                            </>
                          )}
                        </g>
                      );
                    })}
                    {linking && linkingFrom && (
                      <path
                        d={buildArrowPath(
                          {
                            x: linkingFrom.left + linkingFrom.width,
                            y: linkingFrom.top + linkingFrom.height / 2,
                          },
                          linking.point,
                        )}
                        className={classNames(styles.arrow, styles.arrowLinking)}
                      />
                    )}
                  </svg>
                  {seriesTracks.map((track) => (
                    <div
                      key={track.key}
                      className={classNames(styles.seriesTrack, {
                        [styles.seriesTrackHighlighted]: track.seriesId === hoveredSeriesId,
                      })}
                      style={{
                        left: track.left,
                        width: track.right - track.left,
                        top: track.top - 1,
                      }}
                    />
                  ))}
                  {bars.map(({ key, item, laneKey, range, left, width, top, height, isCompact }) => (
                    <Bar
                      key={key}
                      item={item}
                      laneKey={laneKey}
                      range={range}
                      left={left}
                      width={width}
                      top={top}
                      height={height}
                      isCompact={isCompact}
                      isDimmed={!!hoveredSeriesId && item.seriesId !== hoveredSeriesId}
                      isSeriesHighlighted={!!hoveredSeriesId && item.seriesId === hoveredSeriesId}
                      isEditable={isEditable && item.isEditable !== false}
                      isLinkable={isLinkable && item.isEditable !== false}
                      isCritical={criticalPath.itemIds.has(item.id)}
                      isDragging={!!drag && drag.itemId === item.id}
                      onPointerDown={handleBarPointerDown}
                      onPointerMove={handleBarPointerMove}
                      onPointerUp={handleBarPointerUp}
                      onPointerEnter={setHoveredItemId}
                      onPointerLeave={setHoveredItemId}
                      onKeyDown={handleBarKeyDown}
                      onLinkPointerDown={handleLinkPointerDown}
                    />
                  ))}
                  {dragGhost && (
                    <>
                      {dragGhost.isLaneChange && (
                        <div
                          className={styles.dropLane}
                          style={{ top: dragGhost.laneTop, height: dragGhost.laneHeight }}
                        />
                      )}
                      <div
                        className={classNames(styles.ghostBar, dragGhost.item.colorClassName)}
                        style={{
                          left: dragGhost.left,
                          width: dragGhost.width,
                          top: dragGhost.top,
                          height: dragGhost.height,
                        }}
                      >
                        <span className={styles.ghostBarLabel}>{dragGhost.item.name}</span>
                      </div>
                    </>
                  )}
                  {dropPreview && externalDragItem && (
                    <>
                      <div
                        className={styles.dropLane}
                        style={{ top: dropPreview.laneTop, height: dropPreview.laneHeight }}
                      />
                      <div
                        className={styles.dropPreview}
                        style={{
                          left: dropPreview.left,
                          width: dropPreview.width,
                          top: dropPreview.laneTop + LANE_PADDING + (ROW_HEIGHT - BAR_HEIGHT) / 2,
                          height: BAR_HEIGHT,
                        }}
                      >
                        <span className={styles.dropPreviewLabel}>{externalDragItem.name}</span>
                      </div>
                    </>
                  )}
                  {bars.length === 0 && emptyMessage && (
                    <div className={styles.emptyOverlay}>{emptyMessage}</div>
                  )}
                  {hoveredBar && (
                    <div
                      className={styles.tooltip}
                      style={{
                        left: Math.max(0, Math.min(hoveredBar.left, totalWidth - 260)),
                        top: hoveredBar.top + hoveredBar.height + 6,
                      }}
                    >
                      <div className={styles.tooltipTitle}>{hoveredBar.item.name}</div>
                      <div className={styles.tooltipLine}>
                        {hoveredBar.item.startDate &&
                          t('format:longDate', {
                            value: hoveredBar.item.startDate,
                            postProcess: 'formatDate',
                          })}
                        {hoveredBar.item.startDate && hoveredBar.item.dueDate && ' → '}
                        {hoveredBar.item.dueDate &&
                          t('format:longDate', {
                            value: hoveredBar.item.dueDate,
                            postProcess: 'formatDate',
                          })}
                      </div>
                      {hoveredBar.range.isStartMissing && (
                        <div className={styles.tooltipLine}>{t('common.startDateNotSet')}</div>
                      )}
                      {hoveredBar.item.progress && hoveredBar.item.progress.total > 0 && (
                        <div className={styles.tooltipLine}>
                          {t('common.tasksProgress', {
                            completed: hoveredBar.item.progress.completed,
                            total: hoveredBar.item.progress.total,
                          })}
                        </div>
                      )}
                      {seriesPositionById[hoveredBar.item.id] && (
                        <div className={styles.tooltipLine}>
                          {t('common.recurringCard')}
                          {' · '}
                          {t('common.cardOfSeries', seriesPositionById[hoveredBar.item.id])}
                        </div>
                      )}
                      {(hoveredBar.item.details || []).map((detail) => (
                        <div key={detail} className={styles.tooltipLine}>
                          {detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

TimelineChart.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      startDate: PropTypes.instanceOf(Date),
      dueDate: PropTypes.instanceOf(Date),
      laneKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
      colorClassName: PropTypes.string,
      isCompleted: PropTypes.bool,
      isOverdue: PropTypes.bool,
      isEditable: PropTypes.bool,
      seriesId: PropTypes.string,
      progress: PropTypes.shape({
        completed: PropTypes.number.isRequired,
        total: PropTypes.number.isRequired,
      }),
      details: PropTypes.arrayOf(PropTypes.string),
    }),
  ).isRequired,
  lanes: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
    }),
  ).isRequired,
  zoomLevels: PropTypes.arrayOf(PropTypes.oneOf(Object.values(ZoomLevels))),
  dependencies: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      predecessorId: PropTypes.string.isRequired,
      successorId: PropTypes.string.isRequired,
      isPersisted: PropTypes.bool,
    }),
  ),
  canEdit: PropTypes.bool,
  externalDragItem: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }),
  zoomLevel: PropTypes.oneOf(Object.values(ZoomLevels)),
  collapsedLaneKeys: PropTypes.arrayOf(PropTypes.string),
  leadingToolbarChildren: PropTypes.node,
  toolbarActionChildren: PropTypes.node,
  toolbarChildren: PropTypes.node,
  unscheduledCount: PropTypes.number,
  emptyMessage: PropTypes.string,
  onItemClick: PropTypes.func.isRequired,
  onItemDatesChange: PropTypes.func,
  onItemLaneChange: PropTypes.func,
  onItemUnschedule: PropTypes.func,
  onUnscheduleHoverChange: PropTypes.func,
  onExternalDrop: PropTypes.func,
  onExternalDragCancel: PropTypes.func,
  onZoomLevelChange: PropTypes.func,
  onLaneToggle: PropTypes.func,
  onDependencyCreate: PropTypes.func,
  onDependencyDelete: PropTypes.func,
  onCanvasDoubleClick: PropTypes.func,
};

TimelineChart.defaultProps = {
  dependencies: [],
  zoomLevels: DEFAULT_ZOOM_LEVELS,
  canEdit: false,
  externalDragItem: undefined,
  zoomLevel: undefined,
  collapsedLaneKeys: [],
  leadingToolbarChildren: undefined,
  toolbarActionChildren: undefined,
  toolbarChildren: undefined,
  unscheduledCount: 0,
  emptyMessage: undefined,
  onItemDatesChange: undefined,
  onItemLaneChange: undefined,
  onItemUnschedule: undefined,
  onUnscheduleHoverChange: undefined,
  onExternalDrop: undefined,
  onExternalDragCancel: undefined,
  onZoomLevelChange: undefined,
  onLaneToggle: undefined,
  onDependencyCreate: undefined,
  onDependencyDelete: undefined,
  onCanvasDoubleClick: undefined,
};

export default TimelineChart;
