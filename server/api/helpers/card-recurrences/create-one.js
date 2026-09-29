/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const {
  MAX_SPAN_DAYS,
  diffDays,
  getToday,
  getTimePattern,
  getOccurrenceCardDates,
  buildOccurrenceDates,
} = require('../../../utils/recurrence');

/**
 * Makes a card recurring: every card of the series is created right away, so upcoming ones show
 * on the timeline. The card itself becomes the first one, moving to the first date the series
 * lands on; dates already past are skipped.
 */
module.exports = {
  inputs: {
    values: {
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
    request: {
      type: 'ref',
    },
  },

  exits: {
    cardAlreadyRecurring: {},
    dueDateMustBePresent: {},
    endsOnMustBeWithinOneYear: {},
    noDatesToRecurOn: {},
    openListMustBePresent: {},
  },

  async fn(inputs) {
    const { card, weekdays, endsOn, timezone } = inputs.values;

    // ---- Step 1: work out the dates ----

    if (card.recurrenceId) {
      throw 'cardAlreadyRecurring';
    }

    if (!card.dueDate) {
      throw 'dueDateMustBePresent';
    }

    const { occurrenceDate, ...timePattern } = getTimePattern(card, timezone);

    const today = getToday(timezone);
    const startsOn = occurrenceDate > today ? occurrenceDate : today;

    if (diffDays(startsOn, endsOn) > MAX_SPAN_DAYS) {
      throw 'endsOnMustBeWithinOneYear';
    }

    const dates = buildOccurrenceDates({
      weekdays,
      startsOn,
      endsOn,
    });

    if (dates.length === 0) {
      throw 'noDatesToRecurOn';
    }

    const targetList = await sails.helpers.cardRecurrences.getTargetList(inputs.board, [
      card.listId,
    ]);

    if (!targetList) {
      throw 'openListMustBePresent';
    }

    // ---- Step 2: create the series ----

    const cardRecurrence = await CardRecurrence.qm.createOne({
      ...timePattern,
      timezone,
      endsOn,
      boardId: inputs.board.id,
      listId: targetList.id,
      creatorUserId: inputs.actorUser.id,
      weekdays: [...weekdays].sort((a, b) => a - b),
      startsOn: dates[0],
      excludedDates: [],
    });

    const webhooks = await Webhook.qm.getAll();

    // ---- Step 3: the card itself becomes the first occurrence ----

    const { startDate, dueDate } = getOccurrenceCardDates(cardRecurrence, dates[0]);

    const nextCard = await sails.helpers.cards.updateOne.with({
      webhooks,
      project: inputs.project,
      board: inputs.board,
      list: inputs.list,
      record: card,
      values: {
        startDate: startDate && startDate.toISOString(),
        dueDate: dueDate.toISOString(),
        recurrenceId: cardRecurrence.id,
        occurrenceDate: dates[0],
      },
      actorUser: inputs.actorUser,
    });

    // ---- Step 4: create the other occurrences ----

    const cards = await sails.helpers.cardRecurrences.createOccurrences.with({
      webhooks,
      record: cardRecurrence,
      sourceCard: nextCard,
      dates: dates.slice(1),
      project: inputs.project,
      board: inputs.board,
      list: targetList,
      actorUser: inputs.actorUser,
    });

    // ---- Step 5: one activity entry for the whole series, on the card itself ----

    await sails.helpers.actions.createOne.with({
      webhooks,
      values: {
        type: Action.Types.CREATE_CARD_RECURRENCE,
        data: {
          card: _.pick(nextCard, ['name']),
          cardRecurrence: _.pick(cardRecurrence, ['weekdays', 'endsOn']),
          cardsTotal: cards.length + 1,
        },
        user: inputs.actorUser,
        card: nextCard,
      },
      project: inputs.project,
      board: inputs.board,
      list: inputs.list,
    });

    sails.sockets.broadcast(
      `board:${inputs.board.id}`,
      'cardRecurrenceCreate',
      {
        item: cardRecurrence,
      },
      inputs.request,
    );

    sails.helpers.utils.sendWebhooks.with({
      webhooks,
      event: Webhook.Events.CARD_RECURRENCE_CREATE,
      buildData: () => ({
        item: cardRecurrence,
        included: {
          projects: [inputs.project],
          boards: [inputs.board],
          cards: [nextCard, ...cards],
        },
      }),
      user: inputs.actorUser,
    });

    return {
      cardRecurrence,
      card: nextCard,
      cards,
    };
  },
};
