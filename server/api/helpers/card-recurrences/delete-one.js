/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { addDays } = require('../../../utils/recurrence');

/**
 * Deletes a card of a series along with the following ones, or with all of them. Done cards and
 * cards in the archive or trash are history and stay. Deleting the following cards ends the
 * series the day before; deleting all of them, or following ones from the very first, ends the
 * series itself, and the cards that stay become ordinary cards.
 */
module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    card: {
      type: 'ref',
      required: true,
    },
    // One of CardRecurrence.Scopes (models aren't loaded yet when helpers are defined)
    scope: {
      type: 'string',
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
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const { record: cardRecurrence, card, scope } = inputs;

    const lists = await List.qm.getByBoardId(inputs.board.id);
    const listById = _.keyBy(lists, 'id');

    const isOpen = (seriesCard) =>
      !seriesCard.isClosed &&
      !seriesCard.isDueCompleted &&
      !!listById[seriesCard.listId] &&
      !sails.helpers.lists.isArchiveOrTrash(listById[seriesCard.listId]);

    // ---- Step 1: delete the card and the open cards in scope ----

    const seriesCards = await Card.qm.getByRecurrenceId(cardRecurrence.id, {
      boardId: inputs.board.id,
    });

    const cardsToDelete = seriesCards.filter(
      (seriesCard) =>
        seriesCard.id === card.id ||
        (isOpen(seriesCard) &&
          (scope === CardRecurrence.Scopes.ALL ||
            seriesCard.occurrenceDate >= card.occurrenceDate)),
    );

    const cards = await sails.helpers.cardRecurrences.deleteCards.with({
      listById,
      records: cardsToDelete,
      project: inputs.project,
      board: inputs.board,
      actorUser: inputs.actorUser,
    });

    const webhooks = await Webhook.qm.getAll();

    // ---- Step 2a: following cards only - the series ends the day before ----

    const endsOn = addDays(card.occurrenceDate, -1);

    if (scope === CardRecurrence.Scopes.FOLLOWING && endsOn >= cardRecurrence.startsOn) {
      const nextCardRecurrence = await CardRecurrence.qm.updateOne(cardRecurrence.id, {
        endsOn,
      });

      if (nextCardRecurrence) {
        // The requester hears of it too: only the server knows whether the series was ended
        // or only cut short
        sails.sockets.broadcast(`board:${inputs.board.id}`, 'cardRecurrenceUpdate', {
          item: nextCardRecurrence,
        });

        sails.helpers.utils.sendWebhooks.with({
          webhooks,
          event: Webhook.Events.CARD_RECURRENCE_UPDATE,
          buildData: () => ({
            item: nextCardRecurrence,
            included: {
              projects: [inputs.project],
              boards: [inputs.board],
            },
          }),
          buildPrevData: () => ({
            item: cardRecurrence,
            included: {
              projects: [inputs.project],
              boards: [inputs.board],
            },
          }),
          user: inputs.actorUser,
        });
      }

      return {
        cards,
        cardRecurrence: nextCardRecurrence,
      };
    }

    // ---- Step 2b: all cards - the series ends, and the cards left become ordinary ones ----

    const { cards: detachedCards } = await Card.qm.update(
      {
        recurrenceId: cardRecurrence.id,
      },
      {
        recurrenceId: null,
        occurrenceDate: null,
      },
    );

    detachedCards.forEach((detachedCard) => {
      sails.sockets.broadcast(`board:${detachedCard.boardId}`, 'cardUpdate', {
        item: detachedCard,
      });
    });

    const deletedCardRecurrence = await CardRecurrence.qm.deleteOne(cardRecurrence.id);

    if (deletedCardRecurrence) {
      sails.sockets.broadcast(`board:${inputs.board.id}`, 'cardRecurrenceDelete', {
        item: deletedCardRecurrence,
      });

      sails.helpers.utils.sendWebhooks.with({
        webhooks,
        event: Webhook.Events.CARD_RECURRENCE_DELETE,
        buildData: () => ({
          item: deletedCardRecurrence,
          included: {
            projects: [inputs.project],
            boards: [inputs.board],
          },
        }),
        user: inputs.actorUser,
      });
    }

    return {
      cards,
      cardRecurrence: deletedCardRecurrence,
    };
  },
};
