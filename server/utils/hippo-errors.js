/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Exits every helper that ends up calling Hippo may take
const HIPPO_HELPER_EXITS = {
  hippoUnauthorized: {},
  hippoTicketNotFound: {},
  hippoUnavailable: {},
  hippoRejected: {},
};

// Lets a helper that calls sendRequest end in the same exits, Hippo's message included
const forwardHippoExits = (deferred) =>
  deferred
    .intercept('hippoUnauthorized', 'hippoUnauthorized')
    .intercept('hippoTicketNotFound', 'hippoTicketNotFound')
    .intercept('hippoUnavailable', 'hippoUnavailable')
    .intercept('hippoRejected', (message) => ({
      hippoRejected: message,
    }));

// How controllers report a failed Hippo call. None answers 401, which would sign the Planka user
// out. The client translates these messages; Hippo's own refusals pass through as Hippo words them.
const HippoErrors = {
  HIPPO_NOT_CONFIGURED: {
    hippoNotConfigured: 'Hippo not configured',
  },
  HIPPO_KEY_INVALID: {
    hippoKeyInvalid: 'Hippo key invalid',
  },
  HIPPO_TICKET_NOT_FOUND: {
    hippoTicketNotFound: 'Hippo ticket not found',
  },
  HIPPO_UNAVAILABLE: {
    hippoUnavailable: 'Hippo unavailable',
  },
};

const HIPPO_ERROR_EXITS = {
  hippoNotConfigured: {
    responseType: 'unprocessableEntity',
  },
  hippoKeyInvalid: {
    responseType: 'unprocessableEntity',
  },
  hippoTicketNotFound: {
    responseType: 'notFound',
  },
  hippoUnavailable: {
    responseType: 'unprocessableEntity',
  },
  hippoRejected: {
    responseType: 'unprocessableEntity',
  },
};

const interceptHippoExits = (deferred) =>
  deferred
    .intercept('hippoUnauthorized', () => HippoErrors.HIPPO_KEY_INVALID)
    .intercept('hippoTicketNotFound', () => HippoErrors.HIPPO_TICKET_NOT_FOUND)
    .intercept('hippoUnavailable', () => HippoErrors.HIPPO_UNAVAILABLE)
    .intercept('hippoRejected', (message) => ({
      hippoRejected: message,
    }));

module.exports = {
  HIPPO_HELPER_EXITS,
  forwardHippoExits,
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
};
