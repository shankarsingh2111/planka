/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Returns true if successorCardId can already reach predecessorCardId, i.e. adding
// predecessor -> successor would close a cycle.
const wouldCreateCycle = (cardDependencies, predecessorCardId, successorCardId) => {
  const successorIdsByCardId = cardDependencies.reduce((result, cardDependency) => {
    if (!result[cardDependency.predecessorCardId]) {
      // eslint-disable-next-line no-param-reassign
      result[cardDependency.predecessorCardId] = [];
    }

    result[cardDependency.predecessorCardId].push(cardDependency.successorCardId);
    return result;
  }, {});

  const visited = new Set();
  const stack = [successorCardId];

  while (stack.length > 0) {
    const cardId = stack.pop();

    if (cardId === predecessorCardId) {
      return true;
    }

    if (!visited.has(cardId)) {
      visited.add(cardId);
      stack.push(...(successorIdsByCardId[cardId] || []));
    }
  }

  return false;
};

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
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  exits: {
    cardsMustBeDifferent: {},
    cardsMustBelongToSameBoard: {},
    dependencyWouldCreateCycle: {},
    dependencyAlreadyExists: {},
  },

  async fn(inputs) {
    const { values } = inputs;
    const { predecessorCard, successorCard } = values;

    if (predecessorCard.id === successorCard.id) {
      throw 'cardsMustBeDifferent';
    }

    if (predecessorCard.boardId !== inputs.board.id || successorCard.boardId !== inputs.board.id) {
      throw 'cardsMustBelongToSameBoard';
    }

    const boardCardDependencies = await CardDependency.qm.getByBoardId(inputs.board.id);

    if (wouldCreateCycle(boardCardDependencies, predecessorCard.id, successorCard.id)) {
      throw 'dependencyWouldCreateCycle';
    }

    let cardDependency;
    try {
      cardDependency = await CardDependency.qm.createOne({
        boardId: inputs.board.id,
        predecessorCardId: predecessorCard.id,
        successorCardId: successorCard.id,
      });
    } catch (error) {
      if (error.code === 'E_UNIQUE') {
        throw 'dependencyAlreadyExists';
      }

      throw error;
    }

    sails.sockets.broadcast(
      `board:${inputs.board.id}`,
      'cardDependencyCreate',
      {
        item: cardDependency,
      },
      inputs.request,
    );

    const webhooks = await Webhook.qm.getAll();

    sails.helpers.utils.sendWebhooks.with({
      webhooks,
      event: Webhook.Events.CARD_DEPENDENCY_CREATE,
      buildData: () => ({
        item: cardDependency,
        included: {
          projects: [inputs.project],
          boards: [inputs.board],
          cards: [predecessorCard, successorCard],
        },
      }),
      user: inputs.actorUser,
    });

    return cardDependency;
  },
};
