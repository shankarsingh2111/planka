/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    project: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
    list: {
      type: 'ref',
      required: true,
    },
    card: {
      type: 'ref',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    // The comment's attachments go with it, each through the usual path so its file is cleaned
    // up and open boards and webhooks hear about it
    const attachments = await Attachment.qm.getByCommentId(inputs.record.id);

    // eslint-disable-next-line no-restricted-syntax
    for (const attachment of attachments) {
      // eslint-disable-next-line no-await-in-loop
      await sails.helpers.attachments.deleteOne.with({
        record: attachment,
        project: inputs.project,
        board: inputs.board,
        list: inputs.list,
        card: inputs.card,
        actorUser: inputs.actorUser,
        request: inputs.request,
      });
    }

    const comment = await Comment.qm.deleteOne(inputs.record.id);

    if (comment) {
      sails.sockets.broadcast(
        `board:${inputs.board.id}`,
        'commentDelete',
        {
          item: comment,
        },
        inputs.request,
      );

      const webhooks = await Webhook.qm.getAll();

      sails.helpers.utils.sendWebhooks.with({
        webhooks,
        event: Webhook.Events.COMMENT_DELETE,
        buildData: () => ({
          item: comment,
          included: {
            projects: [inputs.project],
            boards: [inputs.board],
            lists: [inputs.list],
            cards: [inputs.card],
          },
        }),
        user: inputs.actorUser,
      });
    }

    return comment;
  },
};
