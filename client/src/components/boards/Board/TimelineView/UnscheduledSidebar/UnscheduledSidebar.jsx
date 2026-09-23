/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon, Input } from 'semantic-ui-react';

import { Avatars } from '../../../../common/TimelineChart';

import styles from './UnscheduledSidebar.module.scss';

/**
 * Staging area for cards the chart cannot place: those with neither a start nor a due date.
 * Cards arrive already filtered by the board's own search and member/label filters, so this only
 * adds a local search of its own and groups what is left by list.
 */
const UnscheduledSidebar = React.memo(
  ({ cards, ghostCard, isDropTarget, draggingCardId, onCardClick, onCardDragStart }) => {
  const [t] = useTranslation();
  const [search, setSearch] = useState('');

  const cleanSearch = useMemo(() => search.trim().toLowerCase(), [search]);

  const filteredCards = useMemo(
    () =>
      cleanSearch ? cards.filter((card) => card.name.toLowerCase().includes(cleanSearch)) : cards,
    [cards, cleanSearch],
  );

  const groups = useMemo(() => {
    const byListId = new Map();

    filteredCards.forEach((card) => {
      const listId = card.listId || '';

      if (!byListId.has(listId)) {
        byListId.set(listId, {
          listId,
          name: card.list ? card.list.name || t(`common.${card.list.type}`) : '',
          position: card.list ? card.list.position || 0 : 0,
          cards: [],
        });
      }

      byListId.get(listId).cards.push(card);
    });

    return [...byListId.values()].sort((a, b) => a.position - b.position);
  }, [filteredCards, t]);

  return (
    <div
      className={classNames(styles.wrapper, isDropTarget && styles.wrapperDropTarget)}
      data-timeline-unschedule-zone=""
    >
      <div className={styles.header}>
        <Icon name="calendar times outline" className={styles.headerIcon} />
        <span className={styles.headerTitle}>{t('common.unscheduled', { context: 'title' })}</span>
        <span className={styles.headerCount}>{cards.length}</span>
      </div>
      <div className={styles.searchWrapper}>
        <Input
          fluid
          size="mini"
          icon="search"
          iconPosition="left"
          value={search}
          placeholder={t('common.searchCards')}
          className={styles.search}
          onChange={(_, { value }) => setSearch(value)}
        />
      </div>
      <div className={styles.list}>
        {ghostCard && (
          <div className={styles.ghostCard}>
            <span className={styles.cardName}>{ghostCard.name}</span>
            {ghostCard.userIds.length > 0 && (
              <Avatars userIds={ghostCard.userIds} className={styles.cardAvatars} />
            )}
          </div>
        )}
        {groups.length === 0 && !ghostCard ? (
          <div className={styles.empty}>{t('common.noUnscheduledCards')}</div>
        ) : (
          groups.map((group) => (
            <div key={group.listId} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupName} title={group.name}>
                  {group.name}
                </span>
                <span className={styles.groupCount}>{group.cards.length}</span>
              </div>
              {group.cards.map((card) => (
                <div
                  key={card.id}
                  role="button"
                  tabIndex={0}
                  data-timeline-unscheduled-card-id={card.id}
                  className={classNames(styles.card, draggingCardId === card.id && styles.cardDragging)}
                  onPointerDown={(event) => onCardDragStart(event, card)}
                  onClick={() => onCardClick(card.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onCardClick(card.id);
                    }
                  }}
                >
                  <span className={styles.cardName}>{card.name}</span>
                  {card.userIds.length > 0 && (
                    <Avatars userIds={card.userIds} className={styles.cardAvatars} />
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
    );
  },
);

UnscheduledSidebar.propTypes = {
  cards: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
  ghostCard: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  isDropTarget: PropTypes.bool,
  draggingCardId: PropTypes.string,
  onCardClick: PropTypes.func.isRequired,
  onCardDragStart: PropTypes.func.isRequired,
};

UnscheduledSidebar.defaultProps = {
  ghostCard: undefined,
  isDropTarget: false,
  draggingCardId: undefined,
};

export default UnscheduledSidebar;
