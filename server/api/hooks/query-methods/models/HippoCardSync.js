/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const getOneByCardId = (cardId) =>
  HippoCardSync.findOne({
    cardId,
  });

// One record per card: syncing again replaces it
const createOrUpdateOne = async (cardId, values) => {
  const hippoCardSync = await getOneByCardId(cardId);

  if (hippoCardSync) {
    return HippoCardSync.updateOne(hippoCardSync.id).set({ ...values });
  }

  return HippoCardSync.create({
    ...values,
    cardId,
  }).fetch();
};

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => HippoCardSync.destroy(criteria).fetch();

module.exports = {
  getOneByCardId,
  createOrUpdateOne,
  delete: delete_,
};
