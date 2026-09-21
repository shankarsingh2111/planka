/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * CardDependency.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CardDependency:
 *       type: object
 *       required:
 *         - id
 *         - boardId
 *         - predecessorCardId
 *         - successorCardId
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the dependency
 *           example: "1357158568008091264"
 *         boardId:
 *           type: string
 *           description: ID of the board both cards belong to
 *           example: "1357158568008091265"
 *         predecessorCardId:
 *           type: string
 *           description: ID of the card that must finish first (the blocker)
 *           example: "1357158568008091266"
 *         successorCardId:
 *           type: string
 *           description: ID of the card that depends on the predecessor (the blocked card)
 *           example: "1357158568008091267"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the dependency was created
 *           example: 2024-01-01T00:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the dependency was last updated
 *           example: 2024-01-01T00:00:00.000Z
 */

module.exports = {
  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

    boardId: {
      model: 'Board',
      required: true,
      columnName: 'board_id',
    },
    predecessorCardId: {
      model: 'Card',
      required: true,
      columnName: 'predecessor_card_id',
    },
    successorCardId: {
      model: 'Card',
      required: true,
      columnName: 'successor_card_id',
    },
  },

  tableName: 'card_dependency',
};
