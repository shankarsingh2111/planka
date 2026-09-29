/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { POSITION_GAP } = require('../../../constants');
const { getOccurrenceCardDates } = require('../../../utils/recurrence');

const toISOString = (date) => date && date.toISOString();

/**
 * Creates the cards of a series on the given dates, each a copy of the source card: its name,
 * description, members, labels, subscribers, task lists (tasks not done) and custom fields.
 * Attachments and comments stay with the source card. The cards go to the end of the list, and
 * log no activity each: making a card recurring is logged once, on the card itself.
 */
module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    sourceCard: {
      type: 'ref',
      required: true,
    },
    dates: {
      type: 'ref',
      required: true,
    },
    project: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
    list: {
      type: 'ref',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    webhooks: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const { record: cardRecurrence, sourceCard, list } = inputs;

    if (inputs.dates.length === 0) {
      return [];
    }

    const listCards = await Card.qm.getByListId(list.id);
    const lastPosition = listCards.length > 0 ? _.last(listCards).position : 0;

    const cardIds = await sails.helpers.utils.generateIds(inputs.dates.length);
    const listChangedAt = new Date().toISOString();

    const cards = await Card.qm.create(
      inputs.dates.map((date, index) => {
        const { startDate, dueDate } = getOccurrenceCardDates(cardRecurrence, date);

        return {
          ..._.pick(sourceCard, ['type', 'name', 'description']),
          id: cardIds[index],
          boardId: inputs.board.id,
          listId: list.id,
          creatorUserId: inputs.actorUser.id,
          recurrenceId: cardRecurrence.id,
          position: lastPosition + POSITION_GAP * (index + 1),
          startDate: toISOString(startDate),
          dueDate: toISOString(dueDate),
          isDueCompleted: false,
          isClosed: false,
          occurrenceDate: date,
          listChangedAt,
        };
      }),
    );

    const boardMemberUserIds = await sails.helpers.boards.getMemberUserIds(inputs.board.id);
    const boardMemberUserIdsSet = new Set(boardMemberUserIds);

    const cardMemberships = await CardMembership.qm.getByCardId(sourceCard.id, {
      userIdOrIds: boardMemberUserIds,
    });

    const nextCardMemberships = await CardMembership.qm.create(
      cards.flatMap((card) =>
        cardMemberships.map(({ userId }) => ({
          userId,
          cardId: card.id,
        })),
      ),
    );

    const cardLabels = await CardLabel.qm.getByCardId(sourceCard.id);

    const nextCardLabels = await CardLabel.qm.create(
      cards.flatMap((card) =>
        cardLabels.map(({ labelId }) => ({
          labelId,
          cardId: card.id,
        })),
      ),
    );

    const cardSubscriptions = await CardSubscription.qm.getByCardId(sourceCard.id);

    await CardSubscription.qm.create(
      cards.flatMap((card) =>
        cardSubscriptions
          .filter(({ userId }) => boardMemberUserIdsSet.has(userId))
          .map((cardSubscription) => ({
            ..._.pick(cardSubscription, ['userId', 'isPermanent']),
            cardId: card.id,
          })),
      ),
    );

    const taskLists = await TaskList.qm.getByCardId(sourceCard.id);
    const tasks = await Task.qm.getByTaskListIds(sails.helpers.utils.mapRecords(taskLists));

    const taskListIds = await sails.helpers.utils.generateIds(taskLists.length * cards.length);
    const nextTaskListIdByTaskListIdByCardId = {};

    const nextTaskLists = await TaskList.qm.create(
      cards.flatMap((card) => {
        nextTaskListIdByTaskListIdByCardId[card.id] = {};

        return taskLists.map((taskList) => {
          const id = taskListIds.shift();
          nextTaskListIdByTaskListIdByCardId[card.id][taskList.id] = id;

          return {
            ..._.pick(taskList, ['position', 'name', 'showOnFrontOfCard', 'hideCompletedTasks']),
            id,
            cardId: card.id,
          };
        });
      }),
    );

    // Each occurrence starts over, except that a task linked to a card mirrors that card
    const nextTasks = await Task.qm.create(
      cards.flatMap((card) =>
        tasks.map((task) => ({
          ..._.pick(task, ['linkedCardId', 'position', 'name']),
          taskListId: nextTaskListIdByTaskListIdByCardId[card.id][task.taskListId],
          isCompleted: task.linkedCardId ? task.isCompleted : false,
          assigneeUserId: boardMemberUserIdsSet.has(task.assigneeUserId)
            ? task.assigneeUserId
            : null,
        })),
      ),
    );

    // Copying custom fields takes a few queries per card, so it only runs when there are some
    const cardCustomFieldGroups = await CustomFieldGroup.qm.getByCardId(sourceCard.id);
    const cardCustomFieldValues = await CustomFieldValue.qm.getByCardId(sourceCard.id);

    const customFieldsByCardId = {};
    if (cardCustomFieldGroups.length > 0 || cardCustomFieldValues.length > 0) {
      // eslint-disable-next-line no-restricted-syntax
      for (const card of cards) {
        // eslint-disable-next-line no-await-in-loop
        customFieldsByCardId[card.id] = await sails.helpers.cards.copyCustomFields(
          sourceCard,
          card,
          false,
          false,
        );
      }
    }

    const cardMembershipsByCardId = _.groupBy(nextCardMemberships, 'cardId');
    const cardLabelsByCardId = _.groupBy(nextCardLabels, 'cardId');
    const taskListsByCardId = _.groupBy(nextTaskLists, 'cardId');
    const tasksByTaskListId = _.groupBy(nextTasks, 'taskListId');

    const { webhooks = await Webhook.qm.getAll() } = inputs;

    // Everything is in place before clients hear of the cards, as they fetch each one in full
    cards.forEach((card) => {
      sails.sockets.broadcast(`board:${card.boardId}`, 'cardCreate', {
        item: card,
      });

      const cardTaskLists = taskListsByCardId[card.id] || [];
      const {
        customFieldGroups = [],
        customFields = [],
        customFieldValues = [],
      } = customFieldsByCardId[card.id] || {};

      sails.helpers.utils.sendWebhooks.with({
        webhooks,
        event: Webhook.Events.CARD_CREATE,
        buildData: () => ({
          item: card,
          included: {
            projects: [inputs.project],
            boards: [inputs.board],
            lists: [list],
            cardMemberships: cardMembershipsByCardId[card.id] || [],
            cardLabels: cardLabelsByCardId[card.id] || [],
            taskLists: cardTaskLists,
            tasks: cardTaskLists.flatMap((taskList) => tasksByTaskListId[taskList.id] || []),
            attachments: [],
            customFieldGroups,
            customFields,
            customFieldValues,
          },
        }),
        user: inputs.actorUser,
      });
    });

    return cards;
  },
};
