/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation, Trans } from 'react-i18next';
import { Comment } from 'semantic-ui-react';

import selectors from '../../../selectors';
import { isUserStatic } from '../../../utils/record-helpers';
import { fromDateString } from '../../../utils/recurrence';
import { ActivityTypes } from '../../../constants/Enums';
import TimeAgo from '../../common/TimeAgo';
import UserAvatar from '../../users/UserAvatar';
import { formatWeekdays } from '../../card-recurrences/weekdays';

import styles from './Item.module.scss';

const Item = React.memo(({ id }) => {
  const selectActivityById = useMemo(() => selectors.makeSelectActivityById(), []);
  const selectUserById = useMemo(() => selectors.makeSelectUserById(), []);

  const activity = useSelector((state) => selectActivityById(state, id));
  const user = useSelector((state) => selectUserById(state, activity.userId));

  const [t, i18n] = useTranslation();

  const userName = isUserStatic(user)
    ? t(`common.${user.name}`, {
        context: 'title',
      })
    : user.name;

  let contentNode;
  switch (activity.type) {
    case ActivityTypes.CREATE_CARD: {
      const { list } = activity.data;
      const listName = list.name || t(`common.${list.type}`);

      contentNode = (
        <Trans
          i18nKey="common.userAddedThisCardToList"
          values={{
            user: userName,
            list: listName,
          }}
        >
          <span className={styles.author}>{userName}</span>
          {' added this card to '}
          {listName}
        </Trans>
      );

      break;
    }
    case ActivityTypes.MOVE_CARD: {
      const { fromList, toList } = activity.data;

      const fromListName = fromList.name || t(`common.${fromList.type}`);
      const toListName = toList.name || t(`common.${toList.type}`);

      contentNode = (
        <Trans
          i18nKey="common.userMovedThisCardFromListToList"
          values={{
            user: userName,
            fromList: fromListName,
            toList: toListName,
          }}
        >
          <span className={styles.author}>{userName}</span>
          {' moved this card from '}
          {fromListName}
          {' to '}
          {toListName}
        </Trans>
      );

      break;
    }
    case ActivityTypes.ADD_MEMBER_TO_CARD:
      contentNode =
        user.id === activity.data.user.id ? (
          <Trans
            i18nKey="common.userJoinedThisCard"
            values={{
              user: userName,
            }}
          >
            <span className={styles.author}>{userName}</span>
            {' joined this card'}
          </Trans>
        ) : (
          <Trans
            i18nKey="common.userAddedUserToThisCard"
            values={{
              actorUser: userName,
              addedUser: activity.data.user.name,
            }}
          >
            <span className={styles.author}>{userName}</span>
            {' added '}
            {activity.data.user.name}
            {' to this card'}
          </Trans>
        );

      break;
    case ActivityTypes.REMOVE_MEMBER_FROM_CARD:
      contentNode =
        user.id === activity.data.user.id ? (
          <Trans
            i18nKey="common.userLeftThisCard"
            values={{
              user: userName,
            }}
          >
            <span className={styles.author}>{userName}</span>
            {' left this card'}
          </Trans>
        ) : (
          <Trans
            i18nKey="common.userRemovedUserFromThisCard"
            values={{
              actorUser: userName,
              removedUser: activity.data.user.name,
            }}
          >
            <span className={styles.author}>{userName}</span>
            {' removed '}
            {activity.data.user.name}
            {' from this card'}
          </Trans>
        );

      break;
    case ActivityTypes.COMPLETE_TASK:
      contentNode = (
        <Trans
          i18nKey="common.userCompletedTaskOnThisCard"
          values={{
            user: userName,
            task: activity.data.task.name,
          }}
        >
          <span className={styles.author}>{userName}</span>
          {' completed '}
          {activity.data.task.name}
          {' on this card'}
        </Trans>
      );

      break;
    case ActivityTypes.UNCOMPLETE_TASK:
      contentNode = (
        <Trans
          i18nKey="common.userMarkedTaskIncompleteOnThisCard"
          values={{
            user: userName,
            task: activity.data.task.name,
          }}
        >
          <span className={styles.author}>{userName}</span>
          {' marked '}
          {activity.data.task.name}
          {' incomplete on this card'}
        </Trans>
      );

      break;
    case ActivityTypes.CREATE_CARD_RECURRENCE: {
      const { cardRecurrence, cardsTotal } = activity.data;

      const days = formatWeekdays(t, i18n, cardRecurrence.weekdays);
      const date = t('format:longDate', {
        value: fromDateString(cardRecurrence.endsOn),
        postProcess: 'formatDate',
      });

      contentNode = (
        <Trans
          i18nKey="common.userMadeThisCardRepeat"
          count={cardsTotal}
          values={{
            user: userName,
            days,
            date,
          }}
        >
          <span className={styles.author}>{userName}</span>
          {` made this card repeat: ${days}, until ${date} (${cardsTotal} cards)`}
        </Trans>
      );

      break;
    }
    case ActivityTypes.UPDATE_CARD_RECURRENCE:
      contentNode = (
        <Trans
          i18nKey="common.userUpdatedCardsOfThisSeries"
          count={activity.data.cardsTotal}
          values={{
            user: userName,
          }}
        >
          <span className={styles.author}>{userName}</span>
          {` updated ${activity.data.cardsTotal} cards of this series`}
        </Trans>
      );

      break;
    default:
      contentNode = null;
  }

  return (
    <Comment>
      <span className={styles.user}>
        <UserAvatar id={activity.userId} />
      </span>
      <div className={styles.content}>
        <div>{contentNode}</div>
        <span className={styles.date}>
          <TimeAgo date={activity.createdAt} />
        </span>
      </div>
    </Comment>
  );
});

Item.propTypes = {
  id: PropTypes.string.isRequired,
};

export default Item;
