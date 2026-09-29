/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Series dates are wall-clock dates ("YYYY-MM-DD") in the series' time zone, so they are kept as
// text rather than as DATE, which the pg driver would turn into a server-local midnight
module.exports.up = async (knex) => {
  await knex.schema.createTable('card_recurrence', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('board_id').notNullable();
    table.bigInteger('list_id');
    table.bigInteger('creator_user_id');

    table.jsonb('weekdays').notNullable();
    table.text('start_time');
    table.text('due_time').notNullable();
    table.integer('due_day_offset').notNullable().defaultTo(0);
    table.text('timezone').notNullable();
    table.text('starts_on').notNullable();
    table.text('ends_on').notNullable();
    table.jsonb('excluded_dates').notNullable().defaultTo(knex.raw("'[]'::jsonb"));

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.index('board_id');
  });

  return knex.schema.alterTable('card', (table) => {
    table.bigInteger('recurrence_id');
    table.text('occurrence_date');

    table.index(['recurrence_id', 'occurrence_date']);
  });
};

module.exports.down = async (knex) => {
  await knex.schema.alterTable('card', (table) => {
    table.dropIndex(['recurrence_id', 'occurrence_date']);

    table.dropColumn('recurrence_id');
    table.dropColumn('occurrence_date');
  });

  return knex.schema.dropTable('card_recurrence');
};
