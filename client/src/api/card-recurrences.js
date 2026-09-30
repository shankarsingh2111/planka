/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import socket from './socket';
import { transformCard, transformCardData } from './cards';

/* Transformers */

const transformBody = (body) => ({
  ...body,
  included: body.included && {
    ...body.included,
    cards: body.included.cards.map(transformCard),
  },
});

/* Actions */

const getCardRecurrences = (boardId, headers) =>
  socket.get(`/boards/${boardId}/card-recurrences`, undefined, headers);

const createCardRecurrence = (cardId, data, headers) =>
  socket.post(`/cards/${cardId}/card-recurrence`, data, headers).then(transformBody);

const updateCardRecurrence = (cardId, data, headers) =>
  socket
    .patch(`/cards/${cardId}/card-recurrence`, transformCardData(data), headers)
    .then(transformBody);

const deleteCardRecurrence = (cardId, data, headers) =>
  socket.delete(`/cards/${cardId}/card-recurrence`, data, headers).then(transformBody);

export default {
  getCardRecurrences,
  createCardRecurrence,
  updateCardRecurrence,
  deleteCardRecurrence,
};
