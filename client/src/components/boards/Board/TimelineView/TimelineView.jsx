/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Dropdown } from 'semantic-ui-react';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import Paths from '../../../../constants/Paths';
import { BoardMembershipRoles } from '../../../../constants/Enums';
import TimelineChart, {
  ColorByOptions,
  getColorClassName,
  getHashedColor,
  getStatusColor,
  isCardDone,
  isCardOverdue,
} from '../../../common/TimelineChart';

import styles from './TimelineView.module.scss';

const GroupByOptions = {
  LIST: 'list',
  MEMBER: 'member',
  LABEL: 'label',
  NONE: 'none',
};

const NO_VALUE_KEY = '__none__';

const TimelineView = React.memo(({ cardIds }) => {
  const board = useSelector(selectors.selectCurrentBoard);
  const cards = useSelector((state) => selectors.selectTimelineCardsByIds(state, cardIds));
  const memberships = useSelector(selectors.selectMembershipsForCurrentBoard);
  const labels = useSelector(selectors.selectLabelsForCurrentBoard);
  const cardDependencies = useSelector(selectors.selectCardDependenciesForCurrentBoard);

  const canEdit = useSelector((state) => {
    const boardMembership = selectors.selectCurrentUserMembershipForCurrentBoard(state);
    return !!boardMembership && boardMembership.role === BoardMembershipRoles.EDITOR;
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [t] = useTranslation();

  const [groupBy, setGroupBy] = useState(GroupByOptions.LIST);
  const [colorBy, setColorBy] = useState(ColorByOptions.STATUS);

  useEffect(() => {
    dispatch(entryActions.fetchCardDependenciesInCurrentBoard());
  }, [board.id, dispatch]);

  const userById = useMemo(
    () =>
      memberships.reduce(
        (result, membership) => ({
          ...result,
          [membership.user.id]: membership.user,
        }),
        {},
      ),
    [memberships],
  );

  const labelById = useMemo(
    () =>
      labels.reduce(
        (result, label) => ({
          ...result,
          [label.id]: label,
        }),
        {},
      ),
    [labels],
  );

  const scheduledCards = useMemo(
    () => cards.filter((card) => card.startDate || card.dueDate),
    [cards],
  );

  const lanes = useMemo(() => {
    switch (groupBy) {
      case GroupByOptions.LIST: {
        const listById = {};

        scheduledCards.forEach((card) => {
          if (card.list) {
            listById[card.list.id] = card.list;
          }
        });

        return Object.values(listById)
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((list) => ({
            key: list.id,
            label: list.name || t(`common.${list.type}`),
          }));
      }
      case GroupByOptions.MEMBER: {
        const userIds = new Set(scheduledCards.flatMap((card) => card.userIds));

        const result = memberships
          .filter((membership) => userIds.has(membership.user.id))
          .map((membership) => ({
            key: membership.user.id,
            label: membership.user.name,
          }));

        if (scheduledCards.some((card) => card.userIds.length === 0)) {
          result.push({
            key: NO_VALUE_KEY,
            label: t('common.unassigned', { context: 'title' }),
          });
        }

        return result;
      }
      case GroupByOptions.LABEL: {
        const labelIds = new Set(scheduledCards.flatMap((card) => card.labelIds));

        const result = labels
          .filter((label) => labelIds.has(label.id))
          .map((label) => ({
            key: label.id,
            label: label.name || t(`common.${label.color}`, { defaultValue: label.color }),
          }));

        if (scheduledCards.some((card) => card.labelIds.length === 0)) {
          result.push({
            key: NO_VALUE_KEY,
            label: t('common.noLabels'),
          });
        }

        return result;
      }
      default:
        return [
          {
            key: NO_VALUE_KEY,
            label: board.name,
          },
        ];
    }
  }, [groupBy, scheduledCards, memberships, labels, board.name, t]);

  const items = useMemo(
    () =>
      scheduledCards.map((card) => {
        const isDone = isCardDone(card, card.list);
        const isOverdue = isCardOverdue(card, isDone);

        let laneKeys;
        switch (groupBy) {
          case GroupByOptions.LIST:
            laneKeys = [card.listId];

            break;
          case GroupByOptions.MEMBER:
            laneKeys = card.userIds.length > 0 ? card.userIds : [NO_VALUE_KEY];

            break;
          case GroupByOptions.LABEL:
            laneKeys = card.labelIds.length > 0 ? card.labelIds : [NO_VALUE_KEY];

            break;
          default:
            laneKeys = [NO_VALUE_KEY];
        }

        let color;
        switch (colorBy) {
          case ColorByOptions.LABEL: {
            const label = labelById[card.labelIds[0]];
            color = label ? label.color : 'light-concrete';

            break;
          }
          case ColorByOptions.LIST:
            color = card.list && card.list.color ? card.list.color : getHashedColor(card.listId);

            break;
          case ColorByOptions.MEMBER:
            color = card.userIds[0] ? getHashedColor(card.userIds[0]) : 'light-concrete';

            break;
          default:
            color = getStatusColor(card, isDone, isOverdue);
        }

        const memberNames = card.userIds.flatMap((userId) =>
          userById[userId] ? userById[userId].name : [],
        );

        const labelNames = card.labelIds.flatMap((labelId) =>
          labelById[labelId] && labelById[labelId].name ? labelById[labelId].name : [],
        );

        return {
          id: card.id,
          name: card.name,
          startDate: card.startDate || undefined,
          dueDate: card.dueDate || undefined,
          laneKeys,
          colorClassName: getColorClassName(color),
          isCompleted: isDone || !!card.isDueCompleted,
          isOverdue,
          progress:
            card.tasksTotal > 0
              ? { completed: card.tasksCompleted, total: card.tasksTotal }
              : undefined,
          details: [
            card.list && card.list.name,
            memberNames.length > 0 && memberNames.join(', '),
            labelNames.length > 0 && labelNames.join(', '),
          ].filter(Boolean),
        };
      }),
    [scheduledCards, groupBy, colorBy, labelById, userById],
  );

  const dependencies = useMemo(
    () =>
      cardDependencies.map((cardDependency) => ({
        id: cardDependency.id,
        predecessorId: cardDependency.predecessorCardId,
        successorId: cardDependency.successorCardId,
        isPersisted: cardDependency.isPersisted,
      })),
    [cardDependencies],
  );

  const handleItemClick = useCallback(
    (id) => {
      navigate(Paths.CARDS.replace(':id', id));
    },
    [navigate],
  );

  const handleItemDatesChange = useCallback(
    (id, { startDate, dueDate }) => {
      dispatch(
        entryActions.updateCard(id, {
          startDate: startDate || null,
          dueDate: dueDate || null,
        }),
      );
    },
    [dispatch],
  );

  const handleDependencyCreate = useCallback(
    (predecessorId, successorId) => {
      dispatch(entryActions.createCardDependency(predecessorId, successorId));
    },
    [dispatch],
  );

  const handleDependencyDelete = useCallback(
    (id) => {
      dispatch(entryActions.deleteCardDependency(id));
    },
    [dispatch],
  );

  const groupByOptions = [
    { value: GroupByOptions.LIST, text: t('common.groupByList') },
    { value: GroupByOptions.MEMBER, text: t('common.groupByMember') },
    { value: GroupByOptions.LABEL, text: t('common.groupByLabel') },
    { value: GroupByOptions.NONE, text: t('common.noGrouping') },
  ];

  const colorByOptions = [
    { value: ColorByOptions.STATUS, text: t('common.colorByStatus') },
    { value: ColorByOptions.LABEL, text: t('common.colorByLabel') },
    { value: ColorByOptions.LIST, text: t('common.colorByList') },
    { value: ColorByOptions.MEMBER, text: t('common.colorByMember') },
  ];

  return (
    <div className={styles.wrapper}>
      <TimelineChart
        items={items}
        lanes={lanes}
        dependencies={dependencies}
        canEdit={canEdit}
        unscheduledCount={cards.length - scheduledCards.length}
        emptyMessage={t('common.noCardsWithDates')}
        toolbarChildren={
          <>
            <Dropdown
              inline
              options={groupByOptions}
              value={groupBy}
              onChange={(_, { value }) => setGroupBy(value)}
            />
            <Dropdown
              inline
              options={colorByOptions}
              value={colorBy}
              onChange={(_, { value }) => setColorBy(value)}
            />
          </>
        }
        onItemClick={handleItemClick}
        onItemDatesChange={handleItemDatesChange}
        onDependencyCreate={handleDependencyCreate}
        onDependencyDelete={handleDependencyDelete}
      />
    </div>
  );
});

TimelineView.propTypes = {
  cardIds: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
};

export default TimelineView;
