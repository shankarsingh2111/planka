/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router';
import classNames from 'classnames';

import Paths from '../../../../constants/Paths';
import {
  CARD_BAR_HEIGHT,
  CARD_BAR_MARGIN,
  SWIMLANE_HEIGHT,
  getDaysBetween,
  getCardDateRange,
} from './constants';

import styles from './TimelineView.module.scss';

const getStatus = (dueDate) => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const msLeft = due.getTime() - now.getTime();
  const hoursLeft = msLeft / (1000 * 60 * 60);

  if (hoursLeft <= 0) return 'overdue';
  if (hoursLeft <= 24) return 'dueSoon';
  return null;
};

const TimelineCard = React.memo(
  ({ card, rowIndex, viewStart, totalDays, totalWidth }) => {
    const navigate = useNavigate();

    const range = useMemo(() => getCardDateRange(card), [card]);

    const position = useMemo(() => {
      if (!range) return null;

      const startOffset = getDaysBetween(viewStart, range.start);
      const duration = getDaysBetween(range.start, range.end);
      const pixelsPerDay = totalWidth / totalDays;

      const left = startOffset * pixelsPerDay;
      const width = Math.max(duration * pixelsPerDay, 20); // Min 20px

      return { left, width };
    }, [range, viewStart, totalDays, totalWidth]);

    const status = useMemo(() => {
      if (card.isDueCompleted) return 'completed';
      return getStatus(card.dueDate);
    }, [card.dueDate, card.isDueCompleted]);

    const handleClick = useCallback(() => {
      navigate(Paths.CARDS.replace(':id', card.id));
    }, [navigate, card.id]);

    if (!position) return null;

    const isPointMarker = !card.startDate && card.dueDate;
    const top = rowIndex * SWIMLANE_HEIGHT + CARD_BAR_MARGIN;

    return (
      <button
        type="button"
        className={classNames(styles.cardBar, {
          [styles.cardBarOverdue]: status === 'overdue',
          [styles.cardBarDueSoon]: status === 'dueSoon',
          [styles.cardBarCompleted]: status === 'completed',
          [styles.cardBarPoint]: isPointMarker,
        })}
        style={{
          left: position.left,
          width: isPointMarker ? 12 : position.width,
          top,
          height: CARD_BAR_HEIGHT,
        }}
        title={card.name}
        onClick={handleClick}
      >
        {!isPointMarker && (
          <span className={styles.cardBarLabel}>{card.name}</span>
        )}
      </button>
    );
  },
);

TimelineCard.propTypes = {
  card: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  rowIndex: PropTypes.number.isRequired,
  viewStart: PropTypes.instanceOf(Date).isRequired,
  totalDays: PropTypes.number.isRequired,
  totalWidth: PropTypes.number.isRequired,
  zoomLevel: PropTypes.string.isRequired,
};

export default TimelineCard;
