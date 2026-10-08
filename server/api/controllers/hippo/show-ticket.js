/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /boards/{boardId}/hippo-tickets/{ticketNumber}:
 *   get:
 *     summary: Look up Hippo ticket
 *     description: Fetches a Hippo ticket for prefilling a new card on the board. Assignees come matched to board members by email; emails are not returned. Requires board editor permissions.
 *     tags:
 *       - Hippo
 *     operationId: getHippoTicket
 *     parameters:
 *       - name: boardId
 *         in: path
 *         required: true
 *         description: ID of the board the card will be added to
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *       - name: ticketNumber
 *         in: path
 *         required: true
 *         description: Visible Hippo ticket number
 *         schema:
 *           type: string
 *           example: "43886"
 *     responses:
 *       200:
 *         description: Ticket found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const { idInput } = require('../../../utils/inputs');
const { mapTicket, matchAssignees } = require('../../../utils/hippo');
const {
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
} = require('../../../utils/hippo-errors');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  BOARD_NOT_FOUND: {
    boardNotFound: 'Board not found',
  },
};

module.exports = {
  inputs: {
    boardId: {
      ...idInput,
      required: true,
    },
    ticketNumber: {
      type: 'string',
      regex: /^\d{1,12}$/,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    boardNotFound: {
      responseType: 'notFound',
    },
    ...HIPPO_ERROR_EXITS,
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // ---- Step 1: Check the user may add cards to the board ----
    const { board, project } = await sails.helpers.boards
      .getPathToProjectById(inputs.boardId)
      .intercept('pathNotFound', () => Errors.BOARD_NOT_FOUND);

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.BOARD_NOT_FOUND; // Forbidden
    }

    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    // ---- Step 2: Fetch the ticket from Hippo ----
    const appSecretKey = await sails.helpers.hippo
      .getAppSecretKey(project.id)
      .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

    const data = await interceptHippoExits(
      sails.helpers.hippo.fetchTicket.with({
        appSecretKey,
        ticketNumber: inputs.ticketNumber,
      }),
    );

    if (!data) {
      throw HippoErrors.HIPPO_TICKET_NOT_FOUND;
    }

    // ---- Step 3: Match assignees to board members; emails never leave the server ----
    const ticket = mapTicket(data, inputs.ticketNumber);

    const boardMemberships = await BoardMembership.qm.getByBoardId(board.id);

    const users = await User.qm.getByIds(
      sails.helpers.utils.mapRecords(boardMemberships, 'userId'),
      {
        withDeactivated: false,
      },
    );

    return {
      item: {
        ...ticket,
        assignees: matchAssignees(ticket.assignees, users),
      },
    };
  },
};
