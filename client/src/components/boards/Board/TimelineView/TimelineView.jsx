/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, Icon } from 'semantic-ui-react';
import { usePopup } from '../../../../lib/popup';

import selectors from '../../../../selectors';
import entryActions from '../../../../entry-actions';
import Paths from '../../../../constants/Paths';
import { BoardMembershipRoles } from '../../../../constants/Enums';
import { GroupByOptions, NO_VALUE_KEY } from './constants';
import { getAddCardDefaults } from './add-card-defaults';
import useTimelinePreferences from './use-timeline-preferences';
import LanesFilterStep from './LanesFilterStep';
import UnscheduledSidebar from './UnscheduledSidebar';
import AddCardModal from '../../../cards/AddCardModal';
import TimelineChart, {
  ColorByOptions,
  getZoomLevels,
  getColorClassName,
  getHashedColor,
  getStatusColor,
  isCardDone,
  isCardOverdue,
} from '../../../common/TimelineChart';

import styles from './TimelineView.module.scss';

const UNSCHEDULED_DRAG_THRESHOLD = 4;

const LANES_FILTER_TITLES = {
  [GroupByOptions.LIST]: 'common.lists',
  [GroupByOptions.MEMBER]: 'common.members',
  [GroupByOptions.LABEL]: 'common.labels',
  [GroupByOptions.NONE]: 'common.lanes',
};

const TimelineView = React.memo(({ cardIds }) => {
  const board = useSelector(selectors.selectCurrentBoard);
  const cards = useSelector((state) => selectors.selectTimelineCardsByIds(state, cardIds));
  const memberships = useSelector(selectors.selectMembershipsForCurrentBoard);
  const labels = useSelector(selectors.selectLabelsForCurrentBoard);
  const lists = useSelector(selectors.selectAvailableListsForCurrentBoard);
  const cardDependencies = useSelector(selectors.selectCardDependenciesForCurrentBoard);

  const withQuarterZoom = useSelector(
    (state) => selectors.selectCurrentUser(state).showQuarterTimelineZoom,
  );

  const canEdit = useSelector((state) => {
    const boardMembership = selectors.selectCurrentUserMembershipForCurrentBoard(state);
    return !!boardMembership && boardMembership.role === BoardMembershipRoles.EDITOR;
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [t] = useTranslation();

  const {
    zoomLevel,
    groupBy,
    colorBy,
    collapsedLaneKeys,
    isSidebarOpened,
    getHiddenLaneKeys,
    setZoomLevel,
    setGroupBy,
    setColorBy,
    setIsSidebarOpened,
    toggleLaneHidden,
    showAllLanes,
    toggleLaneCollapsed,
  } = useTimelinePreferences(board.id);

  const hiddenLaneKeys = getHiddenLaneKeys(groupBy);

  // A press on a sidebar card only becomes a drag once it travels far enough, so the same
  // gesture still opens the card on a plain click
  const [externalDragItem, setExternalDragItem] = useState(null);
  const [unschedulingCardId, setUnschedulingCardId] = useState(null);
  const pendingDragRef = useRef(null);
  const wasDraggingRef = useRef(false);

  // What the add card dialog opens with; null while it is closed
  const [addCardDefaultData, setAddCardDefaultData] = useState(null);

  const handleUnscheduledCardDragStart = useCallback(
    (event, card) => {
      if (event.button !== 0 || !canEdit) {
        return;
      }

      wasDraggingRef.current = false;

      pendingDragRef.current = {
        card,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    [canEdit],
  );

  useEffect(() => {
    if (!canEdit) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const pending = pendingDragRef.current;

      if (!pending) {
        return;
      }

      if (
        Math.abs(event.clientX - pending.startX) < UNSCHEDULED_DRAG_THRESHOLD &&
        Math.abs(event.clientY - pending.startY) < UNSCHEDULED_DRAG_THRESHOLD
      ) {
        return;
      }

      pendingDragRef.current = null;
      wasDraggingRef.current = true;

      setExternalDragItem({ id: pending.card.id, name: pending.card.name });
    };

    const handlePointerUp = () => {
      pendingDragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canEdit]);

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

  // The sidebar holds exactly what the chart cannot place — a card with either date still gets
  // a bar, open-ended or as a point
  const unscheduledCards = useMemo(
    () => cards.filter((card) => !card.startDate && !card.dueDate),
    [cards],
  );

  const sortedLists = useMemo(
    () => lists.slice().sort((a, b) => (a.position || 0) - (b.position || 0)),
    [lists],
  );

  // Where a new card goes when nothing about the way it was started names a list
  const firstListId = sortedLists.length > 0 ? sortedLists[0].id : undefined;
  const canAddCard = canEdit && !!firstListId;

  // Lanes come from the board's own lists, members and labels rather than from the cards that
  // happen to be scheduled, so an empty list still gets a row to drop onto
  const allLanes = useMemo(() => {
    switch (groupBy) {
      case GroupByOptions.LIST:
        return sortedLists.map((list) => ({
          key: list.id,
          label: list.name || t(`common.${list.type}`),
        }));
      case GroupByOptions.MEMBER:
        return [
          ...memberships.map((membership) => ({
            key: membership.user.id,
            label: membership.user.name,
          })),
          {
            key: NO_VALUE_KEY,
            label: t('common.unassigned', { context: 'title' }),
          },
        ];
      case GroupByOptions.LABEL:
        return [
          ...labels.map((label) => ({
            key: label.id,
            label: label.name || t(`common.${label.color}`, { defaultValue: label.color }),
          })),
          {
            key: NO_VALUE_KEY,
            label: t('common.noLabels'),
          },
        ];
      default:
        return [
          {
            key: NO_VALUE_KEY,
            label: board.name,
          },
        ];
    }
  }, [groupBy, sortedLists, memberships, labels, board.name, t]);

  const lanes = useMemo(
    () => allLanes.filter((lane) => !hiddenLaneKeys.includes(lane.key)),
    [allLanes, hiddenLaneKeys],
  );

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
          memberIds: card.userIds,
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

  const handleExternalDrop = useCallback(
    (cardId, { laneKey, startDate, dueDate }) => {
      setExternalDragItem(null);

      dispatch(
        entryActions.scheduleCard(cardId, {
          // Only list lanes name a list; member and label lanes leave the card where it is
          listId: groupBy === GroupByOptions.LIST ? laneKey : undefined,
          startDate,
          dueDate,
        }),
      );
    },
    [dispatch, groupBy],
  );

  // Vertical drag only means something when the lanes are lists; in member or label grouping a
  // lane is not somewhere a card can be moved to
  const handleItemLaneChange = useCallback(
    (cardId, laneKey, { startDate, dueDate }) => {
      dispatch(
        entryActions.scheduleCard(cardId, {
          listId: laneKey,
          startDate,
          dueDate,
        }),
      );
    },
    [dispatch],
  );

  // The card shown in the sidebar while a bar is held over it, before the dates are actually
  // cleared. Looked up from every card, since it is still a scheduled one at this point.
  const unschedulingCard = useMemo(
    () => (unschedulingCardId ? cards.find((card) => card.id === unschedulingCardId) : undefined),
    [unschedulingCardId, cards],
  );

  const handleItemUnschedule = useCallback(
    (cardId) => {
      dispatch(
        entryActions.updateCard(cardId, {
          startDate: null,
          dueDate: null,
        }),
      );
    },
    [dispatch],
  );

  const handleExternalDragCancel = useCallback(() => {
    setExternalDragItem(null);
  }, []);

  const handleUnscheduledCardClick = useCallback(
    (cardId) => {
      if (wasDraggingRef.current) {
        wasDraggingRef.current = false;
        return;
      }

      handleItemClick(cardId);
    },
    [handleItemClick],
  );

  const handleLaneToggleHidden = useCallback(
    (laneKey) => {
      toggleLaneHidden(groupBy, laneKey);
    },
    [toggleLaneHidden, groupBy],
  );

  const handleLanesShowAll = useCallback(() => {
    showAllLanes(groupBy);
  }, [showAllLanes, groupBy]);

  const handleAddCardClick = useCallback(() => {
    setAddCardDefaultData({
      listId: firstListId,
    });
  }, [firstListId]);

  const handleCanvasDoubleClick = useCallback(
    (laneKey, dates) => {
      setAddCardDefaultData(getAddCardDefaults(groupBy, laneKey, dates, firstListId));
    },
    [groupBy, firstListId],
  );

  const handleCardCreate = useCallback(
    (listId, data, details) => {
      dispatch(entryActions.createCardWithDetails(listId, data, details));
    },
    [dispatch],
  );

  const handleAddCardClose = useCallback(() => {
    setAddCardDefaultData(null);
  }, []);

  const LanesFilterPopup = usePopup(LanesFilterStep);

  const lanesFilterTitle = LANES_FILTER_TITLES[groupBy] || LANES_FILTER_TITLES[GroupByOptions.LIST];

  const sidebarToggleNode = (
    <Button
      size="mini"
      basic
      active={isSidebarOpened}
      title={t('common.unscheduledCardsSidebar')}
      className={styles.sidebarToggle}
      onClick={() => setIsSidebarOpened(!isSidebarOpened)}
    >
      <Icon fitted name={isSidebarOpened ? 'angle double left' : 'angle double right'} />
      {unscheduledCards.length > 0 && (
        <span className={styles.sidebarToggleCount}>{unscheduledCards.length}</span>
      )}
    </Button>
  );

  const addCardButtonNode = canAddCard && (
    <Button size="mini" basic className={styles.addCardButton} onClick={handleAddCardClick}>
      <Icon name="add" />
      {t('action.addCard', {
        context: 'title',
      })}
    </Button>
  );

  return (
    <div className={styles.wrapper}>
      {isSidebarOpened && (
        <UnscheduledSidebar
          cards={unscheduledCards}
          ghostCard={unschedulingCard}
          isDropTarget={!!unschedulingCard}
          draggingCardId={externalDragItem && externalDragItem.id}
          onCardClick={handleUnscheduledCardClick}
          onCardDragStart={handleUnscheduledCardDragStart}
        />
      )}
      <div className={styles.chart}>
        <TimelineChart
          items={items}
          lanes={lanes}
          dependencies={dependencies}
          zoomLevels={getZoomLevels(withQuarterZoom)}
          canEdit={canEdit}
          zoomLevel={zoomLevel}
          collapsedLaneKeys={collapsedLaneKeys}
          externalDragItem={externalDragItem}
          leadingToolbarChildren={sidebarToggleNode}
          toolbarActionChildren={addCardButtonNode}
          unscheduledCount={isSidebarOpened ? 0 : unscheduledCards.length}
          emptyMessage={t('common.noCardsWithDates')}
          toolbarChildren={
            <>
              <LanesFilterPopup
                lanes={allLanes}
                hiddenLaneKeys={hiddenLaneKeys}
                title={lanesFilterTitle}
                onToggle={handleLaneToggleHidden}
                onShowAll={handleLanesShowAll}
              >
                <Button size="mini" basic active={hiddenLaneKeys.length > 0}>
                  <Icon name="filter" />
                  {t(lanesFilterTitle)}
                  {hiddenLaneKeys.length > 0 && (
                    <span className={styles.hiddenLanesCount}>{hiddenLaneKeys.length}</span>
                  )}
                </Button>
              </LanesFilterPopup>
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
          onItemLaneChange={
            canEdit && groupBy === GroupByOptions.LIST ? handleItemLaneChange : undefined
          }
          onItemUnschedule={canEdit && isSidebarOpened ? handleItemUnschedule : undefined}
          onUnscheduleHoverChange={setUnschedulingCardId}
          onExternalDrop={canEdit ? handleExternalDrop : undefined}
          onExternalDragCancel={handleExternalDragCancel}
          onZoomLevelChange={setZoomLevel}
          onLaneToggle={toggleLaneCollapsed}
          onDependencyCreate={handleDependencyCreate}
          onDependencyDelete={handleDependencyDelete}
          onCanvasDoubleClick={canAddCard ? handleCanvasDoubleClick : undefined}
        />
      </div>
      {addCardDefaultData && (
        <AddCardModal
          defaultData={addCardDefaultData}
          onCreate={handleCardCreate}
          onClose={handleAddCardClose}
        />
      )}
    </div>
  );
});

TimelineView.propTypes = {
  cardIds: PropTypes.array.isRequired, // eslint-disable-line react/forbid-prop-types
};

export default TimelineView;
