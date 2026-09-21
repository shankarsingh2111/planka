/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports.up = (knex) =>
  knex.schema.createTable('card_dependency', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('board_id').notNullable();
    table.bigInteger('predecessor_card_id').notNullable();
    table.bigInteger('successor_card_id').notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique(['predecessor_card_id', 'successor_card_id']);
    table.index('board_id');
    table.index('successor_card_id');
  });

module.exports.down = (knex) => knex.schema.dropTable('card_dependency');
