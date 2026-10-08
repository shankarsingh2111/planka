/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { TICKETING_PATH, buildUpdateStatusBody } = require('../../../utils/hippo');
const { HIPPO_HELPER_EXITS, forwardHippoExits } = require('../../../utils/hippo-errors');

module.exports = {
  inputs: {
    appSecretKey: {
      type: 'string',
      required: true,
    },
    ticketNumber: {
      type: 'string',
      required: true,
    },
    status: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    ...HIPPO_HELPER_EXITS,
  },

  async fn(inputs) {
    return forwardHippoExits(
      sails.helpers.hippo.sendRequest.with({
        appSecretKey: inputs.appSecretKey,
        path: TICKETING_PATH,
        body: buildUpdateStatusBody(inputs.ticketNumber, inputs.status),
      }),
    );
  },
};
