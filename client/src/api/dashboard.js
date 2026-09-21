/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import socket from './socket';
import { transformCard } from './cards';

/* Actions */

const getDashboard = (data, headers) =>
  socket.get('/dashboard', data, headers).then((body) => ({
    ...body,
    items: body.items.map(transformCard),
  }));

export default {
  getDashboard,
};
