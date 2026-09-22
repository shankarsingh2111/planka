/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import {
  ZoomLevels,
  PIXELS_PER_DAY,
  LANE_HEADER_WIDTH,
  ROW_HEIGHT,
  BAR_HEIGHT,
  LANE_PADDING,
  MIN_LANE_HEIGHT,
  addDays,
  diffInDays,
  startOfDay,
  getItemRange,
  getViewRange,
  packRows,
  getHeaderColumns,
  buildArrowPath,
} from './utils';
import findCriticalPath from './find-critical-path';

import styles from './TimelineChart.module.scss';

const DragModes = {
  MOVE: 'move',
  RESIZE_START: 'resizeStart',
  RESIZE_END: 'resizeEnd',
};

const DRAG_THRESHOLD = 3;

const shiftDate = (date, days) => (date ? addDays(date, days) : date);

// Applies a day delta to an item's dates according to the drag mode, keeping times of day
const getDraggedDates = (item, range, mode, deltaDays) => {
  if (mode === DragModes.MOVE) {
    return {
      startDate: shiftDate(item.startDate, deltaDays),
      dueDate: shiftDate(item.dueDate, deltaDays),
    };
  }

  if (mode === DragModes.RESIZE_START) {
    const delta = Math.min(deltaDays, diffInDays(range.start, range.end));
    const base = item.startDate || item.dueDate;

    return {
      startDate: addDays(base, delta),
      dueDate: item.dueDate,
    };
  }

  const delta = Math.max(deltaDays, -diffInDays(range.start, range.end));

  if (item.dueDate) {
    return {
      startDate: item.startDate,
      dueDate: addDays(item.dueDate, delta),
    };
  }

  // Open-ended item: resizing the end commits a real due date
  const dueDate = addDays(range.end, delta);
  dueDate.setHours(item.startDate.getHours(), item.startDate.getMinutes(), 0, 0);

  return {
    startDate: item.startDate,
    dueDate,
  };
};

const TimelineChart = React.memo(
  ({
    items,
    lanes,
    dependencies,
    canEdit,
    toolbarChildren,
    unscheduledCount,
    emptyMessage,
    onItemClick,
    onItemDatesChange,
    onDependencyCreate,
    onDependencyDelete,
  }) => {
    const [t, i18n] = useTranslation();
    const [zoomLevel, setZoomLevel] = useState(ZoomLevels.WEEK);
    const [drag, setDrag] = useState(null);
    const [linking, setLinking] = useState(null);
    const [hoveredItemId, setHoveredItemId] = useState(null);
    const [isCriticalPathShown, setIsCriticalPathShown] = useState(false);

    const scrollRef = useRef(null);
    const canvasRef = useRef(null);
    const dragRef = useRef(null);

    const pixelsPerDay = PIXELS_PER_DAY[zoomLevel];

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

    // Rows are packed from committed dates only, so bars don't jump between rows mid-drag
    const layout = useMemo(() => {
      let top = 0;

      const laneLayouts = lanes.map((lane) => {
        const entries = packRows(
          items
            .filter((item) => rangeById[item.id] && item.laneKeys.includes(lane.key))
            .map((item) => ({
              item,
              range: rangeById[item.id],
            })),
        );

        const rowsTotal = entries.reduce((max, entry) => Math.max(max, entry.rowIndex + 1), 0);
        const height = Math.max(MIN_LANE_HEIGHT, rowsTotal * ROW_HEIGHT + LANE_PADDING * 2);

        const laneLayout = {
          lane,
          top,
          height,
          entries,
        };

        top += height;
        return laneLayout;
      });

      return {
        lanes: laneLayouts,
        totalHeight: top,
      };
    }, [lanes, items, rangeById]);

    const getPreviewRange = useCallback(
      (itemId) => {
        const range = rangeById[itemId];

        if (!drag || drag.itemId !== itemId || drag.deltaDays === 0) {
          return range;
        }

        return getItemRange({
          ...itemById[itemId],
          ...getDraggedDates(itemById[itemId], range, drag.mode, drag.deltaDays),
        });
      },
      [drag, rangeById, itemById],
    );

    const bars = useMemo(
      () =>
        layout.lanes.flatMap(({ lane, top, entries }) =>
          entries.map(({ item, rowIndex }) => {
            const range = getPreviewRange(item.id);
            const left = diffInDays(viewStart, range.start) * pixelsPerDay;
            const width = range.isPoint
              ? 14
              : Math.max((diffInDays(range.start, range.end) + 1) * pixelsPerDay, 8);

            return {
              key: `${lane.key}:${item.id}`,
              item,
              range,
              left,
              width,
              top: top + LANE_PADDING + rowIndex * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2,
            };
          }),
        ),
      [layout, getPreviewRange, viewStart, pixelsPerDay],
    );

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
            y: from.top + BAR_HEIGHT / 2,
          };

          const endPoint = {
            x: to.left,
            y: to.top + BAR_HEIGHT / 2,
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

    const todayLeft = diffInDays(viewStart, startOfDay(new Date())) * pixelsPerDay;

    const scrollToToday = useCallback(() => {
      if (scrollRef.current) {
        const { clientWidth } = scrollRef.current;
        scrollRef.current.scrollLeft = todayLeft - (clientWidth - LANE_HEADER_WIDTH) / 3;
      }
    }, [todayLeft]);

    useLayoutEffect(() => {
      scrollToToday();
    }, [zoomLevel]); // eslint-disable-line react-hooks/exhaustive-deps

    const getCanvasPoint = useCallback((event) => {
      const rect = canvasRef.current.getBoundingClientRect();

      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }, []);

    /* Dragging bars */

    const handleBarPointerDown = useCallback(
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

    const handleBarPointerMove = useCallback(
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

        const deltaDays = Math.round(deltaX / pixelsPerDay);

        setDrag((prevDrag) =>
          prevDrag &&
          prevDrag.itemId === current.itemId &&
          prevDrag.mode === current.mode &&
          prevDrag.deltaDays === deltaDays
            ? prevDrag
            : {
                itemId: current.itemId,
                mode: current.mode,
                deltaDays,
              },
        );
      },
      [pixelsPerDay],
    );

    const handleBarPointerUp = useCallback(
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

        const deltaDays = Math.round((event.clientX - current.startX) / pixelsPerDay);
        setDrag(null);

        if (deltaDays !== 0) {
          const item = itemById[current.itemId];

          onItemDatesChange(
            current.itemId,
            getDraggedDates(item, rangeById[current.itemId], current.mode, deltaDays),
          );
        }
      },
      [pixelsPerDay, itemById, rangeById, onItemClick, onItemDatesChange],
    );

    const handleBarKeyDown = useCallback(
      (event, itemId) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onItemClick(itemId);
        }
      },
      [onItemClick],
    );

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

    /* Rendering */

    const isEditable = canEdit && !!onItemDatesChange;
    const isLinkable = canEdit && !!onDependencyCreate;

    const hoveredBar = hoveredItemId && !drag && !linking ? anchorById[hoveredItemId] : null;

    const zoomOptions = [
      { value: ZoomLevels.DAY, text: t('common.day') },
      { value: ZoomLevels.WEEK, text: t('common.week') },
      { value: ZoomLevels.MONTH, text: t('common.month') },
      { value: ZoomLevels.QUARTER, text: t('common.quarter') },
    ];

    const weekendStripes =
      zoomLevel === ZoomLevels.DAY || zoomLevel === ZoomLevels.WEEK
        ? {
            backgroundImage: `repeating-linear-gradient(90deg, transparent 0, transparent ${
              5 * pixelsPerDay
            }px, rgba(9, 30, 66, 0.04) ${5 * pixelsPerDay}px, rgba(9, 30, 66, 0.04) ${
              7 * pixelsPerDay
            }px)`,
          }
        : undefined;

    return (
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <Button.Group size="mini" basic>
              {zoomOptions.map((option) => (
                <Button
                  key={option.value}
                  active={zoomLevel === option.value}
                  onClick={() => setZoomLevel(option.value)}
                >
                  {option.text}
                </Button>
              ))}
            </Button.Group>
            <Button size="mini" basic onClick={scrollToToday}>
              <Icon name="crosshairs" />
              {t('common.today')}
            </Button>
            {dependencies.length > 0 && (
              <Button
                size="mini"
                basic
                active={isCriticalPathShown}
                onClick={() => setIsCriticalPathShown(!isCriticalPathShown)}
              >
                <Icon name="lightning" />
                {t('common.criticalPath')}
              </Button>
            )}
          </div>
          <div className={styles.toolbarGroup}>
            {unscheduledCount > 0 && (
              <span className={styles.unscheduledBadge}>
                <Icon name="calendar times outline" />
                {t('common.unscheduledCards', { count: unscheduledCount })}
              </span>
            )}
            {toolbarChildren}
          </div>
        </div>
        {isLinkable && <div className={styles.hint}>{t('common.dragFromDotToLinkDependency')}</div>}
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
              </div>
            </div>
            {lanes.length === 0 || bars.length === 0 ? (
              <div className={styles.empty}>{emptyMessage}</div>
            ) : (
              <div className={styles.body}>
                <div className={styles.laneHeaders} style={{ width: LANE_HEADER_WIDTH }}>
                  {layout.lanes.map(({ lane, height, entries }) => (
                    <div key={lane.key} className={styles.laneHeader} style={{ height }}>
                      {lane.icon}
                      <span className={styles.laneLabel} title={lane.label}>
                        {lane.label}
                      </span>
                      <span className={styles.laneCount}>{entries.length}</span>
                    </div>
                  ))}
                </div>
                <div
                  ref={canvasRef}
                  className={styles.canvas}
                  style={{ width: totalWidth, height: layout.totalHeight, ...weekendStripes }}
                >
                  {headerColumns.bottom.map((column) => (
                    <div
                      key={column.key}
                      className={styles.gridLine}
                      style={{ left: column.left }}
                    />
                  ))}
                  {layout.lanes.map(({ lane, top, height }) => (
                    <div key={lane.key} className={styles.laneBackground} style={{ top, height }} />
                  ))}
                  {todayLeft >= 0 && todayLeft <= totalWidth && (
                    <div
                      className={styles.todayMarker}
                      style={{ left: todayLeft + pixelsPerDay / 2 }}
                    />
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
                            y: linkingFrom.top + BAR_HEIGHT / 2,
                          },
                          linking.point,
                        )}
                        className={classNames(styles.arrow, styles.arrowLinking)}
                      />
                    )}
                  </svg>
                  {bars.map(({ key, item, range, left, width, top }) => {
                    const isItemEditable = isEditable && item.isEditable !== false;
                    const isItemLinkable = isLinkable && item.isEditable !== false;

                    const progress =
                      item.progress && item.progress.total > 0
                        ? item.progress.completed / item.progress.total
                        : null;

                    return (
                      <div
                        key={key}
                        data-timeline-item-id={item.id}
                        role="button"
                        tabIndex={0}
                        className={classNames(styles.bar, item.colorClassName, {
                          [styles.barPoint]: range.isPoint,
                          [styles.barOpenEnded]: range.isOpenEnded,
                          [styles.barCompleted]: item.isCompleted,
                          [styles.barOverdue]: item.isOverdue,
                          [styles.barCritical]: criticalPath.itemIds.has(item.id),
                          [styles.barDragging]: drag && drag.itemId === item.id,
                          [styles.barEditable]: isItemEditable,
                        })}
                        style={{ left, width, top, height: BAR_HEIGHT }}
                        onPointerDown={(event) =>
                          handleBarPointerDown(event, item.id, DragModes.MOVE)
                        }
                        onPointerMove={handleBarPointerMove}
                        onPointerUp={handleBarPointerUp}
                        onPointerEnter={() => setHoveredItemId(item.id)}
                        onPointerLeave={() => setHoveredItemId(null)}
                        onKeyDown={(event) => handleBarKeyDown(event, item.id)}
                      >
                        {progress !== null && !range.isPoint && (
                          <span
                            className={styles.barProgress}
                            style={{ width: `${progress * 100}%` }}
                          />
                        )}
                        {!range.isPoint && <span className={styles.barLabel}>{item.name}</span>}
                        {isItemEditable && !range.isPoint && (
                          <>
                            <span
                              className={classNames(styles.barHandle, styles.barHandleStart)}
                              onPointerDown={(event) =>
                                handleBarPointerDown(event, item.id, DragModes.RESIZE_START)
                              }
                              onPointerMove={handleBarPointerMove}
                              onPointerUp={handleBarPointerUp}
                            />
                            <span
                              className={classNames(styles.barHandle, styles.barHandleEnd)}
                              onPointerDown={(event) =>
                                handleBarPointerDown(event, item.id, DragModes.RESIZE_END)
                              }
                              onPointerMove={handleBarPointerMove}
                              onPointerUp={handleBarPointerUp}
                            />
                          </>
                        )}
                        {isItemLinkable && (
                          <span
                            className={styles.linkDot}
                            onPointerDown={(event) => handleLinkPointerDown(event, item.id)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {hoveredBar && (
                    <div
                      className={styles.tooltip}
                      style={{
                        left: Math.max(0, Math.min(hoveredBar.left, totalWidth - 260)),
                        top: hoveredBar.top + BAR_HEIGHT + 6,
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
                      {hoveredBar.item.progress && hoveredBar.item.progress.total > 0 && (
                        <div className={styles.tooltipLine}>
                          {t('common.tasksProgress', {
                            completed: hoveredBar.item.progress.completed,
                            total: hoveredBar.item.progress.total,
                          })}
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
  dependencies: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      predecessorId: PropTypes.string.isRequired,
      successorId: PropTypes.string.isRequired,
      isPersisted: PropTypes.bool,
    }),
  ),
  canEdit: PropTypes.bool,
  toolbarChildren: PropTypes.node,
  unscheduledCount: PropTypes.number,
  emptyMessage: PropTypes.string,
  onItemClick: PropTypes.func.isRequired,
  onItemDatesChange: PropTypes.func,
  onDependencyCreate: PropTypes.func,
  onDependencyDelete: PropTypes.func,
};

TimelineChart.defaultProps = {
  dependencies: [],
  canEdit: false,
  toolbarChildren: undefined,
  unscheduledCount: 0,
  emptyMessage: undefined,
  onItemDatesChange: undefined,
  onDependencyCreate: undefined,
  onDependencyDelete: undefined,
};

export default TimelineChart;
