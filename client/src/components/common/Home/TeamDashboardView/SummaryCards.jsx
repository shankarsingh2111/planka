/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { SummaryKeys } from './build-dashboard-model';

import styles from './TeamDashboardView.module.scss';

const SUMMARIES = [
  { key: SummaryKeys.OVERDUE, icon: 'exclamation triangle', className: 'summaryDanger' },
  { key: SummaryKeys.DUE_THIS_WEEK, icon: 'clock outline', className: 'summaryWarning' },
  { key: SummaryKeys.IN_PROGRESS, icon: 'sync alternate', className: 'summaryInfo' },
  { key: SummaryKeys.COMPLETED_THIS_WEEK, icon: 'check circle', className: 'summarySuccess' },
  { key: SummaryKeys.UNASSIGNED, icon: 'user outline', className: 'summaryNeutral' },
];

const SummaryCards = React.memo(({ counts, activeKey, onSelect }) => {
  const [t] = useTranslation();

  return (
    <div className={styles.summaryRow}>
      {SUMMARIES.map((summary) => (
        <button
          key={summary.key}
          type="button"
          aria-pressed={activeKey === summary.key}
          className={classNames(styles.summaryCard, styles[summary.className], {
            [styles.summaryCardActive]: activeKey === summary.key,
          })}
          onClick={() => onSelect(activeKey === summary.key ? null : summary.key)}
        >
          <Icon name={summary.icon} className={styles.summaryIcon} />
          <span className={styles.summaryContent}>
            <span className={styles.summaryCount}>{counts[summary.key] || 0}</span>
            <span className={styles.summaryLabel}>{t(`common.${summary.key}`)}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

SummaryCards.propTypes = {
  counts: PropTypes.objectOf(PropTypes.number).isRequired,
  activeKey: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

SummaryCards.defaultProps = {
  activeKey: null,
};

export default SummaryCards;
