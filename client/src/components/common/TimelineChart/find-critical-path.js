/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { diffInDays } from './utils';

// Longest chain (by total scheduled days) through the dependency graph. The server rejects
// cycles, but a visiting set keeps this safe against stale client state.
export default (dependencies, rangeById) => {
  const incomingByItemId = {};

  dependencies.forEach((dependency) => {
    if (rangeById[dependency.predecessorId] && rangeById[dependency.successorId]) {
      if (!incomingByItemId[dependency.successorId]) {
        incomingByItemId[dependency.successorId] = [];
      }

      incomingByItemId[dependency.successorId].push(dependency);
    }
  });

  const memo = {};
  const visiting = new Set();

  const getChain = (itemId) => {
    if (memo[itemId]) {
      return memo[itemId];
    }

    const range = rangeById[itemId];
    const duration = diffInDays(range.start, range.end) + 1;

    let best = { length: 0, itemIds: [], dependencyIds: [] };

    if (!visiting.has(itemId)) {
      visiting.add(itemId);

      (incomingByItemId[itemId] || []).forEach((dependency) => {
        const chain = getChain(dependency.predecessorId);

        if (chain.length > best.length) {
          best = {
            length: chain.length,
            itemIds: chain.itemIds,
            dependencyIds: [...chain.dependencyIds, dependency.id],
          };
        }
      });

      visiting.delete(itemId);
    }

    memo[itemId] = {
      length: best.length + duration,
      itemIds: [...best.itemIds, itemId],
      dependencyIds: best.dependencyIds,
    };

    return memo[itemId];
  };

  let critical = { length: 0, itemIds: [], dependencyIds: [] };

  dependencies.forEach((dependency) => {
    if (rangeById[dependency.successorId] && rangeById[dependency.predecessorId]) {
      const chain = getChain(dependency.successorId);

      if (chain.length > critical.length) {
        critical = chain;
      }
    }
  });

  return {
    itemIds: new Set(critical.itemIds),
    dependencyIds: new Set(critical.dependencyIds),
  };
};
