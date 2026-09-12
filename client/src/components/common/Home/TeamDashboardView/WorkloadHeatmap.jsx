/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import selectors from '../../../../selectors';

import styles from './TeamDashboardView.module.scss';

const WorkloadHeatmap = React.memo(({ cards }) => {
  const [t] = useTranslation();

  // Get unique users from card memberships
  // For now, group by board as a proxy until we have full membership data
  const heatmapData = useMemo(() => {
    const now = new Date();
    const weeks = [];
    for (let i = -1; i < 5; i += 1) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 + i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      weeks.push({ start: weekStart, end: weekEnd });
    }

    // Group cards by board
    const boardGroups = {};
    cards.forEach((card) => {
      if (!boardGroups[card.boardId]) {
        boardGroups[card.boardId] = { boardId: card.boardId, cards: [] };
      }
      boardGroups[card.boardId].cards.push(card);
    });

    // Build heatmap: boards × weeks
    const rows = Object.values(boardGroups).map((group) => {
      const weekCounts = weeks.map((week) => {
        const count = group.cards.filter((card) => {
          const dueDate = card.dueDate ? new Date(card.dueDate) : null;
          const startDate = card.startDate ? new Date(card.startDate) : null;

          // Card is "in" this week if its date range overlaps
          if (startDate && dueDate) {
            return startDate <= week.end && dueDate >= week.start;
          }
          if (dueDate) {
            return dueDate >= week.start && dueDate <= week.end;
          }
          return false;
        }).length;
        return count;
      });

      return {
        label: `Board ${group.boardId.slice(-4)}`,
        weekCounts,
      };
    });

    return { weeks, rows };
  }, [cards]);

  const getIntensityClass = (count) => {
    if (count === 0) return styles.heatmapCellEmpty;
    if (count <= 2) return styles.heatmapCellLow;
    if (count <= 4) return styles.heatmapCellMedium;
    return styles.heatmapCellHigh;
  };

  const formatWeekLabel = (week) => {
    const month = week.start.toLocaleDateString('en-US', { month: 'short' });
    return `${month} ${week.start.getDate()}`;
  };

  return (
    <div className={styles.heatmapWrapper}>
      <div className={styles.heatmapTable}>
        {/* Header */}
        <div className={styles.heatmapRow}>
          <div className={styles.heatmapLabel} />
          {heatmapData.weeks.map((week, i) => (
            <div key={`header-${i}`} className={styles.heatmapColumnHeader}>
              {formatWeekLabel(week)}
            </div>
          ))}
        </div>
        {/* Rows */}
        {heatmapData.rows.map((row) => (
          <div key={row.label} className={styles.heatmapRow}>
            <div className={styles.heatmapLabel}>{row.label}</div>
            {row.weekCounts.map((count, i) => (
              <div
                key={`${row.label}-${i}`}
                className={`${styles.heatmapCell} ${getIntensityClass(count)}`}
                title={`${count} cards`}
              >
                {count > 0 && count}
              </div>
            ))}
          </div>
        ))}
        {heatmapData.rows.length === 0 && (
          <div className={styles.heatmapEmpty}>{t('common.noData')}</div>
        )}
      </div>
      <div className={styles.heatmapLegend}>
        <span className={styles.heatmapLegendLabel}>{t('common.less')}</span>
        <div className={`${styles.heatmapCell} ${styles.heatmapCellEmpty}`} />
        <div className={`${styles.heatmapCell} ${styles.heatmapCellLow}`} />
        <div className={`${styles.heatmapCell} ${styles.heatmapCellMedium}`} />
        <div className={`${styles.heatmapCell} ${styles.heatmapCellHigh}`} />
        <span className={styles.heatmapLegendLabel}>{t('common.more')}</span>
      </div>
    </div>
  );
});

WorkloadHeatmap.propTypes = {
  cards: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
};

export default WorkloadHeatmap;
