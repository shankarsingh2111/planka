/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectPath } from './router';
import { isLocalId } from '../utils/local-id';

export const selectCardDependenciesForCurrentBoard = createSelector(
  orm,
  (state) => selectPath(state).boardId,
  ({ CardDependency }, boardId) => {
    if (!boardId) {
      return [];
    }

    return CardDependency.filter({ boardId })
      .toRefArray()
      .map((cardDependency) => ({
        ...cardDependency,
        isPersisted: !isLocalId(cardDependency.id),
      }));
  },
);

export default {
  selectCardDependenciesForCurrentBoard,
};
