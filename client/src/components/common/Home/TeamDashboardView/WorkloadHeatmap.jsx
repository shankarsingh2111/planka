/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import styles from './TeamDashboardView.module.scss';

const WEEKS_BEFORE = 1;
const WEEKS_AFTER = 8;
const OPEN_ENDED_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const UNASSIGNED_KEY = '__unassigned__';

const getLevel = (count) => {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
};

const getWorkRange = ({ startDate, dueDate }) => {
  if (startDate && dueDate) {
    return { start: startDate, end: dueDate };
  }

  if (dueDate) {
    return { start: dueDate, end: dueDate };
  }

  if (startDate) {
    return { start: startDate, end: new Date(startDate.getTime() + OPEN_ENDED_DAYS * MS_PER_DAY) };
  }

  return null;
};

const WorkloadHeatmap = React.memo(({ entries, userById }) => {
  const [t] = useTranslation();

  const weeks = useMemo(() => {
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    const result = [];
    for (let i = -WEEKS_BEFORE; i < WEEKS_AFTER; i += 1) {
      const start = new Date(monday);
      start.setDate(monday.getDate() + i * 7);

      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      result.push({ start, end, isCurrent: i === 0 });
    }

    return result;
  }, []);

  const rows = useMemo(() => {
    const rowByKey = {};

    const getRow = (key, label) => {
      if (!rowByKey[key]) {
        rowByKey[key] = {
          key,
          label,
          cells: weeks.map(() => []),
        };
      }

      return rowByKey[key];
    };

    entries.forEach((entry) => {
      if (entry.isDone) {
        return;
      }

      const range = getWorkRange(entry.card);

      if (!range) {
        return;
      }

      const rowTargets =
        entry.userIds.length > 0
          ? entry.userIds.flatMap((userId) =>
              userById[userId] ? getRow(userId, userById[userId].name) : [],
            )
          : [getRow(UNASSIGNED_KEY, t('common.unassigned_title'))];

      weeks.forEach((week, weekIndex) => {
        if (range.start < week.end && range.end >= week.start) {
          rowTargets.forEach((row) => {
            row.cells[weekIndex].push(entry.card.name);
          });
        }
      });
    });

    return Object.values(rowByKey).sort((a, b) => {
      if (a.key === UNASSIGNED_KEY) return 1;
      if (b.key === UNASSIGNED_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [entries, weeks, userById, t]);

  if (rows.length === 0) {
    return <div className={styles.emptyPanel}>{t('common.noCardsWithDates')}</div>;
  }

  return (
    <div className={styles.heatmapPanel}>
      <div className={styles.heatmapScroll}>
        <table className={styles.heatmap}>
          <thead>
            <tr>
              <th className={styles.heatmapCorner}>{t('common.members')}</th>
              {weeks.map((week) => (
                <th
                  key={week.start.getTime()}
                  className={classNames(styles.heatmapWeek, {
                    [styles.heatmapWeekCurrent]: week.isCurrent,
                  })}
                >
                  {t('format:longDate', { value: week.start, postProcess: 'formatDate' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th className={styles.heatmapMember}>{row.label}</th>
                {row.cells.map((cardNames, index) => (
                  <td
                    key={weeks[index].start.getTime()}
                    className={classNames(
                      styles.heatmapCell,
                      styles[`heatmapLevel${getLevel(cardNames.length)}`],
                    )}
                    title={cardNames.join('\n')}
                  >
                    {cardNames.length > 0 ? cardNames.length : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.heatmapLegend}>
        <span>{t('common.less')}</span>
        {[0, 1, 2, 3].map((level) => (
          <span
            key={level}
            className={classNames(styles.heatmapLegendSwatch, styles[`heatmapLevel${level}`])}
          />
        ))}
        <span>{t('common.more')}</span>
        <span className={styles.heatmapLegendHint}>{t('common.workloadLegendHint')}</span>
      </div>
    </div>
  );
});

WorkloadHeatmap.propTypes = {
  entries: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  userById: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
};

export default WorkloadHeatmap;
