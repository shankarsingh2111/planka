/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /cards/{cardId}/hippo-sync/note:
 *   post:
 *     summary: Post comment to Hippo
 *     description: Adds a comment of a card linked to a Hippo ticket to that ticket as a note. Requires board editor permissions.
 *     tags:
 *       - Hippo
 *     operationId: syncHippoNote
 *     parameters:
 *       - name: cardId
 *         in: path
 *         required: true
 *         description: ID of the ticket card
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
 *               - commentId
 *             properties:
 *               commentId:
 *                 type: string
 *                 description: ID of the comment to post
 *                 example: "1357158568008091265"
 *     responses:
 *       200:
 *         description: Note added in Hippo
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
const { mentionMarkupToText } = require('../../../utils/mentions');
const { buildNoteHtml } = require('../../../utils/hippo');
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
  COMMENT_NOT_FOUND: {
    commentNotFound: 'Comment not found',
  },
  NOT_A_TICKET_CARD: {
    notATicketCard: 'Not a ticket card',
  },
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
    commentId: {
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
    commentNotFound: {
      responseType: 'notFound',
    },
    notATicketCard: {
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

    // ---- Step 2: Find the comment and the ticket it goes to ----
    const comment = await Comment.qm.getOneById(inputs.commentId);

    if (!comment || comment.cardId !== card.id) {
      throw Errors.COMMENT_NOT_FOUND;
    }

    const ticketValuesByCardId = await sails.helpers.hippo.getTicketValuesByCards([card]);
    const ticketValues = ticketValuesByCardId[card.id];

    if (!ticketValues) {
      throw Errors.NOT_A_TICKET_CARD;
    }

    const appSecretKey = await sails.helpers.hippo
      .getAppSecretKey(project.id)
      .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

    // ---- Step 3: Post the comment as a note, led by its author ----
    const author =
      comment.userId === currentUser.id ? currentUser : await User.qm.getOneById(comment.userId);

    await interceptHippoExits(
      sails.helpers.hippo.addNote.with({
        appSecretKey,
        ticketNumber: ticketValues.ticketNumber,
        note: buildNoteHtml(
          author ? author.name : 'Unknown user',
          mentionMarkupToText(comment.text),
        ),
      }),
    );

    return {
      item: {
        cardId: card.id,
        commentId: comment.id,
        ticketNumber: ticketValues.ticketNumber,
      },
    };
  },
};
