/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import selectors from '../../../../selectors';
import TimelineHeader from './TimelineHeader';
import TimelineSwimlane from './TimelineSwimlane';
import TimelineTodayMarker from './TimelineTodayMarker';
import TimelineControls from './TimelineControls';
import {
  ZoomLevels,
  GroupByOptions,
  COLUMN_WIDTH,
  SWIMLANE_HEADER_WIDTH,
  HEADER_HEIGHT,
  addDays,
  startOfDay,
  getDaysBetween,
  getCardDateRange,
} from './constants';

import styles from './TimelineView.module.scss';

const TimelineView = React.memo(({ cardIds }) => {
  const [t] = useTranslation();
  const [zoomLevel, setZoomLevel] = useState(ZoomLevels.WEEK);
  const [groupBy, setGroupBy] = useState(GroupByOptions.LIST);
  const scrollContainerRef = useRef(null);

  // Selectors
  const cardById = useSelector((state) => {
    const result = {};
    cardIds.forEach((id) => {
      const card = selectors.selectCardById(state, id);
      if (card) result[id] = card;
    });
    return result;
  });

  const listById = useSelector((state) => {
    const lists = {};
    Object.values(cardById).forEach((card) => {
      if (card.listId && !lists[card.listId]) {
        const list = selectors.selectListById(state, card.listId);
        if (list) lists[card.listId] = list;
      }
    });
    return lists;
  });

  // Cards with valid dates
  const scheduledCards = useMemo(
    () =>
      cardIds
        .map((id) => cardById[id])
        .filter((card) => card && (card.startDate || card.dueDate)),
    [cardIds, cardById],
  );

  const unscheduledCount = cardIds.length - scheduledCards.length;

  // Calculate visible date range from card data
  const { viewStart, viewEnd, totalDays } = useMemo(() => {
    if (scheduledCards.length === 0) {
      const today = startOfDay(new Date());
      return {
        viewStart: addDays(today, -14),
        viewEnd: addDays(today, 28),
        totalDays: 42,
      };
    }

    let minDate = Infinity;
    let maxDate = -Infinity;

    scheduledCards.forEach((card) => {
      const range = getCardDateRange(card);
      if (range) {
        if (range.start.getTime() < minDate) minDate = range.start.getTime();
        if (range.end.getTime() > maxDate) maxDate = range.end.getTime();
      }
    });

    const start = addDays(new Date(minDate), -7);
    const end = addDays(new Date(maxDate), 14);
    return {
      viewStart: startOfDay(start),
      viewEnd: startOfDay(end),
      totalDays: getDaysBetween(start, end),
    };
  }, [scheduledCards]);

  // Group cards into swimlanes
  const swimlanes = useMemo(() => {
    const groups = {};

    scheduledCards.forEach((card) => {
      let key;
      let label;

      switch (groupBy) {
        case GroupByOptions.LIST: {
          key = card.listId || 'no-list';
          const list = listById[card.listId];
          label = list ? list.name : t('common.unknown');
          break;
        }
        case GroupByOptions.USER:
          // For user grouping, a card may appear in multiple lanes
          // Simplified: use first user or 'unassigned'
          key = 'unassigned';
          label = t('common.unassigned', { context: 'title' });
          break;
        case GroupByOptions.LABEL:
          key = 'no-label';
          label = t('common.noLabels');
          break;
        default:
          key = 'default';
          label = '';
      }

      if (!groups[key]) {
        groups[key] = { key, label, cards: [] };
      }
      groups[key].cards.push(card);
    });

    return Object.values(groups);
  }, [scheduledCards, groupBy, listById, t]);

  // Scroll to today on mount
  const scrollToToday = useCallback(() => {
    if (scrollContainerRef.current) {
      const today = startOfDay(new Date());
      const dayOffset = getDaysBetween(viewStart, today);
      const colWidth = COLUMN_WIDTH[zoomLevel];

      let pixelOffset;
      if (zoomLevel === ZoomLevels.DAY) {
        pixelOffset = dayOffset * colWidth;
      } else if (zoomLevel === ZoomLevels.WEEK) {
        pixelOffset = (dayOffset / 7) * colWidth;
      } else {
        pixelOffset = (dayOffset / 30) * colWidth;
      }

      scrollContainerRef.current.scrollLeft =
        pixelOffset - scrollContainerRef.current.clientWidth / 2 + SWIMLANE_HEADER_WIDTH;
    }
  }, [viewStart, zoomLevel]);

  useEffect(() => {
    scrollToToday();
  }, [scrollToToday]);

  // Calculate total width
  const totalWidth = useMemo(() => {
    const colWidth = COLUMN_WIDTH[zoomLevel];
    if (zoomLevel === ZoomLevels.DAY) {
      return totalDays * colWidth;
    }
    if (zoomLevel === ZoomLevels.WEEK) {
      return Math.ceil(totalDays / 7) * colWidth;
    }
    // Month
    const months =
      (viewEnd.getFullYear() - viewStart.getFullYear()) * 12 +
      viewEnd.getMonth() -
      viewStart.getMonth() +
      1;
    return months * colWidth;
  }, [totalDays, zoomLevel, viewStart, viewEnd]);

  return (
    <div className={styles.wrapper}>
      <TimelineControls
        zoomLevel={zoomLevel}
        groupBy={groupBy}
        unscheduledCount={unscheduledCount}
        onZoomChange={setZoomLevel}
        onGroupByChange={setGroupBy}
        onTodayClick={scrollToToday}
      />
      <div className={styles.scrollContainer} ref={scrollContainerRef}>
        <div className={styles.timelineBody} style={{ width: totalWidth + SWIMLANE_HEADER_WIDTH }}>
          <TimelineHeader
            viewStart={viewStart}
            viewEnd={viewEnd}
            totalDays={totalDays}
            totalWidth={totalWidth}
            zoomLevel={zoomLevel}
          />
          <div className={styles.swimlanesContainer}>
            <TimelineTodayMarker
              viewStart={viewStart}
              totalDays={totalDays}
              totalWidth={totalWidth}
              zoomLevel={zoomLevel}
              headerHeight={HEADER_HEIGHT}
            />
            {swimlanes.length > 0 ? (
              swimlanes.map((swimlane) => (
                <TimelineSwimlane
                  key={swimlane.key}
                  label={swimlane.label}
                  cards={swimlane.cards}
                  viewStart={viewStart}
                  totalDays={totalDays}
                  totalWidth={totalWidth}
                  zoomLevel={zoomLevel}
                />
              ))
            ) : (
              <div className={styles.emptyState}>
                <span>{t('common.noCardsWithDates')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

TimelineView.propTypes = {
  cardIds: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
};

export default TimelineView;
