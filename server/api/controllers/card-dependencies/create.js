/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /cards/{cardId}/card-dependencies:
 *   post:
 *     summary: Add dependency to card
 *     description: Makes the card depend on a predecessor card on the same board (finish-to-start). Requires board editor permissions.
 *     tags:
 *       - Card Dependencies
 *     operationId: createCardDependency
 *     parameters:
 *       - name: cardId
 *         in: path
 *         required: true
 *         description: ID of the successor (blocked) card
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - predecessorCardId
 *             properties:
 *               predecessorCardId:
 *                 type: string
 *                 description: ID of the predecessor (blocking) card
 *                 example: "1357158568008091265"
 *     responses:
 *       200:
 *         description: Dependency created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - item
 *               properties:
 *                 item:
 *                   $ref: '#/components/schemas/CardDependency'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  PREDECESSOR_CARD_NOT_FOUND: {
    predecessorCardNotFound: 'Predecessor card not found',
  },
  CARDS_MUST_BE_DIFFERENT: {
    cardsMustBeDifferent: 'Cards must be different',
  },
  CARDS_MUST_BELONG_TO_SAME_BOARD: {
    cardsMustBelongToSameBoard: 'Cards must belong to same board',
  },
  DEPENDENCY_WOULD_CREATE_CYCLE: {
    dependencyWouldCreateCycle: 'Dependency would create cycle',
  },
  DEPENDENCY_ALREADY_EXISTS: {
    dependencyAlreadyExists: 'Dependency already exists',
  },
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
    predecessorCardId: {
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
    predecessorCardNotFound: {
      responseType: 'notFound',
    },
    cardsMustBeDifferent: {
      responseType: 'unprocessableEntity',
    },
    cardsMustBelongToSameBoard: {
      responseType: 'unprocessableEntity',
    },
    dependencyWouldCreateCycle: {
      responseType: 'unprocessableEntity',
    },
    dependencyAlreadyExists: {
      responseType: 'conflict',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const {
      card: successorCard,
      board,
      project,
    } = await sails.helpers.cards
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

    const predecessorCard = await Card.qm.getOneById(inputs.predecessorCardId);

    if (!predecessorCard) {
      throw Errors.PREDECESSOR_CARD_NOT_FOUND;
    }

    const cardDependency = await sails.helpers.cardDependencies.createOne
      .with({
        project,
        board,
        values: {
          predecessorCard,
          successorCard,
        },
        actorUser: currentUser,
        request: this.req,
      })
      .intercept('cardsMustBeDifferent', () => Errors.CARDS_MUST_BE_DIFFERENT)
      .intercept('cardsMustBelongToSameBoard', () => Errors.CARDS_MUST_BELONG_TO_SAME_BOARD)
      .intercept('dependencyWouldCreateCycle', () => Errors.DEPENDENCY_WOULD_CREATE_CYCLE)
      .intercept('dependencyAlreadyExists', () => Errors.DEPENDENCY_ALREADY_EXISTS);

    return {
      item: cardDependency,
    };
  },
};
