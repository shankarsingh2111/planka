/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /cards/{cardId}/hippo-sync/status:
 *   post:
 *     summary: Push ticket state to Hippo
 *     description: Sets the Hippo ticket's status to the card's current Ticket State value. Requires board editor permissions.
 *     tags:
 *       - Hippo
 *     operationId: syncHippoStatus
 *     parameters:
 *       - name: cardId
 *         in: path
 *         required: true
 *         description: ID of the ticket card
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     responses:
 *       200:
 *         description: Status updated in Hippo
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
const {
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
} = require('../../../utils/hippo-errors');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  NOT_A_TICKET_CARD: {
    notATicketCard: 'Not a ticket card',
  },
  TICKET_STATE_MUST_BE_PRESENT: {
    ticketStateMustBePresent: 'Ticket state must be present',
  },
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    cardNotFound: {
      responseType: 'notFound',
    },
    notATicketCard: {
      responseType: 'unprocessableEntity',
    },
    ticketStateMustBePresent: {
      responseType: 'unprocessableEntity',
    },
    ...HIPPO_ERROR_EXITS,
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // ---- Step 1: Check the user may edit the card ----
    const { card, board, project } = await sails.helpers.cards
      .getPathToProjectById(inputs.cardId)
      .intercept('pathNotFound', () => Errors.CARD_NOT_FOUND);

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.CARD_NOT_FOUND; // Forbidden
    }

    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    // ---- Step 2: Read the state the card holds now ----
    const ticketValuesByCardId = await sails.helpers.hippo.getTicketValuesByCards([card]);
    const ticketValues = ticketValuesByCardId[card.id];

    if (!ticketValues) {
      throw Errors.NOT_A_TICKET_CARD;
    }

    if (!ticketValues.ticketState) {
      throw Errors.TICKET_STATE_MUST_BE_PRESENT;
    }

    const appSecretKey = await sails.helpers.hippo
      .getAppSecretKey(project.id)
      .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

    // ---- Step 3: Set it as the ticket's status in Hippo ----
    await interceptHippoExits(
      sails.helpers.hippo.updateStatus.with({
        appSecretKey,
        ticketNumber: ticketValues.ticketNumber,
        status: ticketValues.ticketState,
      }),
    );

    return {
      item: {
        cardId: card.id,
        ticketNumber: ticketValues.ticketNumber,
        ticketState: ticketValues.ticketState,
      },
    };
  },
};
