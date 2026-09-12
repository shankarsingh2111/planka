/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports.up = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.timestamp('start_date', { useTz: true });
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.dropColumn('start_date');
  });
