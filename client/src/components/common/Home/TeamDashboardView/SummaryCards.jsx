/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import styles from './TeamDashboardView.module.scss';

const SummaryCards = React.memo(
  ({ overdueCount, dueThisWeekCount, activeCount, doneCount, totalCount }) => {
    const [t] = useTranslation();

    const cards = [
      {
        key: 'overdue',
        icon: 'exclamation triangle',
        label: t('common.overdue'),
        count: overdueCount,
        className: styles.summaryCardDanger,
      },
      {
        key: 'dueThisWeek',
        icon: 'clock outline',
        label: t('common.dueThisWeek'),
        count: dueThisWeekCount,
        className: styles.summaryCardWarning,
      },
      {
        key: 'active',
        icon: 'spinner',
        label: t('common.inProgress'),
        count: activeCount,
        className: styles.summaryCardInfo,
      },
      {
        key: 'done',
        icon: 'check circle',
        label: t('common.completed'),
        count: doneCount,
        className: styles.summaryCardSuccess,
      },
    ];

    return (
      <div className={styles.summaryRow}>
        {cards.map((card) => (
          <div key={card.key} className={`${styles.summaryCard} ${card.className}`}>
            <div className={styles.summaryCardIcon}>
              <Icon name={card.icon} />
            </div>
            <div className={styles.summaryCardContent}>
              <div className={styles.summaryCardCount}>{card.count}</div>
              <div className={styles.summaryCardLabel}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>
    );
  },
);

SummaryCards.propTypes = {
  overdueCount: PropTypes.number.isRequired,
  dueThisWeekCount: PropTypes.number.isRequired,
  activeCount: PropTypes.number.isRequired,
  doneCount: PropTypes.number.isRequired,
  totalCount: PropTypes.number.isRequired,
};

export default SummaryCards;
