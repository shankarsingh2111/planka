/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /cards/{cardId}/card-recurrence:
 *   post:
 *     summary: Make card recurring
 *     description: Repeats the card on the given weekdays until the end date, creating every card of the series right away as a copy of this one (members, labels, task lists with tasks not done, custom fields). The card becomes the first of the series; dates already past are skipped. Requires board editor permissions.
 *     tags:
 *       - Card Recurrences
 *     operationId: createCardRecurrence
 *     parameters:
 *       - name: cardId
 *         in: path
 *         required: true
 *         description: ID of the card to repeat, which must have a due date
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
 *               - weekdays
 *               - endsOn
 *               - timezone
 *             properties:
 *               weekdays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *                 description: Days of the week to repeat on, 0 being Sunday
 *                 example: [1, 2]
 *               endsOn:
 *                 type: string
 *                 format: date
 *                 description: Last date to repeat on, at most a year ahead
 *                 example: 2026-11-30
 *               timezone:
 *                 type: string
 *                 description: IANA time zone the card's times are meant in
 *                 example: Asia/Kolkata
 *     responses:
 *       200:
 *         description: Card made recurring successfully
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
 *                       description: The card, then the cards created for the series
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
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const { idInput } = require('../../../utils/inputs');
const { isDate, isTimeZone, isWeekdays } = require('../../../utils/recurrence');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  CARD_ALREADY_RECURRING: {
    cardAlreadyRecurring: 'Card already recurring',
  },
  CARD_MUST_NOT_BE_ARCHIVED_OR_TRASHED: {
    cardMustNotBeArchivedOrTrashed: 'Card must not be archived or trashed',
  },
  DUE_DATE_MUST_BE_PRESENT: {
    dueDateMustBePresent: 'Due date must be present',
  },
  ENDS_ON_MUST_BE_WITHIN_ONE_YEAR: {
    endsOnMustBeWithinOneYear: 'Ends on must be within one year',
  },
  NO_DATES_TO_RECUR_ON: {
    noDatesToRecurOn: 'No dates to recur on',
  },
  OPEN_LIST_MUST_BE_PRESENT: {
    openListMustBePresent: 'Open list must be present',
  },
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
    weekdays: {
      type: 'json',
      custom: isWeekdays,
      required: true,
    },
    endsOn: {
      type: 'string',
      custom: isDate,
      required: true,
    },
    timezone: {
      type: 'string',
      custom: isTimeZone,
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
    cardAlreadyRecurring: {
      responseType: 'conflict',
    },
    cardMustNotBeArchivedOrTrashed: {
      responseType: 'unprocessableEntity',
    },
    dueDateMustBePresent: {
      responseType: 'unprocessableEntity',
    },
    endsOnMustBeWithinOneYear: {
      responseType: 'unprocessableEntity',
    },
    noDatesToRecurOn: {
      responseType: 'unprocessableEntity',
    },
    openListMustBePresent: {
      responseType: 'unprocessableEntity',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const { card, list, board, project } = await sails.helpers.cards
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

    if (sails.helpers.lists.isArchiveOrTrash(list)) {
      throw Errors.CARD_MUST_NOT_BE_ARCHIVED_OR_TRASHED;
    }

    const {
      cardRecurrence,
      card: nextCard,
      cards,
    } = await sails.helpers.cardRecurrences.createOne
      .with({
        project,
        board,
        list,
        values: {
          card,
          ..._.pick(inputs, ['weekdays', 'endsOn', 'timezone']),
        },
        actorUser: currentUser,
        request: this.req,
      })
      .intercept('cardAlreadyRecurring', () => Errors.CARD_ALREADY_RECURRING)
      .intercept('dueDateMustBePresent', () => Errors.DUE_DATE_MUST_BE_PRESENT)
      .intercept('endsOnMustBeWithinOneYear', () => Errors.ENDS_ON_MUST_BE_WITHIN_ONE_YEAR)
      .intercept('noDatesToRecurOn', () => Errors.NO_DATES_TO_RECUR_ON)
      .intercept('openListMustBePresent', () => Errors.OPEN_LIST_MUST_BE_PRESENT);

    return {
      item: cardRecurrence,
      included: {
        cards: [nextCard, ...cards],
      },
    };
  },
};
