/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import {
  LANE_PADDING,
  MIN_LANE_HEIGHT,
  getRowOffsets,
  packRowsByOrder,
  packRowsWithSeries,
  resolveOrderedDrop,
  sortByOrder,
} from './utils';

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

const getRowCount = (packed) =>
  packed.reduce((max, { rowIndex }) => Math.max(max, rowIndex + 1), 0);

/**
 * Lanes laid out as rows of bars, top to bottom.
 *
 * `placement` is a card in flight, `{ item, range, laneKey, targetRow }`. It is taken out of every
 * lane and put back as a placeholder entry: with a numeric `targetRow`, into `laneKey` at the
 * place in the order that lands it on that row (`placementResult` then names its new neighbours);
 * with `targetRow: null`, into each lane it already belongs to, at its own order, with the new
 * range — a drag that only changes dates. `excludeItemId` takes a card out without putting it back.
 */
const buildLayout = ({
  lanes,
  items,
  rangeById,
  collapsedLaneKeys,
  isRepeatsCollapsed,
  placement = null,
  excludeItemId = null,
}) => {
  const removedItemId = placement ? placement.item.id : excludeItemId;
  let placementResult = null;
  let top = 0;

  const laneLayouts = lanes.map((lane) => {
    const isCollapsed = collapsedLaneKeys.includes(lane.key);

    const laneEntries = items
      .filter(
        (item) =>
          item.id !== removedItemId && rangeById[item.id] && item.laneKeys.includes(lane.key),
      )
      .map((item) => ({
        item,
        range: rangeById[item.id],
      }));

    const isPlacedHere =
      !!placement &&
      (placement.targetRow === null
        ? placement.item.laneKeys.includes(lane.key)
        : placement.laneKey === lane.key);

    let packed;

    if (!isPlacedHere) {
      packed = packRowsWithSeries(laneEntries);
    } else {
      const placedEntry = {
        item: placement.item,
        range: placement.range,
        isPlaceholder: true,
      };

      const isOrderedDrop =
        placement.targetRow !== null && !isCollapsed && !placement.item.seriesId;

      if (isOrderedDrop) {
        const others = sortByOrder(laneEntries.filter(({ item }) => !item.seriesId));

        const isOwnLane = placement.item.laneKeys.includes(lane.key);

        const originalIndex = isOwnLane
          ? others.filter(({ item }) => item.order < placement.item.order).length
          : others.length;

        // Held below every row the lane already has: it goes last, whatever it fits beside
        const preferredIndex =
          placement.targetRow >= getRowCount(packRowsByOrder(others))
            ? others.length
            : originalIndex;

        const resolved = resolveOrderedDrop(
          others,
          placedEntry,
          placement.targetRow,
          preferredIndex,
        );

        placementResult = {
          beforeItemId: resolved.beforeItemId,
          afterItemId: resolved.afterItemId,
          isReordered: !isOwnLane || resolved.index !== originalIndex,
        };

        packed = packRowsWithSeries([...laneEntries, placedEntry], () => resolved.packed);
      } else {
        packed = packRowsWithSeries([...laneEntries, placedEntry]);
      }
    }

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
      rowTops,
      rowsHeight,
      seriesRows: isCollapsed ? [] : getSeriesRows(entries, rowTops, rowsHeight),
    };

    top += height;
    return laneLayout;
  });

  return {
    lanes: laneLayouts,
    totalHeight: top,
    placementResult,
  };
};

export default buildLayout;
