/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Get team dashboard data
 *     description: Retrieves cards across all boards visible to the current user, for the Team Dashboard and roadmap views. Cards in closed lists are limited to those closed within `closedWithinDays`.
 *     tags:
 *       - Dashboard
 *     operationId: getDashboard
 *     parameters:
 *       - name: closedWithinDays
 *         in: query
 *         required: false
 *         description: Include cards in closed lists moved there within this many days (default 30)
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 365
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - items
 *                 - included
 *               properties:
 *                 items:
 *                   type: array
 *                   description: Cards, each extended with tasksTotal and tasksCompleted
 *                   items:
 *                     $ref: '#/components/schemas/Card'
 *                 included:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *                     boards:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Board'
 *                     lists:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/List'
 *                     boardMemberships:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BoardMembership'
 *                     cardMemberships:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CardMembership'
 *                     cardDependencies:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CardDependency'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

const DEFAULT_CLOSED_WITHIN_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

module.exports = {
  inputs: {
    closedWithinDays: {
      type: 'number',
      min: 0,
      max: 365,
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // ---- Step 1: Resolve boards visible to the current user ----
    const boards = await sails.helpers.users.getVisibleBoards(currentUser);
    const boardIds = sails.helpers.utils.mapRecords(boards);

    const projectIds = sails.helpers.utils.mapRecords(boards, 'projectId', true);
    const projects = await Project.qm.getByIds(projectIds);

    // ---- Step 2: Fetch finite lists and their cards (closed cards bounded by recency) ----
    const lists = await List.qm.getByBoardIds(boardIds, {
      typeOrTypes: List.FINITE_TYPES,
    });

    const activeListIds = [];
    const closedListIds = [];

    lists.forEach((list) => {
      (list.type === List.Types.CLOSED ? closedListIds : activeListIds).push(list.id);
    });

    const closedWithinDays = _.isUndefined(inputs.closedWithinDays)
      ? DEFAULT_CLOSED_WITHIN_DAYS
      : inputs.closedWithinDays;

    const activeCards = activeListIds.length > 0 ? await Card.qm.getByListIds(activeListIds) : [];

    const closedCards =
      closedListIds.length > 0
        ? await Card.qm.getByListIds(closedListIds, {
            listChangedAfter: new Date(Date.now() - closedWithinDays * MS_PER_DAY).toISOString(),
          })
        : [];

    const cards = [...activeCards, ...closedCards];
    const cardIds = sails.helpers.utils.mapRecords(cards);

    // ---- Step 3: Fetch memberships, dependencies and task progress ----
    const cardMemberships = await CardMembership.qm.getByCardIds(cardIds);
    const cardDependencies = await CardDependency.qm.getByCardIds(cardIds);

    const taskLists = await TaskList.qm.getByCardIds(cardIds);
    const tasks = await Task.qm.getByTaskListIds(sails.helpers.utils.mapRecords(taskLists));

    const cardIdByTaskListId = taskLists.reduce(
      (result, taskList) => ({
        ...result,
        [taskList.id]: taskList.cardId,
      }),
      {},
    );

    const taskProgressByCardId = {};
    tasks.forEach((task) => {
      const cardId = cardIdByTaskListId[task.taskListId];

      if (!taskProgressByCardId[cardId]) {
        taskProgressByCardId[cardId] = { total: 0, completed: 0 };
      }

      taskProgressByCardId[cardId].total += 1;

      if (task.isCompleted) {
        taskProgressByCardId[cardId].completed += 1;
      }
    });

    cards.forEach((card) => {
      const taskProgress = taskProgressByCardId[card.id];

      /* eslint-disable no-param-reassign */
      card.tasksTotal = taskProgress ? taskProgress.total : 0;
      card.tasksCompleted = taskProgress ? taskProgress.completed : 0;
      /* eslint-enable no-param-reassign */
    });

    // ---- Step 4: Fetch users (board members + card members) ----
    const boardMemberships = await BoardMembership.qm.getByBoardIds(boardIds);

    const userIds = _.union(
      sails.helpers.utils.mapRecords(boardMemberships, 'userId'),
      sails.helpers.utils.mapRecords(cardMemberships, 'userId'),
    );

    const users = await User.qm.getByIds(userIds);

    return {
      items: cards,
      included: {
        projects,
        boards,
        lists,
        boardMemberships,
        cardMemberships,
        cardDependencies,
        users: sails.helpers.users.presentMany(users, currentUser),
      },
    };
  },
};
