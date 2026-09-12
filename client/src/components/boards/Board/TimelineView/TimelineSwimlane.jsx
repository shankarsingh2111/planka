/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';

import TimelineCard from './TimelineCard';
import { SWIMLANE_HEADER_WIDTH, SWIMLANE_HEIGHT, CARD_BAR_MARGIN } from './constants';

import styles from './TimelineView.module.scss';

const TimelineSwimlane = React.memo(
  ({ label, cards, viewStart, totalDays, totalWidth, zoomLevel }) => {
    // Calculate row count: for now just stack cards vertically
    const rowCount = Math.max(1, cards.length);
    const height = rowCount * (SWIMLANE_HEIGHT) + CARD_BAR_MARGIN;

    return (
      <div className={styles.swimlane} style={{ minHeight: height }}>
        <div
          className={styles.swimlaneHeader}
          style={{ minWidth: SWIMLANE_HEADER_WIDTH, maxWidth: SWIMLANE_HEADER_WIDTH }}
        >
          <span className={styles.swimlaneLabel}>{label}</span>
          <span className={styles.swimlaneCount}>{cards.length}</span>
        </div>
        <div className={styles.swimlaneBody} style={{ width: totalWidth }}>
          {cards.map((card, index) => (
            <TimelineCard
              key={card.id}
              card={card}
              rowIndex={index}
              viewStart={viewStart}
              totalDays={totalDays}
              totalWidth={totalWidth}
              zoomLevel={zoomLevel}
            />
          ))}
        </div>
      </div>
    );
  },
);

TimelineSwimlane.propTypes = {
  label: PropTypes.string.isRequired,
  cards: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  viewStart: PropTypes.instanceOf(Date).isRequired,
  totalDays: PropTypes.number.isRequired,
  totalWidth: PropTypes.number.isRequired,
  zoomLevel: PropTypes.string.isRequired,
};

export default TimelineSwimlane;
