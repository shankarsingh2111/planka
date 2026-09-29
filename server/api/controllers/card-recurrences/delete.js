/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /cards/{cardId}/card-recurrence:
 *   delete:
 *     summary: Delete cards of a series
 *     description: Deletes a card of a series along with the following cards, or with all of them. Done cards and cards in the archive or trash are left as they are. Deleting the following cards ends the series the day before this card; deleting all of them ends the series itself, and the cards left become ordinary cards. To delete this card alone, delete the card. Requires board editor permissions.
 *     tags:
 *       - Card Recurrences
 *     operationId: deleteCardRecurrence
 *     parameters:
 *       - name: cardId
 *         in: path
 *         required: true
 *         description: ID of the card of the series to delete from
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *       - name: scope
 *         in: query
 *         required: true
 *         description: Whether to delete the following cards or all of them
 *         schema:
 *           type: string
 *           enum: [following, all]
 *           example: following
 *     responses:
 *       200:
 *         description: Cards deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - item
 *                 - included
 *               properties:
 *                 item:
 *                   $ref: '#/components/schemas/CardRecurrence'
 *                 included:
 *                   type: object
 *                   required:
 *                     - cards
 *                   properties:
 *                     cards:
 *                       type: array
 *                       description: The deleted cards
 *                       items:
 *                         $ref: '#/components/schemas/Card'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  CARD_RECURRENCE_NOT_FOUND: {
    cardRecurrenceNotFound: 'Card recurrence not found',
  },
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
    scope: {
      type: 'string',
      isIn: Object.values(CardRecurrence.Scopes),
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
    cardRecurrenceNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

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

    let cardRecurrence;
    if (card.recurrenceId) {
      cardRecurrence = await CardRecurrence.qm.getOneById(card.recurrenceId);
    }

    if (!cardRecurrence || cardRecurrence.boardId !== board.id) {
      throw Errors.CARD_RECURRENCE_NOT_FOUND;
    }

    const { cardRecurrence: nextCardRecurrence, cards } =
      await sails.helpers.cardRecurrences.deleteOne.with({
        project,
        board,
        card,
        record: cardRecurrence,
        scope: inputs.scope,
        actorUser: currentUser,
        request: this.req,
      });

    return {
      item: nextCardRecurrence,
      included: {
        cards,
      },
    };
  },
};
