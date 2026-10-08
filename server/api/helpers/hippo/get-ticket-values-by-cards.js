/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { HIPPO_GROUP_NAME, getTicketValuesByCardId } = require('../../../utils/hippo');

// The Hippo values of whichever of the cards are linked to a ticket, read in a few batched queries
module.exports = {
  inputs: {
    cards: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    if (inputs.cards.length === 0) {
      return {};
    }

    const cardIds = sails.helpers.utils.mapRecords(inputs.cards);
    const boardIds = sails.helpers.utils.mapRecords(inputs.cards, 'boardId', true);

    const boardCustomFieldGroups = await CustomFieldGroup.qm.getByBoardIds(boardIds);
    const cardCustomFieldGroups = await CustomFieldGroup.qm.getByCardIds(cardIds);

    const customFieldGroups = [...boardCustomFieldGroups, ...cardCustomFieldGroups].filter(
      (customFieldGroup) => customFieldGroup.name === HIPPO_GROUP_NAME,
    );

    if (customFieldGroups.length === 0) {
      return {};
    }

    const customFieldGroupIds = sails.helpers.utils.mapRecords(customFieldGroups);
    const customFields = await CustomField.qm.getByCustomFieldGroupIds(customFieldGroupIds);

    const customFieldValues = await CustomFieldValue.qm.getByCardIds(cardIds, {
      customFieldGroupIdOrIds: customFieldGroupIds,
    });

    return getTicketValuesByCardId({
      cards: inputs.cards,
      customFieldGroups,
      customFields,
      customFieldValues,
    });
  },
};
