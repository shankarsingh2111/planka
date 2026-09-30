/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * CardRecurrence.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CardRecurrence:
 *       type: object
 *       required:
 *         - id
 *         - boardId
 *         - listId
 *         - creatorUserId
 *         - weekdays
 *         - startTime
 *         - dueTime
 *         - dueDayOffset
 *         - timezone
 *         - startsOn
 *         - endsOn
 *         - excludedDates
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the series
 *           example: "1357158568008091264"
 *         boardId:
 *           type: string
 *           description: ID of the board the series' cards belong to
 *           example: "1357158568008091265"
 *         listId:
 *           type: string
 *           nullable: true
 *           description: ID of the list new cards of the series are created in
 *           example: "1357158568008091267"
 *         creatorUserId:
 *           type: string
 *           nullable: true
 *           description: ID of the user who made the card recurring
 *           example: "1357158568008091266"
 *         weekdays:
 *           type: array
 *           items:
 *             type: integer
 *             minimum: 0
 *             maximum: 6
 *           description: Days of the week the series lands on, 0 being Sunday
 *           example: [1, 2]
 *         startTime:
 *           type: string
 *           nullable: true
 *           description: Wall-clock start time of each card (HH:mm), none when cards have no start date
 *           example: "16:00"
 *         dueTime:
 *           type: string
 *           description: Wall-clock due time of each card (HH:mm)
 *           example: "18:00"
 *         dueDayOffset:
 *           type: integer
 *           description: How many days after its date each card is due
 *           example: 0
 *         timezone:
 *           type: string
 *           description: IANA time zone the dates and times are in
 *           example: Asia/Kolkata
 *         startsOn:
 *           type: string
 *           format: date
 *           description: Date of the first card
 *           example: 2026-09-28
 *         endsOn:
 *           type: string
 *           format: date
 *           description: Last date the series may land on
 *           example: 2026-11-30
 *         excludedDates:
 *           type: array
 *           items:
 *             type: string
 *             format: date
 *           description: Dates whose card was deleted, never to be created again
 *           example: [2026-10-05]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the series was created
 *           example: 2024-01-01T00:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the series was last updated
 *           example: 2024-01-01T00:00:00.000Z
 */

// Which cards of a series an edit reaches, besides the edited one
const Scopes = {
  FOLLOWING: 'following',
  ALL: 'all',
};

module.exports = {
  Scopes,

  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    weekdays: {
      type: 'json',
      required: true,
    },
    startTime: {
      type: 'string',
      allowNull: true,
      columnName: 'start_time',
    },
    dueTime: {
      type: 'string',
      required: true,
      columnName: 'due_time',
    },
    dueDayOffset: {
      type: 'number',
      defaultsTo: 0,
      columnName: 'due_day_offset',
    },
    timezone: {
      type: 'string',
      required: true,
    },
    startsOn: {
      type: 'string',
      required: true,
      columnName: 'starts_on',
    },
    endsOn: {
      type: 'string',
      required: true,
      columnName: 'ends_on',
    },
    excludedDates: {
      type: 'json',
      defaultsTo: [],
      columnName: 'excluded_dates',
    },

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
    // Not kept in sync when the list goes away: new cards then fall back to another open list
    listId: {
      model: 'List',
      columnName: 'list_id',
    },
    creatorUserId: {
      model: 'User',
      columnName: 'creator_user_id',
    },
  },

  tableName: 'card_recurrence',
};
