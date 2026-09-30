/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * The list new cards of a series go to: the first of the preferred lists that is still an open
 * list of the board, else the board's first open list. New occurrences are upcoming work, so a
 * card of the series having moved on to Done or the trash doesn't drag them along.
 */
module.exports = {
  inputs: {
    board: {
      type: 'ref',
      required: true,
    },
    preferredListIds: {
      type: 'ref',
      defaultsTo: [],
    },
  },

  async fn(inputs) {
    const lists = await List.qm.getByBoardId(inputs.board.id, {
      typeOrTypes: List.Types.ACTIVE,
    });

    const listById = _.keyBy(lists, 'id');
    const preferredListId = inputs.preferredListIds.find((listId) => listById[listId]);

    return preferredListId ? listById[preferredListId] : lists[0] || null;
  },
};
