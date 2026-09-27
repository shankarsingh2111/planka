/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import socket from './socket';

/* Actions */

const getStorage = (headers) => socket.get('/storage', undefined, headers);

const exportStorageToS3 = (data, headers) => socket.post('/storage/export-to-s3', data, headers);

export default {
  getStorage,
  exportStorageToS3,
};
