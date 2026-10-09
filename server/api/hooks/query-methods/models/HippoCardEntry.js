/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const getByCardIdAndTicketNumber = (cardId, ticketNumber) =>
  HippoCardEntry.find({
    cardId,
    ticketNumber,
  });

// Null when the card already has a record of the entry, which another sync may have just made
const createOne = async (values) => {
  try {
    return await HippoCardEntry.create({ ...values }).fetch();
  } catch (error) {
    if (error.code === 'E_UNIQUE') {
      return null;
    }

    throw error;
  }
};

const updateOne = (id, values) => HippoCardEntry.updateOne(id).set({ ...values });

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => HippoCardEntry.destroy(criteria).fetch();

module.exports = {
  getByCardIdAndTicketNumber,
  createOne,
  updateOne,
  delete: delete_,
};
