/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// The Hippo app secret key gets a table of its own, so it is never loaded along with a project;
// the project only carries whether one is set
module.exports.up = async (knex) => {
  await knex.schema.alterTable('custom_field', (table) => {
    table.text('type').notNullable().defaultTo('text');
    table.jsonb('options');
  });

  await knex.schema.alterTable('project', (table) => {
    table.boolean('is_hippo_configured').notNullable().defaultTo(false);
  });

  return knex.schema.createTable('project_hippo_config', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('project_id').notNullable();

    table.text('app_secret_key').notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.unique('project_id');
  });
};

module.exports.down = async (knex) => {
  await knex.schema.dropTable('project_hippo_config');

  await knex.schema.alterTable('project', (table) => {
    table.dropColumn('is_hippo_configured');
  });

  return knex.schema.alterTable('custom_field', (table) => {
    table.dropColumn('type');
    table.dropColumn('options');
  });
};
