/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import socket from './socket';

/* Actions */

const getHippoTicket = (boardId, ticketNumber, headers) =>
  socket.get(`/boards/${boardId}/hippo-tickets/${ticketNumber}`, undefined, headers);

const syncHippoNote = (cardId, data, headers) =>
  socket.post(`/cards/${cardId}/hippo-sync/note`, data, headers);

const syncHippoStatus = (cardId, headers) =>
  socket.post(`/cards/${cardId}/hippo-sync/status`, undefined, headers);

const updateHippoConfig = (projectId, data, headers) =>
  socket.put(`/projects/${projectId}/hippo-config`, data, headers);

const deleteHippoConfig = (projectId, headers) =>
  socket.delete(`/projects/${projectId}/hippo-config`, undefined, headers);

const verifyHippoConfig = (projectId, headers) =>
  socket.post(`/projects/${projectId}/hippo-config/verify`, undefined, headers);

export default {
  getHippoTicket,
  syncHippoNote,
  syncHippoStatus,
  updateHippoConfig,
  deleteHippoConfig,
  verifyHippoConfig,
};
