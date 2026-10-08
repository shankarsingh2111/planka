/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Dropdown } from 'semantic-ui-react';

import selectors from '../../../../selectors';
import TimelineChart, {
  ColorByOptions,
  getZoomLevels,
  getColorClassName,
  getHashedColor,
  getStatusColor,
} from '../../TimelineChart';

import styles from './TeamDashboardView.module.scss';

const GroupByOptions = {
  MEMBER: 'member',
  PROJECT: 'project',
  BOARD: 'board',
};

const UNASSIGNED_KEY = '__unassigned__';

const getBoardLabel = (entry) =>
  entry.project ? `${entry.project.name} › ${entry.board.name}` : entry.board.name;

const TeamTimeline = React.memo(
  ({
    entries,
    cardDependencies,
    users,
    userById,
    onCardClick,
    onCardDatesChange,
    onDependencyCreate,
    onDependencyDelete,
  }) => {
    const [t] = useTranslation();

    const withQuarterZoom = useSelector(
      (state) => selectors.selectCurrentUser(state).showQuarterTimelineZoom,
    );

    const [groupBy, setGroupBy] = useState(GroupByOptions.MEMBER);
    const [colorBy, setColorBy] = useState(ColorByOptions.PROJECT);

    const scheduledEntries = useMemo(
      () => entries.filter(({ card }) => card.startDate || card.dueDate),
      [entries],
    );

    const activeUserIds = useMemo(() => new Set(users.map((user) => user.id)), [users]);

    // Deactivated users get no lane, so a card held only by them counts as unassigned
    const getMemberLaneKeys = useCallback(
      (entry) => {
        const laneKeys = entry.userIds.filter((userId) => activeUserIds.has(userId));
        return laneKeys.length > 0 ? laneKeys : [UNASSIGNED_KEY];
      },
      [activeUserIds],
    );

    const lanes = useMemo(() => {
      if (groupBy === GroupByOptions.MEMBER) {
        const memberLanes = users.map((user) => ({ key: user.id, label: user.name }));

        const hasUnassigned = scheduledEntries.some((entry) =>
          getMemberLaneKeys(entry).includes(UNASSIGNED_KEY),
        );

        return hasUnassigned
          ? [...memberLanes, { key: UNASSIGNED_KEY, label: t('common.unassigned_title') }]
          : memberLanes;
      }

      const laneByKey = {};

      scheduledEntries.forEach((entry) => {
        if (groupBy === GroupByOptions.PROJECT) {
          const key = entry.project ? entry.project.id : entry.board.projectId;

          laneByKey[key] = {
            key,
            label: entry.project ? entry.project.name : '',
            order: entry.project ? entry.project.name : '',
          };
        } else {
          laneByKey[entry.board.id] = {
            key: entry.board.id,
            label: getBoardLabel(entry),
            order: getBoardLabel(entry),
          };
        }
      });

      return Object.values(laneByKey).sort((a, b) => a.order.localeCompare(b.order));
    }, [scheduledEntries, groupBy, users, getMemberLaneKeys, t]);

    const items = useMemo(
      () =>
        scheduledEntries.map((entry) => {
          const { card } = entry;

          let laneKeys;
          if (groupBy === GroupByOptions.MEMBER) {
            laneKeys = getMemberLaneKeys(entry);
          } else if (groupBy === GroupByOptions.PROJECT) {
            laneKeys = [entry.project ? entry.project.id : entry.board.projectId];
          } else {
            laneKeys = [entry.board.id];
          }

          let color;
          switch (colorBy) {
            case ColorByOptions.STATUS:
              color = getStatusColor(card, entry.isDone, entry.isOverdue);

              break;
            case ColorByOptions.MEMBER:
              color = entry.userIds[0] ? getHashedColor(entry.userIds[0]) : 'light-concrete';

              break;
            default:
              color = getHashedColor(entry.board.projectId);
          }

          const memberNames = entry.userIds.flatMap((userId) =>
            userById[userId] ? userById[userId].name : [],
          );

          return {
            id: card.id,
            name: card.name,
            startDate: card.startDate || undefined,
            dueDate: card.dueDate || undefined,
            laneKeys,
            colorClassName: getColorClassName(color),
            isCompleted: entry.isDone || !!card.isDueCompleted,
            isOverdue: entry.isOverdue,
            seriesId: card.recurrenceId || undefined,
            ticketNumber: card.ticketNumber || undefined,
            isEditable: entry.isEditable,
            progress:
              card.tasksTotal > 0
                ? { completed: card.tasksCompleted, total: card.tasksTotal }
                : undefined,
            details: [
              getBoardLabel(entry),
              entry.list.name,
              memberNames.length > 0 && memberNames.join(', '),
            ].filter(Boolean),
          };
        }),
      [scheduledEntries, groupBy, colorBy, userById, getMemberLaneKeys],
    );

    const dependencies = useMemo(() => {
      const cardIds = new Set(scheduledEntries.map(({ card }) => card.id));

      return cardDependencies
        .filter(
          (cardDependency) =>
            cardIds.has(cardDependency.predecessorCardId) &&
            cardIds.has(cardDependency.successorCardId),
        )
        .map((cardDependency) => ({
          id: cardDependency.id,
          predecessorId: cardDependency.predecessorCardId,
          successorId: cardDependency.successorCardId,
        }));
    }, [scheduledEntries, cardDependencies]);

    const groupByOptions = [
      { value: GroupByOptions.MEMBER, text: t('common.groupByMember') },
      { value: GroupByOptions.PROJECT, text: t('common.groupByProject') },
      { value: GroupByOptions.BOARD, text: t('common.groupByBoard') },
    ];

    const colorByOptions = [
      { value: ColorByOptions.PROJECT, text: t('common.colorByProject') },
      { value: ColorByOptions.STATUS, text: t('common.colorByStatus') },
      { value: ColorByOptions.MEMBER, text: t('common.colorByMember') },
    ];

    return (
      <div className={styles.timelineWrapper}>
        <TimelineChart
          canEdit
          items={items}
          lanes={lanes}
          dependencies={dependencies}
          zoomLevels={getZoomLevels(withQuarterZoom)}
          unscheduledCount={entries.length - scheduledEntries.length}
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
          onItemClick={onCardClick}
          onItemDatesChange={onCardDatesChange}
          onDependencyCreate={onDependencyCreate}
          onDependencyDelete={onDependencyDelete}
        />
      </div>
    );
  },
);

TeamTimeline.propTypes = {
  /* eslint-disable react/forbid-prop-types */
  entries: PropTypes.array.isRequired,
  cardDependencies: PropTypes.array.isRequired,
  users: PropTypes.array.isRequired,
  userById: PropTypes.object.isRequired,
  /* eslint-enable react/forbid-prop-types */
  onCardClick: PropTypes.func.isRequired,
  onCardDatesChange: PropTypes.func.isRequired,
  onDependencyCreate: PropTypes.func.isRequired,
  onDependencyDelete: PropTypes.func.isRequired,
};

export default TeamTimeline;
