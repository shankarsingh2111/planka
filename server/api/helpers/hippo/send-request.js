/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { ProxyAgent } = require('undici');

const {
  HIPPO_API_URL,
  REQUEST_TIMEOUT_MS,
  HippoExits,
  classifyHippoResponse,
} = require('../../../utils/hippo');
const { HIPPO_HELPER_EXITS } = require('../../../utils/hippo-errors');

/**
 * The one place that talks to Hippo. A body makes it a POST; without one it is a GET carrying the
 * key in the query, as verifyAccount wants. The key never reaches a log line.
 */
module.exports = {
  inputs: {
    appSecretKey: {
      type: 'string',
      required: true,
    },
    path: {
      type: 'string',
      required: true,
    },
    body: {
      type: 'json',
    },
  },

  exits: {
    ...HIPPO_HELPER_EXITS,
  },

  async fn(inputs) {
    const url = new URL(inputs.path, HIPPO_API_URL);

    const options = {
      method: inputs.body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      dispatcher: sails.config.custom.outgoingProxy
        ? new ProxyAgent(sails.config.custom.outgoingProxy)
        : undefined,
    };

    if (inputs.body) {
      options.body = JSON.stringify({
        ...inputs.body,
        app_secret_key: inputs.appSecretKey,
      });
    } else {
      url.searchParams.set('app_secret_key', inputs.appSecretKey);
    }

    let response;
    let body;

    try {
      response = await fetch(url, options);
      body = await response.json().catch(() => null);
    } catch (error) {
      sails.log.warn(`Hippo request to ${inputs.path} failed: ${error.message}`);
      throw HippoExits.UNAVAILABLE;
    }

    const result = classifyHippoResponse(response.status, body);

    if (result.exit === HippoExits.REJECTED) {
      sails.log.warn(`Hippo refused a request to ${inputs.path}: ${result.message}`);

      throw {
        [HippoExits.REJECTED]: result.message,
      };
    }

    if (result.exit) {
      throw result.exit;
    }

    return result.data;
  },
};
