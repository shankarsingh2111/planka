/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Which Hippo notes and comments each card has, so a sync never brings one in twice, and when
// each card was last synced, so refreshes on open stay a few minutes apart
module.exports.up = async (knex) => {
  await knex.schema.createTable('hippo_card_entry', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('card_id').notNullable();
    table.bigInteger('comment_id');

    table.text('ticket_number').notNullable();
    table.text('entry_id').notNullable();
    table.text('kind').notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique(['card_id', 'ticket_number', 'entry_id']);
  });

  return knex.schema.createTable('hippo_card_sync', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('card_id').notNullable();

    table.text('ticket_number').notNullable();
    table.timestamp('synced_at', true).notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique('card_id');
  });
};

module.exports.down = async (knex) => {
  await knex.schema.dropTable('hippo_card_sync');

  return knex.schema.dropTable('hippo_card_entry');
};
