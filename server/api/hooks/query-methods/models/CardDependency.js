/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const defaultFind = (criteria) => CardDependency.find(criteria).sort('id');

/* Query methods */

const createOne = (values) => CardDependency.create({ ...values }).fetch();

const getByIds = (ids) => defaultFind(ids);

const getByBoardId = (boardId) =>
  defaultFind({
    boardId,
  });

const getByCardIds = (cardIds) =>
  defaultFind({
    or: [
      {
        predecessorCardId: cardIds,
      },
      {
        successorCardId: cardIds,
      },
    ],
  });

const getOneById = (id) => CardDependency.findOne(id);

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => CardDependency.destroy(criteria).fetch();

const deleteOne = (criteria) => CardDependency.destroyOne(criteria);

module.exports = {
  createOne,
  getByIds,
  getByBoardId,
  getByCardIds,
  getOneById,
  deleteOne,
  delete: delete_,
};
