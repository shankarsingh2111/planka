/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// An attachment added from a comment points at it, so the comment can show it and take it along
// when deleted. Card attachments keep it empty.
module.exports.up = (knex) =>
  knex.schema.alterTable('attachment', (table) => {
    table.bigInteger('comment_id');

    table.index('comment_id');
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('attachment', (table) => {
    table.dropIndex('comment_id');
    table.dropColumn('comment_id');
  });
