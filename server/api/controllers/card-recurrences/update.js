/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /cards/{cardId}/card-recurrence:
 *   patch:
 *     summary: Update card series
 *     description: Applies an edit made on a card of a series to that card and to the other cards in scope - the following ones, or all of them. Done cards and cards in the archive or trash are left as they are. Only what the edit changes is written to each card. Moving the card to another day moves the cards in scope by as many days. A new repeat rule or end date deletes the open cards it no longer lands on and creates the missing ones as copies of this card. Requires board editor permissions.
 *     tags:
 *       - Card Recurrences
 *     operationId: updateCardRecurrence
 *     parameters:
 *       - name: cardId
 *         in: path
 *         required: true
 *         description: ID of the edited card of the series
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
 *               - scope
 *             properties:
 *               scope:
 *                 type: string
 *                 enum: [following, all]
 *                 description: Which other cards of the series the edit reaches
 *                 example: following
 *               name:
 *                 type: string
 *                 maxLength: 1024
 *                 description: Name of the cards
 *                 example: Standup prep
 *               description:
 *                 type: string
 *                 maxLength: 1048576
 *                 nullable: true
 *                 description: Description of the cards
 *                 example: Collect updates before the standup
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 description: New start date of this card, which sets the start time (and day) of the others
 *                 example: 2026-09-28T11:30:00.000Z
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: New due date of this card, which sets the due time (and day) of the others
 *                 example: 2026-09-28T13:30:00.000Z
 *               weekdays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *                   maximum: 6
 *                 description: New days of the week to repeat on, 0 being Sunday
 *                 example: [1, 3]
 *               endsOn:
 *                 type: string
 *                 format: date
 *                 description: New last date to repeat on, not before this card
 *                 example: 2026-12-31
 *               addUserId:
 *                 type: string
 *                 description: ID of a board member to add to the cards
 *                 example: "1357158568008091265"
 *               removeUserId:
 *                 type: string
 *                 description: ID of a user to remove from the cards
 *                 example: "1357158568008091265"
 *               addLabelId:
 *                 type: string
 *                 description: ID of a board label to add to the cards
 *                 example: "1357158568008091266"
 *               removeLabelId:
 *                 type: string
 *                 description: ID of a label to remove from the cards
 *                 example: "1357158568008091266"
 *     responses:
 *       200:
 *         description: Series updated successfully
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
 *                       description: The edited card, unless the new repeat rule left no day for it
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
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const { isDueDate } = require('../../../utils/validators');
const { idInput } = require('../../../utils/inputs');
const { isDate, isWeekdays } = require('../../../utils/recurrence');

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
  USER_NOT_FOUND: {
    userNotFound: 'User not found',
  },
  LABEL_NOT_FOUND: {
    labelNotFound: 'Label not found',
  },
  DUE_DATE_MUST_BE_PRESENT: {
    dueDateMustBePresent: 'Due date must be present',
  },
  START_DATE_MUST_BE_BEFORE_DUE_DATE: {
    startDateMustBeBeforeDueDate: 'Start date must be before due date',
  },
  ENDS_ON_MUST_NOT_BE_BEFORE_CARD: {
    endsOnMustNotBeBeforeCard: 'Ends on must not be before card',
  },
  ENDS_ON_MUST_BE_WITHIN_ONE_YEAR: {
    endsOnMustBeWithinOneYear: 'Ends on must be within one year',
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
    scope: {
      type: 'string',
      isIn: Object.values(CardRecurrence.Scopes),
      required: true,
    },
    name: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 1024,
    },
    description: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 1048576,
      allowNull: true,
    },
    startDate: {
      type: 'string',
      custom: isDueDate,
      allowNull: true,
    },
    dueDate: {
      type: 'string',
      custom: isDueDate,
    },
    weekdays: {
      type: 'json',
      custom: isWeekdays,
    },
    endsOn: {
      type: 'string',
      custom: isDate,
    },
    addUserId: idInput,
    removeUserId: idInput,
    addLabelId: idInput,
    removeLabelId: idInput,
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
    userNotFound: {
      responseType: 'notFound',
    },
    labelNotFound: {
      responseType: 'notFound',
    },
    dueDateMustBePresent: {
      responseType: 'unprocessableEntity',
    },
    startDateMustBeBeforeDueDate: {
      responseType: 'unprocessableEntity',
    },
    endsOnMustNotBeBeforeCard: {
      responseType: 'unprocessableEntity',
    },
    endsOnMustBeWithinOneYear: {
      responseType: 'unprocessableEntity',
    },
    openListMustBePresent: {
      responseType: 'unprocessableEntity',
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

    if (!_.isUndefined(inputs.startDate) || !_.isUndefined(inputs.dueDate)) {
      const nextStartDate = _.isUndefined(inputs.startDate) ? card.startDate : inputs.startDate;
      const nextDueDate = _.isUndefined(inputs.dueDate) ? card.dueDate : inputs.dueDate;

      // The series times come from the card's dates, which need a due date at least
      if (!nextDueDate) {
        throw Errors.DUE_DATE_MUST_BE_PRESENT;
      }

      if (nextStartDate && new Date(nextStartDate) > new Date(nextDueDate)) {
        throw Errors.START_DATE_MUST_BE_BEFORE_DUE_DATE;
      }
    }

    const values = _.pick(inputs, [
      'name',
      'description',
      'startDate',
      'dueDate',
      'weekdays',
      'endsOn',
    ]);

    if (inputs.addUserId) {
      const isBoardMember = await sails.helpers.users.isBoardMember(inputs.addUserId, board.id);

      if (!isBoardMember) {
        throw Errors.USER_NOT_FOUND; // Forbidden
      }

      values.userToAdd = await User.qm.getOneById(inputs.addUserId);

      if (!values.userToAdd) {
        throw Errors.USER_NOT_FOUND;
      }
    }

    if (inputs.removeUserId) {
      values.userToRemove = await User.qm.getOneById(inputs.removeUserId);

      if (!values.userToRemove) {
        throw Errors.USER_NOT_FOUND;
      }
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const [inputKey, valueKey] of [
      ['addLabelId', 'labelToAdd'],
      ['removeLabelId', 'labelToRemove'],
    ]) {
      if (inputs[inputKey]) {
        // eslint-disable-next-line no-await-in-loop
        values[valueKey] = await Label.qm.getOneById(inputs[inputKey], {
          boardId: board.id,
        });

        if (!values[valueKey]) {
          throw Errors.LABEL_NOT_FOUND;
        }
      }
    }

    const { cardRecurrence: nextCardRecurrence, card: nextCard } =
      await sails.helpers.cardRecurrences.updateOne
        .with({
          project,
          board,
          values,
          card,
          record: cardRecurrence,
          scope: inputs.scope,
          actorUser: currentUser,
          request: this.req,
        })
        .intercept('endsOnMustNotBeBeforeCard', () => Errors.ENDS_ON_MUST_NOT_BE_BEFORE_CARD)
        .intercept('endsOnMustBeWithinOneYear', () => Errors.ENDS_ON_MUST_BE_WITHIN_ONE_YEAR)
        .intercept('openListMustBePresent', () => Errors.OPEN_LIST_MUST_BE_PRESENT);

    return {
      item: nextCardRecurrence,
      included: {
        cards: nextCard ? [nextCard] : [],
      },
    };
  },
};
