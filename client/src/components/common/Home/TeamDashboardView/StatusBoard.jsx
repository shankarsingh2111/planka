/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import Paths from '../../../../constants/Paths';

import styles from './TeamDashboardView.module.scss';

const StatusColumn = React.memo(({ title, icon, cards, colorClass }) => {
  const [t] = useTranslation();
  const navigate = useNavigate();

  const handleCardClick = useCallback(
    (cardId) => {
      navigate(Paths.CARDS.replace(':id', cardId));
    },
    [navigate],
  );

  return (
    <div className={`${styles.statusColumn} ${colorClass}`}>
      <div className={styles.statusColumnHeader}>
        <Icon name={icon} />
        <span className={styles.statusColumnTitle}>{title}</span>
        <span className={styles.statusColumnCount}>{cards.length}</span>
      </div>
      <div className={styles.statusColumnBody}>
        {cards.slice(0, 50).map((card) => {
          const dueDate = card.dueDate ? new Date(card.dueDate) : null;
          const isOverdue =
            dueDate && dueDate < new Date() && !card.isDueCompleted;

          return (
            <button
              key={card.id}
              type="button"
              className={styles.statusCard}
              onClick={() => handleCardClick(card.id)}
            >
              <div className={styles.statusCardName}>{card.name}</div>
              {dueDate && (
                <div
                  className={`${styles.statusCardDue} ${
                    isOverdue ? styles.statusCardDueOverdue : ''
                  }`}
                >
                  <Icon name="calendar outline" size="small" />
                  {dueDate.toLocaleDateString()}
                </div>
              )}
            </button>
          );
        })}
        {cards.length === 0 && (
          <div className={styles.statusColumnEmpty}>
            {t('common.noCards')}
          </div>
        )}
      </div>
    </div>
  );
});

StatusColumn.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  cards: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  colorClass: PropTypes.string.isRequired,
};

const StatusBoard = React.memo(({ doneCards, activeCards, upcomingCards }) => {
  const [t] = useTranslation();

  return (
    <div className={styles.statusBoard}>
      <StatusColumn
        title={t('common.inProgress')}
        icon="spinner"
        cards={activeCards}
        colorClass={styles.statusColumnActive}
      />
      <StatusColumn
        title={t('common.upcoming')}
        icon="calendar alternate"
        cards={upcomingCards}
        colorClass={styles.statusColumnUpcoming}
      />
      <StatusColumn
        title={t('common.completed')}
        icon="check circle"
        cards={doneCards}
        colorClass={styles.statusColumnDone}
      />
    </div>
  );
});

StatusBoard.propTypes = {
  doneCards: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  activeCards: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  upcomingCards: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
};

export default StatusBoard;
