/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /card-dependencies/{id}:
 *   delete:
 *     summary: Delete card dependency
 *     description: Removes a dependency between two cards. Requires board editor permissions.
 *     tags:
 *       - Card Dependencies
 *     operationId: deleteCardDependency
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID of the dependency to delete
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     responses:
 *       200:
 *         description: Dependency deleted successfully
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
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_DEPENDENCY_NOT_FOUND: {
    cardDependencyNotFound: 'Card dependency not found',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    cardDependencyNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    let cardDependency = await CardDependency.qm.getOneById(inputs.id);

    if (!cardDependency) {
      throw Errors.CARD_DEPENDENCY_NOT_FOUND;
    }

    const { board, project } = await sails.helpers.boards
      .getPathToProjectById(cardDependency.boardId)
      .intercept('pathNotFound', () => Errors.CARD_DEPENDENCY_NOT_FOUND);

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.CARD_DEPENDENCY_NOT_FOUND; // Forbidden
    }

    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    cardDependency = await sails.helpers.cardDependencies.deleteOne.with({
      project,
      board,
      record: cardDependency,
      actorUser: currentUser,
      request: this.req,
    });

    if (!cardDependency) {
      throw Errors.CARD_DEPENDENCY_NOT_FOUND;
    }

    return {
      item: cardDependency,
    };
  },
};
