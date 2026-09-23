/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * User.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - id
 *         - role
 *         - name
 *         - username
 *         - avatar
 *         - phone
 *         - organization
 *         - isDeactivated
 *         - createdAt
 *         - updatedAt
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the user
 *           example: "1357158568008091264"
 *         email:
 *           type: string
 *           format: email
 *           description: Email address for login and notifications (private field)
 *           example: john.doe@example.com
 *         role:
 *           type: string
 *           enum: [admin, projectOwner, boardUser]
 *           description: User role defining access permissions
 *           example: admin
 *         name:
 *           type: string
 *           description: Full display name of the user
 *           example: John Doe
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 64
 *           pattern: "^[a-z0-9._-]*$"
 *           nullable: true
 *           description: Unique username for user identification
 *           example: john_doe
 *         avatar:
 *           type: object
 *           required:
 *             - url
 *             - thumbnailUrls
 *           nullable: true
 *           description: Avatar information for the user with generated URLs
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *               description: URL to the full-size avatar image
 *               example: https://storage.example.com/user-avatars/1357158568008091264/original.jpg
 *             thumbnailUrls:
 *               type: object
 *               required:
 *                 - cover180
 *               description: URLs for different thumbnail sizes
 *               properties:
 *                 cover180:
 *                   type: string
 *                   format: uri
 *                   description: URL for 180px thumbnail version
 *                   example: https://storage.example.com/user-avatars/1357158568008091264/cover-180.jpg
 *         gravatarUrl:
 *           type: string
 *           format: uri
 *           description: Gravatar URL for the user (conditionally added if configured)
 *           example: https://www.gravatar.com/avatar/abc123
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Contact phone number
 *           example: "+1234567890"
 *         organization:
 *           type: string
 *           nullable: true
 *           description: Organization or company name
 *           example: Acme Corporation
 *         language:
 *           type: string
 *           enum: [ar-YE, bg-BG, ca-ES, cs-CZ, da-DK, de-DE, el-GR, en-GB, en-US, es-ES, et-EE, fa-IR, fi-FI, fr-FR, hu-HU, id-ID, it-IT, ja-JP, ko-KR, nl-NL, pl-PL, pt-BR, pt-PT, ro-RO, ru-RU, sk-SK, sr-Cyrl-RS, sr-Latn-RS, sv-SE, tr-TR, uk-UA, uz-UZ, vi-VN, zh-CN, zh-TW]
 *           nullable: true
 *           description: Preferred language for user interface and notifications (personal field)
 *           example: en-US
 *         apiKeyPrefix:
 *           type: string
 *           nullable: true
 *           description: Prefix of the API key for display purposes (private field)
 *           example: D89VszVs
 *         subscribeToOwnCards:
 *           type: boolean
 *           default: false
 *           description: Whether the user subscribes to their own cards (personal field)
 *           example: false
 *         subscribeToCardWhenCommenting:
 *           type: boolean
 *           default: true
 *           description: Whether the user subscribes to cards when commenting (personal field)
 *           example: true
 *         turnOffRecentCardHighlighting:
 *           type: boolean
 *           default: false
 *           description: Whether recent card highlighting is disabled (personal field)
 *           example: false
 *         showExtraBoardViews:
 *           type: boolean
 *           default: false
 *           description: Whether the List and Grid board views are offered in the view switcher (personal field)
 *           example: false
 *         showQuarterTimelineZoom:
 *           type: boolean
 *           default: false
 *           description: Whether the timeline offers the quarter zoom level (personal field)
 *           example: false
 *         timelineZoomLevel:
 *           type: string
 *           enum: [day, week, month, quarter]
 *           default: week
 *           description: Last used timeline zoom level (personal field)
 *           example: week
 *         timelineGroupBy:
 *           type: string
 *           enum: [list, member, label, none]
 *           default: list
 *           description: Last used timeline lane grouping (personal field)
 *           example: list
 *         timelineColorBy:
 *           type: string
 *           enum: [status, label, list, member, project]
 *           default: status
 *           description: Last used timeline bar coloring (personal field)
 *           example: status
 *         timelineSidebarOpened:
 *           type: boolean
 *           default: true
 *           description: Whether the timeline unscheduled sidebar is expanded (personal field)
 *           example: true
 *         timelineBoardPreferences:
 *           type: object
 *           default: {}
 *           description: >
 *             Per-board timeline state keyed by board id, holding the hidden lane keys of each
 *             grouping and the collapsed lane keys (personal field)
 *           example: { "1357158568008091266": { "hiddenLaneKeys": { "list": ["1357158568008091270"] }, "collapsedLaneKeys": [] } }
 *         enableFavoritesByDefault:
 *           type: boolean
 *           default: true
 *           description: Whether favorites are enabled by default (personal field)
 *           example: true
 *         defaultEditorMode:
 *           type: string
 *           enum: [wysiwyg, markup]
 *           default: wysiwyg
 *           description: Default markdown editor mode (personal field)
 *           example: wysiwyg
 *         defaultHomeView:
 *           type: string
 *           enum: [gridProjects, groupedProjects]
 *           default: groupedProjects
 *           description: Default view mode for the home page (personal field)
 *           example: groupedProjects
 *         defaultProjectsOrder:
 *           type: string
 *           enum: [byDefault, alphabetically, byCreationTime]
 *           default: byDefault
 *           description: Default sort order for projects display (personal field)
 *           example: byDefault
 *         isSsoUser:
 *           type: boolean
 *           default: false
 *           description: Whether the user is SSO user (private field)
 *           example: false
 *         isDeactivated:
 *           type: boolean
 *           default: false
 *           description: Whether the user account is deactivated and cannot log in
 *           example: false
 *         isDefaultAdmin:
 *           type: boolean
 *           description: Whether the user is the default admin (visible only to current user or admin)
 *           example: false
 *         lockedFieldNames:
 *           type: array
 *           description: List of fields locked from editing (visible only to current user or admin)
 *           items:
 *             type: string
 *           example: [email, password, name]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the user was created
 *           example: 2024-01-01T00:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the user was last updated
 *           example: 2024-01-01T00:00:00.000Z
 */

const Roles = {
  ADMIN: 'admin',
  PROJECT_OWNER: 'projectOwner',
  BOARD_USER: 'boardUser',
};

// TODO: should not be here
const EditorModes = {
  WYSIWYG: 'wysiwyg',
  MARKUP: 'markup',
};

const HomeViews = {
  GRID_PROJECTS: 'gridProjects',
  GROUPED_PROJECTS: 'groupedProjects',
};

const ProjectOrders = {
  BY_DEFAULT: 'byDefault',
  ALPHABETICALLY: 'alphabetically',
  BY_CREATION_TIME: 'byCreationTime',
};

// Kept in step with the client's ZoomLevels, GroupByOptions and ColorByOptions, so an
// unknown value can never reach the timeline and leave it with nothing to render
const TimelineZoomLevels = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
};

const TimelineGroupings = {
  LIST: 'list',
  MEMBER: 'member',
  LABEL: 'label',
  NONE: 'none',
};

const TimelineColorings = {
  STATUS: 'status',
  LABEL: 'label',
  LIST: 'list',
  MEMBER: 'member',
  PROJECT: 'project',
};

const LANGUAGES = [
  'ar-YE',
  'bg-BG',
  'ca-ES',
  'cs-CZ',
  'da-DK',
  'de-DE',
  'el-GR',
  'en-GB',
  'en-US',
  'es-ES',
  'et-EE',
  'fa-IR',
  'fi-FI',
  'fr-FR',
  'hu-HU',
  'id-ID',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'nl-NL',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'ro-RO',
  'ru-RU',
  'sk-SK',
  'sr-Cyrl-RS',
  'sr-Latn-RS',
  'sv-SE',
  'tr-TR',
  'uk-UA',
  'uz-UZ',
  'vi-VN',
  'zh-CN',
  'zh-TW',
];

// TODO: find better way to handle apiKeyHash and apiKeyCreatedAt
const PRIVATE_FIELD_NAMES = ['email', 'apiKeyPrefix', 'apiKeyHash', 'isSsoUser', 'apiKeyCreatedAt'];

const PERSONAL_FIELD_NAMES = [
  'language',
  'subscribeToOwnCards',
  'subscribeToCardWhenCommenting',
  'turnOffRecentCardHighlighting',
  'showExtraBoardViews',
  'showQuarterTimelineZoom',
  'timelineZoomLevel',
  'timelineGroupBy',
  'timelineColorBy',
  'timelineSidebarOpened',
  'timelineBoardPreferences',
  'enableFavoritesByDefault',
  'defaultEditorMode',
  'defaultHomeView',
  'defaultProjectsOrder',
];

const INTERNAL = {
  id: '_internal',
  role: Roles.ADMIN,
};

const OIDC = {
  id: '_oidc',
  role: Roles.ADMIN,
};

module.exports = {
  Roles,
  EditorModes,
  HomeViews,
  ProjectOrders,
  TimelineZoomLevels,
  TimelineGroupings,
  TimelineColorings,
  LANGUAGES,
  PRIVATE_FIELD_NAMES,
  PERSONAL_FIELD_NAMES,
  INTERNAL,
  OIDC,

  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    email: {
      type: 'string',
      isEmail: true,
      required: true,
    },
    password: {
      type: 'string',
      isNotEmptyString: true,
      allowNull: true,
    },
    role: {
      type: 'string',
      isIn: Object.values(Roles),
      required: true,
    },
    name: {
      type: 'string',
      required: true,
    },
    username: {
      type: 'string',
      isNotEmptyString: true,
      minLength: 3,
      maxLength: 64,
      regex: /^[a-z0-9._-]*$/,
      allowNull: true,
    },
    avatar: {
      type: 'json',
    },
    phone: {
      type: 'string',
      isNotEmptyString: true,
      allowNull: true,
    },
    organization: {
      type: 'string',
      isNotEmptyString: true,
      allowNull: true,
    },
    language: {
      type: 'string',
      isIn: LANGUAGES,
      allowNull: true,
    },
    apiKeyPrefix: {
      type: 'string',
      isNotEmptyString: true,
      allowNull: true,
      columnName: 'api_key_prefix',
    },
    apiKeyHash: {
      type: 'string',
      isNotEmptyString: true,
      allowNull: true,
      columnName: 'api_key_hash',
    },
    subscribeToOwnCards: {
      type: 'boolean',
      defaultsTo: false,
      columnName: 'subscribe_to_own_cards',
    },
    subscribeToCardWhenCommenting: {
      type: 'boolean',
      defaultsTo: true,
      columnName: 'subscribe_to_card_when_commenting',
    },
    turnOffRecentCardHighlighting: {
      type: 'boolean',
      defaultsTo: false,
      columnName: 'turn_off_recent_card_highlighting',
    },
    showExtraBoardViews: {
      type: 'boolean',
      defaultsTo: false,
      columnName: 'show_extra_board_views',
    },
    showQuarterTimelineZoom: {
      type: 'boolean',
      defaultsTo: false,
      columnName: 'show_quarter_timeline_zoom',
    },
    timelineZoomLevel: {
      type: 'string',
      isIn: Object.values(TimelineZoomLevels),
      defaultsTo: TimelineZoomLevels.DAY,
      columnName: 'timeline_zoom_level',
    },
    timelineGroupBy: {
      type: 'string',
      isIn: Object.values(TimelineGroupings),
      defaultsTo: TimelineGroupings.LIST,
      columnName: 'timeline_group_by',
    },
    timelineColorBy: {
      type: 'string',
      isIn: Object.values(TimelineColorings),
      defaultsTo: TimelineColorings.STATUS,
      columnName: 'timeline_color_by',
    },
    timelineSidebarOpened: {
      type: 'boolean',
      defaultsTo: true,
      columnName: 'timeline_sidebar_opened',
    },
    timelineBoardPreferences: {
      type: 'json',
      defaultsTo: {},
      columnName: 'timeline_board_preferences',
    },
    enableFavoritesByDefault: {
      type: 'boolean',
      defaultsTo: true,
      columnName: 'enable_favorites_by_default',
    },
    defaultEditorMode: {
      type: 'string',
      isIn: Object.values(EditorModes),
      defaultsTo: EditorModes.WYSIWYG,
      columnName: 'default_editor_mode',
    },
    defaultHomeView: {
      type: 'string',
      isIn: Object.values(HomeViews),
      defaultsTo: HomeViews.GROUPED_PROJECTS,
      columnName: 'default_home_view',
    },
    defaultProjectsOrder: {
      type: 'string',
      isIn: Object.values(ProjectOrders),
      defaultsTo: ProjectOrders.BY_DEFAULT,
      columnName: 'default_projects_order',
    },
    termsSignature: {
      type: 'string',
      isNotEmptyString: true,
      allowNull: true,
      columnName: 'terms_signature',
    },
    isSsoUser: {
      type: 'boolean',
      defaultsTo: false,
      columnName: 'is_sso_user',
    },
    isDeactivated: {
      type: 'boolean',
      defaultsTo: false,
      columnName: 'is_deactivated',
    },
    passwordChangedAt: {
      type: 'ref',
      columnName: 'password_changed_at',
    },
    apiKeyCreatedAt: {
      type: 'ref',
      columnName: 'api_key_created_at',
    },
    termsAcceptedAt: {
      type: 'ref',
      columnName: 'terms_accepted_at',
    },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

    managerProjects: {
      collection: 'Project',
      via: 'userId',
      through: 'ProjectManager',
    },
    membershipBoards: {
      collection: 'Board',
      via: 'userId',
      through: 'BoardMembership',
    },
    subscriptionCards: {
      collection: 'Card',
      via: 'userId',
      through: 'CardSubscription',
    },
    membershipCards: {
      collection: 'Card',
      via: 'userId',
      through: 'CardMembership',
    },
  },

  tableName: 'user_account',
};
