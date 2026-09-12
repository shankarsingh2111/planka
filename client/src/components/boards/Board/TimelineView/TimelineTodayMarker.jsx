/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import {
  ZoomLevels,
  SWIMLANE_HEADER_WIDTH,
  getDaysBetween,
  startOfDay,
} from './constants';

import styles from './TimelineView.module.scss';

const TimelineTodayMarker = React.memo(
  ({ viewStart, totalDays, totalWidth, zoomLevel, headerHeight }) => {
    const today = startOfDay(new Date());

    const leftPosition = useMemo(() => {
      const dayOffset = getDaysBetween(viewStart, today);
      if (dayOffset < 0 || dayOffset > totalDays) return null;

      const pixelsPerDay = totalWidth / totalDays;
      return SWIMLANE_HEADER_WIDTH + dayOffset * pixelsPerDay;
    }, [viewStart, today, totalDays, totalWidth]);

    if (leftPosition === null) return null;

    return (
      <div
        className={styles.todayMarker}
        style={{
          left: leftPosition,
          top: 0,
          bottom: 0,
        }}
      >
        <div className={styles.todayMarkerDot} />
      </div>
    );
  },
);

TimelineTodayMarker.propTypes = {
  viewStart: PropTypes.instanceOf(Date).isRequired,
  totalDays: PropTypes.number.isRequired,
  totalWidth: PropTypes.number.isRequired,
  zoomLevel: PropTypes.string.isRequired,
  headerHeight: PropTypes.number.isRequired,
};

export default TimelineTodayMarker;
