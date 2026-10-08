const { expect } = require('chai');
// The runtime Sails builds helpers and actions with, so exits behave here as they do in the app
// eslint-disable-next-line import/no-extraneous-dependencies
const buildMachine = require('machine');

const {
  HIPPO_HELPER_EXITS,
  forwardHippoExits,
  interceptHippoExits,
} = require('../../utils/hippo-errors');

// The same layering the Hippo helpers use: sendRequest refuses, a per-call helper forwards the
// refusal, and the controller turns it into its own exit
const sendRequest = buildMachine({
  identity: 'send-request',
  inputs: {},
  exits: { ...HIPPO_HELPER_EXITS },
  fn: async () => {
    throw {
      hippoRejected: 'Invalid status',
    };
  },
});

const updateStatus = buildMachine({
  identity: 'update-status',
  inputs: {},
  exits: { ...HIPPO_HELPER_EXITS },
  fn: async () => forwardHippoExits(sendRequest()),
});

describe('hippo-errors', () => {
  it("carries Hippo's own refusal message through both helper layers to the controller", async () => {
    let thrown;

    try {
      await interceptHippoExits(updateStatus());
    } catch (error) {
      thrown = error;
    }

    // Thrown outside an action, the exit signal arrives wrapped; raw is what the action runner reads
    expect(thrown.raw).to.deep.equal({
      hippoRejected: 'Invalid status',
    });
  });
});
