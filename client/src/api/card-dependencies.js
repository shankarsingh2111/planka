/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import socket from './socket';

/* Actions */

const getCardDependencies = (boardId, headers) =>
  socket.get(`/boards/${boardId}/card-dependencies`, undefined, headers);

const createCardDependency = (cardId, data, headers) =>
  socket.post(`/cards/${cardId}/card-dependencies`, data, headers);

const deleteCardDependency = (id, headers) =>
  socket.delete(`/card-dependencies/${id}`, undefined, headers);

export default {
  getCardDependencies,
  createCardDependency,
  deleteCardDependency,
};
