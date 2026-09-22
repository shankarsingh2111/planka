/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports.up = async (knex) => {
  await knex.schema.alterTable('user_account', (table) => {
    table.boolean('show_extra_board_views').notNullable().defaultTo(false);
    table.boolean('show_quarter_timeline_zoom').notNullable().defaultTo(false);
  });

  return knex.schema.alterTable('user_account', (table) => {
    table.boolean('show_extra_board_views').notNullable().alter();
    table.boolean('show_quarter_timeline_zoom').notNullable().alter();
  });
};

module.exports.down = (knex) =>
  knex.schema.alterTable('user_account', (table) => {
    table.dropColumn('show_extra_board_views');
    table.dropColumn('show_quarter_timeline_zoom');
  });
