/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports.up = (knex) =>
  knex.schema.alterTable('user_account', (table) => {
    table.text('timeline_zoom_level').notNullable().defaultTo('week');
    table.text('timeline_group_by').notNullable().defaultTo('list');
    table.text('timeline_color_by').notNullable().defaultTo('status');
    table.boolean('timeline_sidebar_opened').notNullable().defaultTo(true);

    // Per-board state, keyed by board id:
    //   { "<boardId>": { hiddenLaneKeys: { list: [...] }, collapsedLaneKeys: [...] } }
    table.jsonb('timeline_board_preferences').notNullable().defaultTo('{}');
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('user_account', (table) => {
    table.dropColumn('timeline_zoom_level');
    table.dropColumn('timeline_group_by');
    table.dropColumn('timeline_color_by');
    table.dropColumn('timeline_sidebar_opened');
    table.dropColumn('timeline_board_preferences');
  });
