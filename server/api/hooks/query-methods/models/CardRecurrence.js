/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const defaultFind = (criteria) => CardRecurrence.find(criteria).sort('id');

/* Query methods */

const createOne = (values) => CardRecurrence.create({ ...values }).fetch();

const getByIds = (ids) => defaultFind(ids);

const getByBoardId = (boardId) =>
  defaultFind({
    boardId,
  });

const getOneById = (id) => CardRecurrence.findOne(id);

const updateOne = (criteria, values) => CardRecurrence.updateOne(criteria).set({ ...values });

// Appends in one statement, so cards deleted at the same time don't overwrite each other's dates
const addExcludedDates = async (id, dates) => {
  const queryResult = await sails.sendNativeQuery(
    `UPDATE card_recurrence SET excluded_dates = (SELECT jsonb_agg(DISTINCT value ORDER BY value) FROM jsonb_array_elements_text(excluded_dates || $2::jsonb) AS value), updated_at = $3 WHERE id = $1 RETURNING id`,
    [id, JSON.stringify(dates), new Date().toISOString()],
  );

  return queryResult.rows.length > 0;
};

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => CardRecurrence.destroy(criteria).fetch();

const deleteOne = (criteria) => CardRecurrence.destroyOne(criteria);

module.exports = {
  createOne,
  getByIds,
  getByBoardId,
  getOneById,
  updateOne,
  addExcludedDates,
  deleteOne,
  delete: delete_,
};
