/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * Deletes cards on behalf of a series change. Unlike a card deleted by hand, whose date the
 * series then skips for good, these don't mark their dates as excluded: a later change may bring
 * the series back to them.
 */
module.exports = {
  inputs: {
    records: {
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
    listById: {
      type: 'ref',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const cards = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const record of inputs.records) {
      // eslint-disable-next-line no-await-in-loop
      const card = await sails.helpers.cards.deleteOne.with({
        project: inputs.project,
        board: inputs.board,
        list: inputs.listById[record.listId],
        // Leaving the series first keeps its date from being excluded
        record: {
          ...record,
          recurrenceId: null,
          occurrenceDate: null,
        },
        actorUser: inputs.actorUser,
      });

      if (card) {
        cards.push(card);
      }
    }

    return cards;
  },
};
