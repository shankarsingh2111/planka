/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { attr } from 'redux-orm';

import BaseModel from './BaseModel';
import ActionTypes from '../constants/ActionTypes';

// Card ids are plain attributes rather than foreign keys: a dependency may briefly outlive a
// card that was deleted or moved to another board, and consumers skip unresolved ones.
export default class extends BaseModel {
  static modelName = 'CardDependency';

  static fields = {
    id: attr(),
    boardId: attr(),
    predecessorCardId: attr(),
    successorCardId: attr(),
  };

  static reducer({ type, payload }, CardDependency) {
    switch (type) {
      case ActionTypes.SOCKET_RECONNECT_HANDLE:
        CardDependency.all().delete();

        break;
      case ActionTypes.CARD_DEPENDENCIES_FETCH__SUCCESS:
        CardDependency.filter({ boardId: payload.boardId }).delete();

        payload.cardDependencies.forEach((cardDependency) => {
          CardDependency.upsert(cardDependency);
        });

        break;
      case ActionTypes.CARD_DEPENDENCY_CREATE:
      case ActionTypes.CARD_DEPENDENCY_CREATE_HANDLE:
        CardDependency.upsert(payload.cardDependency);

        break;
      case ActionTypes.CARD_DEPENDENCY_CREATE__SUCCESS:
        CardDependency.withId(payload.localId).delete();
        CardDependency.upsert(payload.cardDependency);

        break;
      case ActionTypes.CARD_DEPENDENCY_CREATE__FAILURE:
        CardDependency.withId(payload.localId).delete();

        break;
      case ActionTypes.CARD_DEPENDENCY_DELETE:
        CardDependency.withId(payload.id).delete();

        break;
      case ActionTypes.CARD_DEPENDENCY_DELETE__SUCCESS:
      case ActionTypes.CARD_DEPENDENCY_DELETE_HANDLE: {
        const cardDependencyModel = CardDependency.withId(payload.cardDependency.id);

        if (cardDependencyModel) {
          cardDependencyModel.delete();
        }

        break;
      }
      default:
    }
  }
}
