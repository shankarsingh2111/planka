/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { Statuses } from './build-dashboard-model';

import styles from './TeamDashboardView.module.scss';

const PAGE_SIZE = 50;

const byDateAsc = (getDate) => (a, b) => {
  const aDate = getDate(a);
  const bDate = getDate(b);

  if (aDate && bDate) {
    return aDate - bDate;
  }

  return aDate ? -1 : bDate ? 1 : 0; // eslint-disable-line no-nested-ternary
};

const COLUMNS = [
  {
    status: Statuses.ACTIVE,
    titleKey: 'common.inProgress',
    icon: 'sync alternate',
    className: 'columnActive',
    sort: byDateAsc((entry) => entry.card.dueDate),
  },
  {
    status: Statuses.UPCOMING,
    titleKey: 'common.upcoming',
    icon: 'calendar alternate outline',
    className: 'columnUpcoming',
    sort: byDateAsc((entry) => entry.card.startDate || entry.card.dueDate),
  },
  {
    status: Statuses.DONE,
    titleKey: 'common.completed',
    icon: 'check circle outline',
    className: 'columnDone',
    sort: (a, b) => b.card.listChangedAt - a.card.listChangedAt,
  },
];

const StatusCard = React.memo(({ entry, userById, onClick }) => {
  const [t] = useTranslation();
  const { card, board, project } = entry;

  const memberNames = entry.userIds.flatMap((userId) =>
    userById[userId] ? userById[userId].name : [],
  );

  const progress =
    card.tasksTotal > 0 ? Math.round((card.tasksCompleted / card.tasksTotal) * 100) : null;

  return (
    <button type="button" className={styles.statusCard} onClick={() => onClick(card.id)}>
      <span className={styles.statusCardPath}>
        {project ? `${project.name} › ` : ''}
        {board.name}
      </span>
      <span className={styles.statusCardName}>{card.name}</span>
      <span className={styles.statusCardMeta}>
        {card.dueDate && (
          <span
            className={classNames(styles.statusCardDue, {
              [styles.statusCardDueOverdue]: entry.isOverdue,
            })}
          >
            <Icon name="calendar outline" />
            {t('format:longDate', { value: card.dueDate, postProcess: 'formatDate' })}
          </span>
        )}
        <span className={styles.statusCardMembers}>
          <Icon name="user outline" />
          {memberNames.length > 0 ? memberNames.join(', ') : t('common.unassigned_title')}
        </span>
      </span>
      {progress !== null && (
        <span className={styles.progressTrack}>
          <span className={styles.progressFill} style={{ width: `${progress}%` }} />
        </span>
      )}
    </button>
  );
});

StatusCard.propTypes = {
  entry: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  userById: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  onClick: PropTypes.func.isRequired,
};

const StatusColumn = React.memo(({ column, entries, userById, onCardClick }) => {
  const [t] = useTranslation();
  const [limit, setLimit] = useState(PAGE_SIZE);

  const sortedEntries = useMemo(() => entries.slice().sort(column.sort), [entries, column]);

  return (
    <div className={classNames(styles.statusColumn, styles[column.className])}>
      <div className={styles.statusColumnHeader}>
        <Icon name={column.icon} />
        <span className={styles.statusColumnTitle}>{t(column.titleKey)}</span>
        <span className={styles.statusColumnCount}>{entries.length}</span>
      </div>
      <div className={styles.statusColumnBody}>
        {sortedEntries.slice(0, limit).map((entry) => (
          <StatusCard key={entry.card.id} entry={entry} userById={userById} onClick={onCardClick} />
        ))}
        {entries.length === 0 && (
          <div className={styles.statusColumnEmpty}>{t('common.noCards')}</div>
        )}
        {entries.length > limit && (
          <button
            type="button"
            className={styles.showMoreButton}
            onClick={() => setLimit(limit + PAGE_SIZE)}
          >
            {t('common.showMoreCards', { count: entries.length - limit })}
          </button>
        )}
      </div>
    </div>
  );
});

StatusColumn.propTypes = {
  column: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  entries: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  userById: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  onCardClick: PropTypes.func.isRequired,
};

const StatusBoard = React.memo(({ entries, userById, onCardClick }) => {
  const entriesByStatus = useMemo(
    () =>
      entries.reduce(
        (result, entry) => {
          result[entry.status].push(entry);
          return result;
        },
        {
          [Statuses.ACTIVE]: [],
          [Statuses.UPCOMING]: [],
          [Statuses.DONE]: [],
        },
      ),
    [entries],
  );

  return (
    <div className={styles.statusBoard}>
      {COLUMNS.map((column) => (
        <StatusColumn
          key={column.status}
          column={column}
          entries={entriesByStatus[column.status]}
          userById={userById}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
});

StatusBoard.propTypes = {
  entries: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  userById: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  onCardClick: PropTypes.func.isRequired,
};

export default StatusBoard;
