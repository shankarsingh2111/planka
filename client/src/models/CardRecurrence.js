/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { attr } from 'redux-orm';

import BaseModel from './BaseModel';
import ActionTypes from '../constants/ActionTypes';

// Cards point at their series through recurrenceId rather than a foreign key, the same way card
// dependencies point at cards: either side may briefly be missing while socket events arrive.
export default class extends BaseModel {
  static modelName = 'CardRecurrence';

  static fields = {
    id: attr(),
    boardId: attr(),
    listId: attr(),
    weekdays: attr(),
    startTime: attr(),
    dueTime: attr(),
    dueDayOffset: attr(),
    timezone: attr(),
    startsOn: attr(),
    endsOn: attr(),
    excludedDates: attr(),
  };

  static reducer({ type, payload }, CardRecurrence) {
    switch (type) {
      case ActionTypes.SOCKET_RECONNECT_HANDLE:
        CardRecurrence.all().delete();

        break;
      case ActionTypes.CARD_RECURRENCES_FETCH__SUCCESS:
        CardRecurrence.filter({ boardId: payload.boardId }).delete();

        payload.cardRecurrences.forEach((cardRecurrence) => {
          CardRecurrence.upsert(cardRecurrence);
        });

        break;
      case ActionTypes.CARD_RECURRENCE_CREATE__SUCCESS:
      case ActionTypes.CARD_RECURRENCE_CREATE_HANDLE:
      case ActionTypes.CARD_RECURRENCE_UPDATE__SUCCESS:
      case ActionTypes.CARD_RECURRENCE_UPDATE_HANDLE:
        CardRecurrence.upsert(payload.cardRecurrence);

        break;
      // Deleting cards of a series either cuts it short or ends it, which only the server knows:
      // the requester learns which from the same socket events as everyone else
      case ActionTypes.CARD_RECURRENCE_DELETE_HANDLE: {
        const cardRecurrenceModel = CardRecurrence.withId(payload.cardRecurrence.id);

        if (cardRecurrenceModel) {
          cardRecurrenceModel.delete();
        }

        break;
      }
      default:
    }
  }
}
