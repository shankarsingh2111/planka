/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Raw SQL on purpose: the knexfile snake-cases identifiers, which would turn "s3_" into "s_3_"

module.exports.up = (knex) =>
  knex.raw(`
    ALTER TABLE config
      ADD COLUMN s3_last_exported_at timestamp without time zone,
      ADD COLUMN s3_last_export_result jsonb
  `);

module.exports.down = (knex) =>
  knex.raw(`
    ALTER TABLE config
      DROP COLUMN s3_last_exported_at,
      DROP COLUMN s3_last_export_result
  `);
