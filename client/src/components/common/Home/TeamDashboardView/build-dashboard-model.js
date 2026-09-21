/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { BoardMembershipRoles } from '../../../../constants/Enums';
import { isCardDone, isCardOverdue } from '../../TimelineChart/card-status';

export const Statuses = {
  DONE: 'done',
  ACTIVE: 'active',
  UPCOMING: 'upcoming',
};

export const SummaryKeys = {
  OVERDUE: 'overdue',
  DUE_THIS_WEEK: 'dueThisWeek',
  IN_PROGRESS: 'inProgress',
  COMPLETED_THIS_WEEK: 'completedThisWeek',
  UNASSIGNED: 'unassigned',
};

export const DateRanges = {
  ALL: 'all',
  THIS_WEEK: 'thisWeek',
  NEXT_TWO_WEEKS: 'nextTwoWeeks',
  THIS_MONTH: 'thisMonth',
  THIS_QUARTER: 'thisQuarter',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const indexById = (records = []) =>
  records.reduce(
    (result, record) => ({
      ...result,
      [record.id]: record,
    }),
    {},
  );

export const getDateRangeBounds = (dateRange, now = new Date()) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  switch (dateRange) {
    case DateRanges.THIS_WEEK:
      return { start: weekStart, end: new Date(weekStart.getTime() + 7 * MS_PER_DAY) };
    case DateRanges.NEXT_TWO_WEEKS:
      return { start: today, end: new Date(today.getTime() + 14 * MS_PER_DAY) };
    case DateRanges.THIS_MONTH:
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 1),
      };
    case DateRanges.THIS_QUARTER: {
      const quarterMonth = Math.floor(today.getMonth() / 3) * 3;

      return {
        start: new Date(today.getFullYear(), quarterMonth, 1),
        end: new Date(today.getFullYear(), quarterMonth + 3, 1),
      };
    }
    default:
      return null;
  }
};

// Normalizes the /api/dashboard payload into enriched card entries with computed status flags
export const buildDashboardModel = (data, currentUserId, now = new Date()) => {
  const projectById = indexById(data.projects);
  const boardById = indexById(data.boards);
  const listById = indexById(data.lists);
  const userById = indexById(data.users);

  const userIdsByCardId = {};
  (data.cardMemberships || []).forEach(({ cardId, userId }) => {
    if (!userIdsByCardId[cardId]) {
      userIdsByCardId[cardId] = [];
    }

    userIdsByCardId[cardId].push(userId);
  });

  const editableBoardIds = new Set(
    (data.boardMemberships || []).flatMap((boardMembership) =>
      boardMembership.userId === currentUserId &&
      boardMembership.role === BoardMembershipRoles.EDITOR
        ? boardMembership.boardId
        : [],
    ),
  );

  const weekAhead = new Date(now.getTime() + 7 * MS_PER_DAY);
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);

  const entries = data.cards.flatMap((card) => {
    const list = listById[card.listId];
    const board = boardById[card.boardId];

    if (!list || !board) {
      return [];
    }

    const project = projectById[board.projectId];
    const userIds = userIdsByCardId[card.id] || [];

    const isDone = isCardDone(card, list);
    const isOverdue = isCardOverdue(card, isDone, now);

    let status;
    if (isDone) {
      status = Statuses.DONE;
    } else if (
      (card.startDate && card.startDate > now) ||
      (!card.startDate && card.dueDate && card.dueDate > weekAhead)
    ) {
      status = Statuses.UPCOMING;
    } else {
      status = Statuses.ACTIVE;
    }

    return {
      card,
      list,
      board,
      project,
      userIds,
      isDone,
      isOverdue,
      status,
      isEditable: editableBoardIds.has(board.id),
      summaryKeys: new Set(
        [
          isOverdue && SummaryKeys.OVERDUE,
          !isDone &&
            card.dueDate &&
            card.dueDate >= now &&
            card.dueDate <= weekAhead &&
            SummaryKeys.DUE_THIS_WEEK,
          status === Statuses.ACTIVE && SummaryKeys.IN_PROGRESS,
          isDone && card.listChangedAt >= weekAgo && SummaryKeys.COMPLETED_THIS_WEEK,
          !isDone && userIds.length === 0 && SummaryKeys.UNASSIGNED,
        ].filter(Boolean),
      ),
    };
  });

  return {
    entries,
    projects: data.projects,
    boards: data.boards,
    users: data.users,
    projectById,
    boardById,
    userById,
    cardDependencies: data.cardDependencies || [],
  };
};

const overlaps = (card, bounds) => {
  const start = card.startDate || card.dueDate;
  const end = card.dueDate || card.startDate;

  if (!start) {
    return false;
  }

  return start < bounds.end && end >= bounds.start;
};

export const filterEntries = (entries, { userIds, projectIds, dateRange, includeDone }) => {
  const userIdsSet = new Set(userIds);
  const projectIdsSet = new Set(projectIds);
  const bounds = getDateRangeBounds(dateRange);

  return entries.filter((entry) => {
    if (!includeDone && entry.isDone) {
      return false;
    }

    if (userIdsSet.size > 0 && !entry.userIds.some((userId) => userIdsSet.has(userId))) {
      return false;
    }

    if (projectIdsSet.size > 0 && (!entry.project || !projectIdsSet.has(entry.project.id))) {
      return false;
    }

    if (bounds && !overlaps(entry.card, bounds)) {
      return false;
    }

    return true;
  });
};
