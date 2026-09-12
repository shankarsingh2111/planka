/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {
  ZoomLevels,
  COLUMN_WIDTH,
  SWIMLANE_HEADER_WIDTH,
  addDays,
  isWeekend,
  isSameDay,
  formatShortDate,
  formatMonthYear,
  startOfMonth,
  endOfMonth,
} from './constants';

import styles from './TimelineView.module.scss';

const TimelineHeader = React.memo(
  ({ viewStart, viewEnd, totalDays, totalWidth, zoomLevel }) => {
    const today = new Date();

    const columns = useMemo(() => {
      const cols = [];

      if (zoomLevel === ZoomLevels.DAY) {
        for (let i = 0; i < totalDays; i += 1) {
          const date = addDays(viewStart, i);
          cols.push({
            key: `day-${i}`,
            label: formatShortDate(date),
            isWeekend: isWeekend(date),
            isToday: isSameDay(date, today),
            width: COLUMN_WIDTH[ZoomLevels.DAY],
          });
        }
      } else if (zoomLevel === ZoomLevels.WEEK) {
        const weeks = Math.ceil(totalDays / 7);
        for (let i = 0; i < weeks; i += 1) {
          const weekStart = addDays(viewStart, i * 7);
          const weekEnd = addDays(weekStart, 6);
          const containsToday =
            today >= weekStart && today <= weekEnd;
          cols.push({
            key: `week-${i}`,
            label: `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`,
            isWeekend: false,
            isToday: containsToday,
            width: COLUMN_WIDTH[ZoomLevels.WEEK],
          });
        }
      } else {
        // Month
        let current = startOfMonth(viewStart);
        while (current <= viewEnd) {
          const monthEnd = endOfMonth(current);
          const containsToday =
            today >= current && today <= monthEnd;
          cols.push({
            key: `month-${current.getFullYear()}-${current.getMonth()}`,
            label: formatMonthYear(current),
            isWeekend: false,
            isToday: containsToday,
            width: COLUMN_WIDTH[ZoomLevels.MONTH],
          });
          current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        }
      }

      return cols;
    }, [viewStart, viewEnd, totalDays, zoomLevel, today]);

    return (
      <div className={styles.header}>
        <div
          className={styles.headerSpacer}
          style={{ minWidth: SWIMLANE_HEADER_WIDTH }}
        />
        <div className={styles.headerColumns}>
          {columns.map((col) => (
            <div
              key={col.key}
              className={classNames(styles.headerColumn, {
                [styles.headerColumnWeekend]: col.isWeekend,
                [styles.headerColumnToday]: col.isToday,
              })}
              style={{ width: col.width, minWidth: col.width }}
            >
              <span className={styles.headerColumnLabel}>{col.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

TimelineHeader.propTypes = {
  viewStart: PropTypes.instanceOf(Date).isRequired,
  viewEnd: PropTypes.instanceOf(Date).isRequired,
  totalDays: PropTypes.number.isRequired,
  totalWidth: PropTypes.number.isRequired,
  zoomLevel: PropTypes.string.isRequired,
};

export default TimelineHeader;
