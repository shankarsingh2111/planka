/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { VERIFY_ACCOUNT_PATH } = require('../../../utils/hippo');
const { HIPPO_HELPER_EXITS, forwardHippoExits } = require('../../../utils/hippo-errors');

module.exports = {
  inputs: {
    appSecretKey: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    ...HIPPO_HELPER_EXITS,
  },

  async fn(inputs) {
    await forwardHippoExits(
      sails.helpers.hippo.sendRequest.with({
        appSecretKey: inputs.appSecretKey,
        path: VERIFY_ACCOUNT_PATH,
      }),
    );

    return true;
  },
};
