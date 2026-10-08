# Hippo Ticket Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Board editors can create a Planka card prefilled from a Hippo ticket (number or URL), and push Planka comments (as Hippo notes) and Ticket State changes back to Hippo after confirming.

**Architecture:**
- **Server:** every Hippo call goes through the Sails server. Each project's Hippo key lives in its own table. The server adds three endpoint groups:
  - a ticket lookup,
  - two sync endpoints,
  - three key-management endpoints.
- **Client:** the lookup prefills the existing Add Card dialog. The existing create saga then links the new card to the ticket through the ordinary custom-field and comment endpoints.
- **Dropdown field type:** a new, general custom-field type that also backs the Ticket State field.

**Tech Stack:**
- Server: Sails 1 (Waterline, knex migrations, mocha/chai tests).
- Client: React 18, redux-orm, redux-saga, Semantic UI React, jest.
- New dependency: `turndown`, on the server only.

**Spec:** `docs/superpowers/specs/2026-10-08-hippo-ticket-integration-design.md`. Read it first. This plan argues from it.

## Global Constraints

**Hippo API**
- Base URL `https://api.hippochat.io`.
- Ticket actions: `POST /api/ticketing/activities`.
- Key check: `GET /api/business/verifyAccount?app_secret_key=…`.
- Every request has a 10 s timeout and uses undici's `ProxyAgent` when `sails.config.custom.outgoingProxy` is set.

**Names shared by server and client** (the constants on both sides must stay identical)
- Field group: `Hippo Ticket`.
- Fields: `Ticket #`, `Ticket State`, `Priority`, `Ticket URL`.
- Default Ticket State options: `New`, `Pending from Dev`, `Pending from CSM`, `Closed`.

**Validation**
- Ticket numbers match `^\d{1,12}$`.
- Dropdown options: at most 100, each trimmed, non-empty, unique and at most 128 characters.

**Errors and security**
- Hippo failures never produce HTTP 401. The client logs the user out on 401 (`client/src/sagas/core/request.js`). Use 404/422.
- The key is never logged and never returned by any endpoint. It lives only in the `project_hippo_config` table.
- Only `http:`/`https:` URLs may render as links.

**Code conventions**
- Sails helpers must not touch model globals (`Model.X`) at module level, only inside `fn`. Requiring a model *file* directly (as `send-webhooks.js` does) is fine.
- Every new source file starts with the PLANKA copyright header used across the repo:
  ```
  /*!
   * Copyright (c) 2024 PLANKA Software GmbH
   * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
   */
  ```
- Prettier: `printWidth` 100, `singleQuote`, `trailingComma: all`.
- Loops that `yield` inside sagas use index `for` loops. `for…of` is banned by airbnb and no saga uses it.
- Before each task's lint check, run `npx eslint --fix` on the files you touched, so Prettier
  re-wraps long lines and re-indents wrapped JSX. Formatting changes Prettier makes are not
  deviations from this plan's code.
- New UI strings go only into `client/src/locales/en-US/core.js`, each placed alphabetically within `common` or `action`. Other languages fall back to English.

**Checks: light only**
- Allowed: eslint, single-file unit tests (`npx mocha test/utils/<file>` in `server/`, `npx jest <file>` in `client/`) and `npm run build` in `client/`.
- Not allowed: running servers, databases, migrations, browsers or e2e tests.
- Shankar runs the migration and the manual checks himself.

**Before editing an existing symbol**
- Run `gitnexus_impact({target, direction: "upstream", repo: "planka"})` and report the blast radius. Stop and warn on HIGH/CRITICAL.
- GitNexus does not index redux-saga generator functions. For those, the grep result recorded in the task stands in.
- Before each commit, run `gitnexus_detect_changes({scope: "staged", repo: "planka"})` and confirm
  only that task's files and symbols changed.

## Review Focus

These inputs are implied by the spec but easy to miss. Each one is pinned by a test in the task named.

1. **Hippo answers HTTP 200 with `statusCode: 400` in the body** (e.g. "Ticket not found"). Expected: reported as not found or refused, never treated as success. Task 3 (`classifyHippoResponse` "trusts the statusCode in the body").
2. **A Planka comment containing mention markup (`@[name](id)`), newlines, `<`, `&`.** Expected: the Hippo note shows `@name`, keeps the line breaks, and its HTML is escaped. Task 3 ("turns a Planka comment with mentions and markup into a safe note").
3. **A Ticket URL edited by hand to `javascript:alert(1)` or `www.example.com`.** Expected: shown as a plain `#N` chip, never a link. Task 7 (`toSafeHttpUrl`).
4. **Ticket links with a hash route, a query string, or digits in the host or port** (`https://app2.hippochat.io:8443/#/ticket/43886?tab=notes`). Expected: number `43886`, and a reusable URL pattern without the query. Task 7 (`parseTicketNumber`, `toTicketUrlPattern`).
5. **Fetching a second ticket in the same dialog.** Expected: the first ticket's members are removed, members picked by hand are kept, and the title, description and due date are replaced. Task 7 (`applyTicketToCardData` "lets go of the members a previous ticket brought").

## File Map

| Area | Create | Modify |
|---|---|---|
| Schema & models | `server/db/migrations/20261008000000_add_hippo_integration.js`, `server/api/models/ProjectHippoConfig.js`, `server/api/hooks/query-methods/models/ProjectHippoConfig.js` | `server/api/models/CustomField.js`, `server/api/models/Project.js`, `server/api/hooks/query-methods/models/CustomFieldGroup.js`, `server/api/helpers/projects/delete-related.js` |
| Dropdown (server) | `server/utils/custom-fields.js`, `server/test/utils/custom-fields.test.js` | `server/api/controllers/custom-fields/{create-in-custom-field-group,create-in-base-custom-field-group,update}.js`, `server/api/controllers/custom-field-values/create-or-update.js`, `server/api/helpers/cards/{copy,detach}-custom-fields.js` |
| Hippo core (server) | `server/utils/hippo.js`, `server/utils/hippo-errors.js`, `server/test/utils/hippo.test.js`, `server/api/helpers/hippo/*.js` (7) | `server/package.json` (turndown) |
| Hippo endpoints | `server/api/controllers/hippo/*.js` (6) | `server/config/routes.js`, `server/api/controllers/dashboard/show.js` |
| Dropdown (client) | `client/src/utils/custom-fields.js` (+test), `client/src/components/custom-fields/CustomFieldEditor/*` | `client/src/constants/Enums.js`, `client/src/models/CustomField.js`, 4 × `CustomField{Add,Edit}Step.jsx`; delete 2 duplicate editors |
| Hippo client core | `client/src/utils/hippo.js` (+test), `client/src/api/hippo.js`, `client/src/selectors/hippo.js` | `client/src/api/index.js`, `client/src/selectors/index.js`, `client/src/models/Project.js` |
| Card modal fields | `client/src/components/hippo/TicketChip/*`, `client/src/components/custom-fields/CustomField/DropdownValueField.jsx` (+scss) | `client/src/components/custom-fields/CustomField/{CustomField,ValueField}.jsx`, `CustomField.module.scss` |
| Settings | `client/src/components/projects/ProjectSettingsModal/IntegrationsPane.jsx` (+scss) | `ProjectSettingsModal.jsx` |
| Sagas & toasts | `client/src/sagas/core/services/{hippo,hippo-sync}.js`, `client/src/sagas/core/watchers/hippo.js`, `client/src/entry-actions/hippo.js`, 2 toasts | services `{comments,custom-field-values,custom-fields,custom-field-groups,cards,index}.js`, watchers `{comments,custom-field-values,cards,index}.js`, entry-actions `{comments,custom-field-values,cards,index}.js`, `EntryActionTypes.js`, `ToastTypes.js`, `Toaster.jsx` |
| Add Card dialog | `AddCardModal/{HippoImportField,HippoTicketDetails}.jsx` (+scss), `AddCardModal/use-hippo-ticket-lookup.js`, `AddCardModal/ticket-url-pattern-storage.js` | `AddCardModal/{AddCardModal,Content}.jsx`, `client/src/components/lists/List/List.jsx` |
| Sync dialogs | `client/src/components/hippo/HippoSyncModal/*` | `client/src/components/comments/Comments/Add.jsx`, `CustomField.jsx` |
| Ticket chip | — | `client/src/selectors/cards.js`, `cards/Card/{Project,Story,Inline}Content.jsx` (+scss), `TimelineView.jsx`, `TeamTimeline.jsx`, `TimelineChart/{TimelineChart,Bar}.jsx`, `TimelineChart.module.scss` |

All paths below are relative to the repo root `/Users/shankar/Documents/node/planka`.

---

### Task 1: Schema and server models

**Files:**
- Create: `server/db/migrations/20261008000000_add_hippo_integration.js`
- Create: `server/api/models/ProjectHippoConfig.js`
- Create: `server/api/hooks/query-methods/models/ProjectHippoConfig.js`
- Modify: `server/api/models/CustomField.js`
- Modify: `server/api/models/Project.js`
- Modify: `server/api/hooks/query-methods/models/CustomFieldGroup.js`
- Modify: `server/api/helpers/projects/delete-related.js`

**Interfaces:**
- Produces:
  - `CustomField.Types = { TEXT: 'text', DROPDOWN: 'dropdown' }`
  - attributes `CustomField.type`, `CustomField.options` (`string[] | null`)
  - `Project.isHippoConfigured` (boolean)
  - `ProjectHippoConfig.qm.getOneByProjectId(projectId)` → record or undefined
  - `ProjectHippoConfig.qm.createOrUpdateOne(projectId, { appSecretKey })` → record
  - `ProjectHippoConfig.qm.delete(criteria)`
  - `CustomFieldGroup.qm.getByBoardIds(boardIds)`

- [ ] **Step 0: Impact check.** Run `gitnexus_impact` (upstream) on `delete-related.js` and `CustomFieldGroup.js` (the query-methods file). Both changes only add code, so LOW is expected.

- [ ] **Step 1: Write the migration**

Create `server/db/migrations/20261008000000_add_hippo_integration.js`:

```js
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
```

- [ ] **Step 2: Add `type` and `options` to the CustomField model**

In `server/api/models/CustomField.js`, add these two properties to the swagger schema, directly after the `showOnFrontOfCard` property block:

```
 *         type:
 *           type: string
 *           enum: [text, dropdown]
 *           default: text
 *           description: Kind of value the field holds
 *           example: dropdown
 *         options:
 *           type: array
 *           nullable: true
 *           items:
 *             type: string
 *           description: Values a dropdown field offers (null for text fields)
 *           example: [New, Pending from Dev, Closed]
```

Replace `module.exports = {\n  attributes: {` with:

```js
const Types = {
  TEXT: 'text',
  DROPDOWN: 'dropdown',
};

module.exports = {
  Types,

  attributes: {
```

Then, after the `showOnFrontOfCard` attribute (the one with `columnName: 'show_on_front_of_card'`), add:

```js
    type: {
      type: 'string',
      isIn: Object.values(Types),
      defaultsTo: Types.TEXT,
    },
    options: {
      type: 'json',
    },
```

- [ ] **Step 3: Add `isHippoConfigured` to the Project model**

In `server/api/models/Project.js`, add this to the swagger schema directly after the `isHidden` property block:

```
 *         isHippoConfigured:
 *           type: boolean
 *           default: false
 *           description: Whether a Hippo app secret key is set for the project
 *           example: false
```

Then add this after the `isHidden` attribute (the one with `columnName: 'is_hidden'`):

```js
    isHippoConfigured: {
      type: 'boolean',
      defaultsTo: false,
      columnName: 'is_hippo_configured',
    },
```

- [ ] **Step 4: Create the ProjectHippoConfig model**

Create `server/api/models/ProjectHippoConfig.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * ProjectHippoConfig.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

// A project's Hippo app secret key, kept apart from the project so the key is never loaded (and so
// never sent) along with project records. No endpoint presents this model.
module.exports = {
  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝

    appSecretKey: {
      type: 'string',
      required: true,
      columnName: 'app_secret_key',
    },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝

    projectId: {
      model: 'Project',
      required: true,
      columnName: 'project_id',
    },
  },

  tableName: 'project_hippo_config',
};
```

- [ ] **Step 5: Create its query methods**

Create `server/api/hooks/query-methods/models/ProjectHippoConfig.js`. The hook attaches it by file name:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/* Query methods */

const getOneByProjectId = (projectId) =>
  ProjectHippoConfig.findOne({
    projectId,
  });

// One key per project: saving again replaces it
const createOrUpdateOne = async (projectId, values) => {
  const projectHippoConfig = await getOneByProjectId(projectId);

  if (projectHippoConfig) {
    return ProjectHippoConfig.updateOne(projectHippoConfig.id).set({ ...values });
  }

  return ProjectHippoConfig.create({
    ...values,
    projectId,
  }).fetch();
};

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => ProjectHippoConfig.destroy(criteria).fetch();

module.exports = {
  getOneByProjectId,
  createOrUpdateOne,
  delete: delete_,
};
```

- [ ] **Step 6: Add `getByBoardIds` to the CustomFieldGroup query methods**

In `server/api/hooks/query-methods/models/CustomFieldGroup.js`, add this after the `getByBoardId` function:

```js
const getByBoardIds = (boardIds, { sort = ['position', 'id'] } = {}) =>
  defaultFind(
    {
      boardId: boardIds,
    },
    { sort },
  );
```

Then add `getByBoardIds,` after `getByBoardId,` in `module.exports`.

- [ ] **Step 7: Delete the key along with its project**

In `server/api/helpers/projects/delete-related.js`, add this directly after the `ProjectFavorite.qm.delete(...)` call:

```js
    await ProjectHippoConfig.qm.delete({
      projectId: projectIdOrIds,
    });
```

- [ ] **Step 8: Light checks**

Run:

```bash
cd server && npx eslint db/migrations/20261008000000_add_hippo_integration.js api/models/CustomField.js api/models/Project.js api/models/ProjectHippoConfig.js api/hooks/query-methods/models/ProjectHippoConfig.js api/hooks/query-methods/models/CustomFieldGroup.js api/helpers/projects/delete-related.js && node -e "require('./db/migrations/20261008000000_add_hippo_integration.js'); console.log(require('./api/models/CustomField.js').Types)"
```

Expected: no eslint output, then `{ TEXT: 'text', DROPDOWN: 'dropdown' }`. Do **not** run the migration.

- [ ] **Step 9: Commit**

```bash
git add server/db/migrations/20261008000000_add_hippo_integration.js server/api/models server/api/hooks/query-methods/models server/api/helpers/projects/delete-related.js
git commit -m "hippo: schema for dropdown fields and per-project Hippo key" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dropdown custom fields on the server

**Files:**
- Create: `server/utils/custom-fields.js`
- Test: `server/test/utils/custom-fields.test.js`
- Modify: `server/api/controllers/custom-fields/create-in-custom-field-group.js`
- Modify: `server/api/controllers/custom-fields/create-in-base-custom-field-group.js`
- Modify: `server/api/controllers/custom-fields/update.js`
- Modify: `server/api/controllers/custom-field-values/create-or-update.js`
- Modify: `server/api/helpers/cards/copy-custom-fields.js`
- Modify: `server/api/helpers/cards/detach-custom-fields.js`

**Interfaces:**
- Consumes: `CustomField.Types` (Task 1).
- Produces:
  - `cleanOptions(options)` → `string[] | null`
  - `normalizeTypeValues(values, record?)` → `{ type, options } | null`
  - `isValueAllowed(customField, content)` → boolean
- API behaviour:
  - Create and update accept `type` and `options`.
  - An invalid dropdown returns 422 `Options must be present`.
  - A value outside a dropdown's options returns 422 `Value not in options`.

- [ ] **Step 0: Impact check.** Run `gitnexus_impact` (upstream) on `copy-custom-fields.js` and `detach-custom-fields.js`. The change only adds two attributes to a `_.pick` list.

- [ ] **Step 1: Write the failing test**

Create `server/test/utils/custom-fields.test.js`:

```js
const { expect } = require('chai');

const { cleanOptions, normalizeTypeValues, isValueAllowed } = require('../../utils/custom-fields');

describe('custom-fields', () => {
  describe('cleanOptions', () => {
    it('trims options and drops blanks and repeats', () => {
      expect(cleanOptions([' New ', 'Closed', '', 'New', '  '])).to.deep.equal(['New', 'Closed']);
    });

    it('rejects lists that are empty, not lists, or hold non-strings', () => {
      expect(cleanOptions([])).to.equal(null);
      expect(cleanOptions(['', ' '])).to.equal(null);
      expect(cleanOptions('New')).to.equal(null);
      expect(cleanOptions(['New', 3])).to.equal(null);
      expect(cleanOptions(null)).to.equal(null);
    });

    it('rejects too many or too long options', () => {
      const tooMany = Array.from({ length: 101 }, (_, index) => `Option ${index}`);

      expect(cleanOptions(tooMany)).to.equal(null);
      expect(cleanOptions(['x'.repeat(129)])).to.equal(null);
    });
  });

  describe('normalizeTypeValues', () => {
    it('defaults a new field to text without options', () => {
      expect(normalizeTypeValues({ name: 'Notes' })).to.deep.equal({ type: 'text', options: null });
    });

    it('drops the options of a text field', () => {
      expect(normalizeTypeValues({ type: 'text', options: ['A'] })).to.deep.equal({
        type: 'text',
        options: null,
      });
    });

    it('keeps the cleaned options of a dropdown', () => {
      expect(normalizeTypeValues({ type: 'dropdown', options: ['A', ' B '] })).to.deep.equal({
        type: 'dropdown',
        options: ['A', 'B'],
      });
    });

    it('refuses a dropdown without options', () => {
      expect(normalizeTypeValues({ type: 'dropdown' })).to.equal(null);
      expect(normalizeTypeValues({ type: 'dropdown', options: [] })).to.equal(null);
    });

    it('falls back to the existing field for whatever an update leaves out', () => {
      const record = { type: 'dropdown', options: ['A', 'B'] };

      expect(normalizeTypeValues({ options: ['C'] }, record)).to.deep.equal({
        type: 'dropdown',
        options: ['C'],
      });

      expect(normalizeTypeValues({ type: 'dropdown' }, record)).to.deep.equal({
        type: 'dropdown',
        options: ['A', 'B'],
      });

      expect(normalizeTypeValues({ type: 'text' }, record)).to.deep.equal({
        type: 'text',
        options: null,
      });
    });
  });

  describe('isValueAllowed', () => {
    it('lets text fields hold anything', () => {
      expect(isValueAllowed({ type: 'text', options: null }, 'Anything')).to.equal(true);
    });

    it('limits dropdown fields to their options', () => {
      const customField = { type: 'dropdown', options: ['New', 'Closed'] };

      expect(isValueAllowed(customField, 'Closed')).to.equal(true);
      expect(isValueAllowed(customField, 'Reopened')).to.equal(false);
    });
  });
});
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `cd server && npx mocha test/utils/custom-fields.test.js`
Expected: FAIL with `Cannot find module '../../utils/custom-fields'`.

- [ ] **Step 3: Implement the util**

Create `server/utils/custom-fields.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { Types } = require('../api/models/CustomField');

const MAX_OPTIONS = 100;
const MAX_OPTION_LENGTH = 128;

// Trimmed, without blanks or repeats; null when the list is not a usable set of options
const cleanOptions = (options) => {
  if (!Array.isArray(options) || options.some((option) => typeof option !== 'string')) {
    return null;
  }

  const result = [];

  options.forEach((option) => {
    const trimmedOption = option.trim();

    if (trimmedOption && !result.includes(trimmedOption)) {
      result.push(trimmedOption);
    }
  });

  if (
    result.length === 0 ||
    result.length > MAX_OPTIONS ||
    result.some((option) => option.length > MAX_OPTION_LENGTH)
  ) {
    return null;
  }

  return result;
};

// The type and options a field ends up with once the given values apply to it. A dropdown needs
// options to pick from, so null means the values are invalid.
const normalizeTypeValues = (values, record = {}) => {
  const type = values.type || record.type || Types.TEXT;

  if (type !== Types.DROPDOWN) {
    return {
      type,
      options: null,
    };
  }

  const options = cleanOptions(values.options === undefined ? record.options : values.options);

  if (!options) {
    return null;
  }

  return {
    type,
    options,
  };
};

const isValueAllowed = (customField, content) =>
  customField.type !== Types.DROPDOWN || (customField.options || []).includes(content);

module.exports = {
  cleanOptions,
  normalizeTypeValues,
  isValueAllowed,
};
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `cd server && npx mocha test/utils/custom-fields.test.js`
Expected: PASS, 10 passing.

- [ ] **Step 5: Accept `type` and `options` in both create controllers**

Make the following changes in `server/api/controllers/custom-fields/create-in-custom-field-group.js` **and** in `server/api/controllers/custom-fields/create-in-base-custom-field-group.js`:

1. In the swagger `requestBody` properties, directly after the `showOnFrontOfCard` property block, add:

```
 *               type:
 *                 type: string
 *                 enum: [text, dropdown]
 *                 description: Kind of value the field holds (text when omitted)
 *                 example: dropdown
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Values a dropdown field offers; required for dropdown fields
 *                 example: [New, Pending from Dev, Closed]
```

   Also add a `422` response after the `404` one:

```
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
```

2. After `const { idInput } = require('../../../utils/inputs');` add:

```js
const { normalizeTypeValues } = require('../../../utils/custom-fields');
```

3. Add this as the last entry of `Errors`:

```js
  OPTIONS_MUST_BE_PRESENT: {
    optionsMustBePresent: 'Options must be present',
  },
```

4. After the `showOnFrontOfCard` input, add:

```js
    type: {
      type: 'string',
      isIn: Object.values(CustomField.Types),
    },
    options: {
      type: 'json',
    },
```

5. Add this as the last entry of `exits`:

```js
    optionsMustBePresent: {
      responseType: 'unprocessableEntity',
    },
```

6. Replace `const values = _.pick(inputs, ['position', 'name', 'showOnFrontOfCard']);` with:

```js
    const typeValues = normalizeTypeValues(inputs);

    if (!typeValues) {
      throw Errors.OPTIONS_MUST_BE_PRESENT;
    }

    const values = {
      ..._.pick(inputs, ['position', 'name', 'showOnFrontOfCard']),
      ...typeValues,
    };
```

- [ ] **Step 6: Accept `type` and `options` in the update controller**

Make the following changes in `server/api/controllers/custom-fields/update.js`:
- Add the same swagger properties and `422` response as in Step 5.1.
- Add the same `require` (Step 5.2), `Errors` entry (5.3), inputs (5.4) and exit (5.5).
- Replace `const values = _.pick(inputs, ['position', 'name', 'showOnFrontOfCard']);` with:

```js
    const values = _.pick(inputs, ['position', 'name', 'showOnFrontOfCard']);

    // Whatever the update leaves out of the type/options pair comes from the field as it is
    if (!_.isUndefined(inputs.type) || !_.isUndefined(inputs.options)) {
      const typeValues = normalizeTypeValues(inputs, customField);

      if (!typeValues) {
        throw Errors.OPTIONS_MUST_BE_PRESENT;
      }

      Object.assign(values, typeValues);
    }
```

That line comes after `let { customField } = pathToProject;`, so `customField` is already in scope.

- [ ] **Step 7: Reject values outside a dropdown's options**

Make the following changes in `server/api/controllers/custom-field-values/create-or-update.js`:

1. After the `idInput` require, add:

```js
const { isValueAllowed } = require('../../../utils/custom-fields');
```

2. Add this as the last entry of `Errors`:

```js
  VALUE_NOT_IN_OPTIONS: {
    valueNotInOptions: 'Value not in options',
  },
```

3. Add this as the last entry of `exits`:

```js
    valueNotInOptions: {
      responseType: 'unprocessableEntity',
    },
```

4. Directly before `const values = _.pick(inputs, ['content']);` add:

```js
    if (!isValueAllowed(customField, inputs.content)) {
      throw Errors.VALUE_NOT_IN_OPTIONS;
    }
```

5. In the swagger block, add the `422` response after `404`, as in Step 5.1.

- [ ] **Step 8: Carry `type` and `options` when cards are copied or moved**

These helpers copy fields when a card is duplicated or moved to another board. Without this change, dropdowns would turn back into text fields.

- In `server/api/helpers/cards/detach-custom-fields.js`, replace all 3 occurrences of `_.pick(customField, ['name', 'showOnFrontOfCard', 'position'])` with `_.pick(customField, ['name', 'showOnFrontOfCard', 'position', 'type', 'options'])`.
- In `server/api/helpers/cards/copy-custom-fields.js`, replace `_.pick(customField, ['position', 'name', 'showOnFrontOfCard'])` with `_.pick(customField, ['position', 'name', 'showOnFrontOfCard', 'type', 'options'])`.

- [ ] **Step 9: Light checks**

Run:

```bash
cd server && npx mocha test/utils/custom-fields.test.js && npx eslint utils/custom-fields.js test/utils/custom-fields.test.js api/controllers/custom-fields api/controllers/custom-field-values/create-or-update.js api/helpers/cards/copy-custom-fields.js api/helpers/cards/detach-custom-fields.js && grep -c "'type', 'options'" api/helpers/cards/detach-custom-fields.js api/helpers/cards/copy-custom-fields.js
```

Expected:
- mocha: 10 passing.
- eslint: no output.
- grep: `detach-custom-fields.js:3` and `copy-custom-fields.js:1`.

- [ ] **Step 10: Commit**

```bash
git add server/utils/custom-fields.js server/test/utils/custom-fields.test.js server/api/controllers/custom-fields server/api/controllers/custom-field-values/create-or-update.js server/api/helpers/cards
git commit -m "hippo: dropdown custom field type on the server" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hippo pure logic on the server

**Files:**
- Modify: `server/package.json` and `server/package-lock.json` (via npm)
- Create: `server/utils/hippo.js`
- Create: `server/utils/hippo-errors.js`
- Test: `server/test/utils/hippo.test.js`

**Interfaces:**
- Produces, from `server/utils/hippo.js`:
  - constants `HIPPO_API_URL`, `TICKETING_PATH`, `VERIFY_ACCOUNT_PATH`, `REQUEST_TIMEOUT_MS`, `HIPPO_GROUP_NAME`, `HippoFieldNames`
  - `HippoExits = { UNAUTHORIZED: 'hippoUnauthorized', TICKET_NOT_FOUND: 'hippoTicketNotFound', UNAVAILABLE: 'hippoUnavailable', REJECTED: 'hippoRejected' }`
  - `buildTicketDetailsBody(n)`, `buildAddNoteBody(n, note)`, `buildUpdateStatusBody(n, status)`
  - `classifyHippoResponse(httpStatus, body)` → `{ data }` or `{ exit, message? }`
  - `htmlToMarkdown(html)`, `buildNoteHtml(authorName, text)`, `normalizeEmail(email)`
  - `matchAssignees(assignees, users)` → `[{ name, userId }]`
  - `mapTicket(data, ticketNumber)`
  - `getTicketValuesByCardId({ cards, customFieldGroups, customFields, customFieldValues })` → `{ [cardId]: { ticketNumber, ticketState, priority, ticketUrl } }`
- Produces, from `server/utils/hippo-errors.js`:
  - `HIPPO_HELPER_EXITS`, `forwardHippoExits(deferred)`
  - `HippoErrors`, `HIPPO_ERROR_EXITS`, `interceptHippoExits(deferred)`

- [ ] **Step 1: Add the dependency**

Run: `cd server && npm install turndown@7`
Expected: `server/package.json` dependencies gain `"turndown": "^7.x.x"`.

- [ ] **Step 2: Write the failing test**

Create `server/test/utils/hippo.test.js`:

```js
const { expect } = require('chai');

const { mentionMarkupToText } = require('../../utils/mentions');
const {
  HippoExits,
  buildTicketDetailsBody,
  buildAddNoteBody,
  buildUpdateStatusBody,
  classifyHippoResponse,
  htmlToMarkdown,
  buildNoteHtml,
  normalizeEmail,
  matchAssignees,
  mapTicket,
  getTicketValuesByCardId,
} = require('../../utils/hippo');

describe('hippo', () => {
  describe('request bodies', () => {
    it('asks for a ticket by its number', () => {
      expect(buildTicketDetailsBody('43886')).to.deep.equal({ ticket_id: '43886' });
    });

    it('adds a note', () => {
      expect(buildAddNoteBody('43886', '<p>Hi</p>')).to.deep.equal({
        is_update_ticket: 1,
        ticket_id: '43886',
        update_key: 'NOTE',
        note: '<p>Hi</p>',
      });
    });

    it('updates the status by its name', () => {
      expect(buildUpdateStatusBody('43886', 'Closed')).to.deep.equal({
        is_update_ticket: 1,
        ticket_id: '43886',
        update_key: 'STATUS',
        status: 'Closed',
      });
    });
  });

  describe('classifyHippoResponse', () => {
    it('returns the data of a successful response', () => {
      expect(classifyHippoResponse(200, { statusCode: 200, data: { uid: 1 } })).to.deep.equal({
        data: { uid: 1 },
      });
    });

    it('trusts the statusCode in the body over the HTTP status', () => {
      expect(
        classifyHippoResponse(200, { statusCode: 400, message: 'Ticket not found' }),
      ).to.deep.equal({ exit: HippoExits.TICKET_NOT_FOUND });
    });

    it('treats key problems as unauthorized', () => {
      expect(
        classifyHippoResponse(400, {
          statusCode: 400,
          message: 'ValidationError "app_secret_key" is required',
        }),
      ).to.deep.equal({ exit: HippoExits.UNAUTHORIZED });

      expect(classifyHippoResponse(400, { statusCode: 400, message: 'Access Denied' })).to.deep.equal(
        { exit: HippoExits.UNAUTHORIZED },
      );
    });

    it('treats server errors and unreadable bodies as unavailable', () => {
      expect(classifyHippoResponse(502, null)).to.deep.equal({ exit: HippoExits.UNAVAILABLE });
      expect(classifyHippoResponse(200, null)).to.deep.equal({ exit: HippoExits.UNAVAILABLE });
    });

    it('passes any other refusal on with its message', () => {
      expect(
        classifyHippoResponse(400, { statusCode: 400, message: 'Something went wrong!' }),
      ).to.deep.equal({ exit: HippoExits.REJECTED, message: 'Something went wrong!' });

      expect(classifyHippoResponse(400, { statusCode: 400 })).to.deep.equal({
        exit: HippoExits.REJECTED,
        message: 'Hippo responded with status 400',
      });
    });
  });

  describe('htmlToMarkdown', () => {
    it('converts HTML to Markdown', () => {
      const markdown = htmlToMarkdown(
        '<p>Hello <strong>there</strong></p><ul><li>One</li><li>Two</li></ul>',
      );

      expect(markdown).to.include('Hello **there**');
      expect(markdown).to.match(/^-\s+One$/m);
      expect(markdown).to.match(/^-\s+Two$/m);
    });

    it('decodes HTML that arrives entity-escaped', () => {
      expect(htmlToMarkdown('&lt;p&gt;Sample issue description&lt;/p&gt;')).to.equal(
        'Sample issue description',
      );
    });

    it('leaves escaped text inside real HTML alone', () => {
      expect(htmlToMarkdown('<p>a &lt; b</p>')).to.equal('a < b');
    });

    it('turns mentions into plain text', () => {
      expect(
        htmlToMarkdown(
          '<p><span class="mention" data-id="5">@Deepak kumar</span> Kindly look into this</p>',
        ),
      ).to.equal('@Deepak kumar Kindly look into this');
    });

    it('returns an empty string for missing content', () => {
      expect(htmlToMarkdown(null)).to.equal('');
      expect(htmlToMarkdown('')).to.equal('');
    });
  });

  describe('buildNoteHtml', () => {
    it('leads with the author and keeps line breaks', () => {
      expect(buildNoteHtml('Divya', 'Fixed in build 42\nPlease retest')).to.equal(
        '<p>Divya (via Planka): Fixed in build 42<br>Please retest</p>',
      );
    });

    it('turns a Planka comment with mentions and markup into a safe note', () => {
      const text = mentionMarkupToText(
        '@[deepak](1357158568008091264) please check <b>this</b> & reply\nThanks',
      );

      expect(buildNoteHtml('A <b>', text)).to.equal(
        '<p>A &lt;b&gt; (via Planka): @deepak please check &lt;b&gt;this&lt;/b&gt; &amp; reply<br>Thanks</p>',
      );
    });
  });

  describe('assignees', () => {
    it('normalizes emails, ignoring case and plus tags', () => {
      expect(normalizeEmail(' Harsh.Sharma+1cs@JungleWorks.com ')).to.equal(
        'harsh.sharma@jungleworks.com',
      );

      expect(normalizeEmail('not-an-email')).to.equal(null);
      expect(normalizeEmail(null)).to.equal(null);
    });

    it('matches assignees to users by email and keeps the unmatched ones', () => {
      const users = [
        { id: '1', email: 'harsh.sharma@jungleworks.com' },
        { id: '2', email: 'deepak@jungleworks.com' },
      ];

      expect(
        matchAssignees(
          [
            { name: 'Harsh Sharma', email: 'harsh.sharma+1cs@jungleworks.com' },
            { name: 'Sarabjot Kaur', email: 'sarabjot@jungleworks.com' },
            { name: 'Marketing', email: null },
          ],
          users,
        ),
      ).to.deep.equal([
        { name: 'Harsh Sharma', userId: '1' },
        { name: 'Sarabjot Kaur', userId: null },
        { name: 'Marketing', userId: null },
      ]);
    });
  });

  describe('mapTicket', () => {
    const data = {
      _id: 'abc',
      uid: 43886,
      subject: 'Android APK not functional',
      issue: '<p>Cannot pass the OTP screen</p>',
      status: 0,
      statusText: 'Pending from Dev',
      priority: { name: 'Normal' },
      type: { name: 'Issue' },
      group: { name: 'Jugnoo' },
      dueDate: '2026-10-05T18:30:00.000Z',
      assignee: [{ fullname: 'Sarabjot Kaur', email: 'sarabjot@jungleworks.com' }],
      notes: [
        {
          _id: 'n1',
          owner: { fullname: 'Harsh Sharma' },
          date: '2026-10-01T06:04:16.000Z',
          note: '<p>@Deepak kumar Kindly look into this</p>',
          deleted: false,
        },
        {
          _id: 'n2',
          owner: { fullname: 'Harsh Sharma' },
          date: '2026-10-01T07:00:00.000Z',
          note: '<p>Old</p>',
          deleted: true,
        },
      ],
      comments: [
        {
          _id: 'c1',
          owner: { fullname: 'Harsh Sharma' },
          date: '2026-09-29T21:38:47.000Z',
          comment: '<p>Hi Client,</p>',
          deleted: false,
        },
      ],
    };

    it('maps the ticket fields', () => {
      const ticket = mapTicket(data, '43886');

      expect(ticket).to.include({
        number: '43886',
        subject: 'Android APK not functional',
        descriptionMarkdown: 'Cannot pass the OTP screen',
        statusText: 'Pending from Dev',
        priority: 'Normal',
        type: 'Issue',
        group: 'Jugnoo',
        dueDate: '2026-10-05T18:30:00.000Z',
      });

      expect(ticket.assignees).to.deep.equal([
        { name: 'Sarabjot Kaur', email: 'sarabjot@jungleworks.com' },
      ]);
    });

    it('lists notes and comments oldest first, without deleted ones', () => {
      expect(mapTicket(data, '43886').entries).to.deep.equal([
        {
          id: 'c1',
          kind: 'comment',
          authorName: 'Harsh Sharma',
          date: '2026-09-29T21:38:47.000Z',
          markdown: 'Hi Client,',
        },
        {
          id: 'n1',
          kind: 'note',
          authorName: 'Harsh Sharma',
          date: '2026-10-01T06:04:16.000Z',
          markdown: '@Deepak kumar Kindly look into this',
        },
      ]);
    });

    it('copes with missing fields', () => {
      expect(mapTicket({}, '7')).to.deep.equal({
        number: '7',
        subject: '',
        descriptionMarkdown: '',
        statusText: null,
        priority: null,
        type: null,
        group: null,
        dueDate: null,
        assignees: [],
        entries: [],
      });
    });
  });

  describe('getTicketValuesByCardId', () => {
    const customFieldGroups = [
      { id: 'g1', boardId: 'b1', cardId: null, name: 'Hippo Ticket' },
      { id: 'g2', boardId: null, cardId: 'c3', name: 'Hippo Ticket' },
      { id: 'g3', boardId: 'b1', cardId: null, name: 'Other' },
    ];

    const customFields = [
      { id: 'f1', customFieldGroupId: 'g1', name: 'Ticket #' },
      { id: 'f2', customFieldGroupId: 'g1', name: 'Ticket State' },
      { id: 'f3', customFieldGroupId: 'g2', name: 'Ticket #' },
    ];

    const customFieldValues = [
      { cardId: 'c1', customFieldGroupId: 'g1', customFieldId: 'f1', content: '43886' },
      { cardId: 'c1', customFieldGroupId: 'g1', customFieldId: 'f2', content: 'Closed' },
      { cardId: 'c2', customFieldGroupId: 'g1', customFieldId: 'f2', content: 'New' },
      { cardId: 'c3', customFieldGroupId: 'g2', customFieldId: 'f3', content: '43934' },
    ];

    const cards = [
      { id: 'c1', boardId: 'b1' },
      { id: 'c2', boardId: 'b1' },
      { id: 'c3', boardId: 'b2' },
      { id: 'c4', boardId: 'b1' },
    ];

    it('reads ticket cards, including a moved card that carries its own group, and skips the rest', () => {
      expect(
        getTicketValuesByCardId({ cards, customFieldGroups, customFields, customFieldValues }),
      ).to.deep.equal({
        c1: { ticketNumber: '43886', ticketState: 'Closed', priority: null, ticketUrl: null },
        c3: { ticketNumber: '43934', ticketState: null, priority: null, ticketUrl: null },
      });
    });
  });
});
```

- [ ] **Step 3: Run the test and check that it fails**

Run: `cd server && npx mocha test/utils/hippo.test.js`
Expected: FAIL with `Cannot find module '../../utils/hippo'`.

- [ ] **Step 4: Implement `server/utils/hippo.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const escapeHtml = require('escape-html');
const TurndownService = require('turndown');

const HIPPO_API_URL = 'https://api.hippochat.io';
const TICKETING_PATH = '/api/ticketing/activities';
const VERIFY_ACCOUNT_PATH = '/api/business/verifyAccount';
const REQUEST_TIMEOUT_MS = 10 * 1000;

const HIPPO_GROUP_NAME = 'Hippo Ticket';

const HippoFieldNames = {
  TICKET_NUMBER: 'Ticket #',
  TICKET_STATE: 'Ticket State',
  PRIORITY: 'Priority',
  TICKET_URL: 'Ticket URL',
};

// Exits of the Hippo helpers, one per way a call can go wrong
const HippoExits = {
  UNAUTHORIZED: 'hippoUnauthorized',
  TICKET_NOT_FOUND: 'hippoTicketNotFound',
  UNAVAILABLE: 'hippoUnavailable',
  REJECTED: 'hippoRejected',
};

const EntryKinds = {
  NOTE: 'note',
  COMMENT: 'comment',
};

const FIELD_KEY_BY_NAME = {
  [HippoFieldNames.TICKET_NUMBER]: 'ticketNumber',
  [HippoFieldNames.TICKET_STATE]: 'ticketState',
  [HippoFieldNames.PRIORITY]: 'priority',
  [HippoFieldNames.TICKET_URL]: 'ticketUrl',
};

const TICKET_NOT_FOUND_REGEX = /ticket not found/i;
const UNAUTHORIZED_REGEX = /app_secret_key|access denied|unauthori[sz]ed|invalid (app )?(secret )?key/i;
const RAW_TAG_REGEX = /<[a-z!/][^>]*>/i;
const ESCAPED_TAG_REGEX = /&lt;[a-z!/]/i;

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

/* Requests */

const buildTicketDetailsBody = (ticketNumber) => ({
  ticket_id: ticketNumber,
});

const buildAddNoteBody = (ticketNumber, note) => ({
  is_update_ticket: 1,
  ticket_id: ticketNumber,
  update_key: 'NOTE',
  note,
});

const buildUpdateStatusBody = (ticketNumber, status) => ({
  is_update_ticket: 1,
  ticket_id: ticketNumber,
  update_key: 'STATUS',
  status,
});

/* Responses */

// Hippo reports the outcome in the body's statusCode, whatever the HTTP status says
const classifyHippoResponse = (httpStatus, body) => {
  if (httpStatus >= 500 || !body || typeof body !== 'object') {
    return {
      exit: HippoExits.UNAVAILABLE,
    };
  }

  const statusCode = body.statusCode || httpStatus;

  if (statusCode === 200) {
    return {
      data: body.data,
    };
  }

  const message = typeof body.message === 'string' ? body.message : '';

  if (TICKET_NOT_FOUND_REGEX.test(message)) {
    return {
      exit: HippoExits.TICKET_NOT_FOUND,
    };
  }

  if (statusCode === 401 || statusCode === 403 || UNAUTHORIZED_REGEX.test(message)) {
    return {
      exit: HippoExits.UNAUTHORIZED,
    };
  }

  return {
    exit: HippoExits.REJECTED,
    message: message || `Hippo responded with status ${statusCode}`,
  };
};

/* Content */

const decodeBasicEntities = (value) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

// Hippo keeps rich text as HTML. Its docs show that HTML entity-escaped, so text holding escaped
// tags but not a single raw one is decoded first.
const htmlToMarkdown = (html) => {
  if (!html) {
    return '';
  }

  const source =
    !RAW_TAG_REGEX.test(html) && ESCAPED_TAG_REGEX.test(html) ? decodeBasicEntities(html) : html;

  return turndownService.turndown(source).trim();
};

// Hippo shows notes added through its API as written by the business, so the Planka author leads
const buildNoteHtml = (authorName, text) => {
  const body = escapeHtml(text.trim()).replace(/\r?\n/g, '<br>');

  return `<p>${escapeHtml(authorName)} (via Planka): ${body}</p>`;
};

/* People */

// Case and any "+tag" in the local part are ignored: harsh.sharma+1cs@x is harsh.sharma@x
const normalizeEmail = (email) => {
  if (!email) {
    return null;
  }

  const [localPart, domain] = email.trim().toLowerCase().split('@');

  if (!localPart || !domain) {
    return null;
  }

  return `${localPart.split('+')[0]}@${domain}`;
};

const getPersonName = (person) =>
  (person && (person.fullname || person.username || person.email)) || '';

const matchAssignees = (assignees, users) => {
  const userIdByEmail = {};

  users.forEach((user) => {
    const email = normalizeEmail(user.email);

    if (email && !userIdByEmail[email]) {
      userIdByEmail[email] = user.id;
    }
  });

  return assignees.map((assignee) => {
    const email = normalizeEmail(assignee.email);

    return {
      name: assignee.name,
      userId: (email && userIdByEmail[email]) || null,
    };
  });
};

/* Tickets */

const getTime = (date) => (date ? new Date(date).getTime() : 0);

const mapEntries = (items, kind, contentKey) =>
  (items || [])
    .filter((item) => item && !item.deleted)
    .map((item, index) => ({
      // eslint-disable-next-line no-underscore-dangle
      id: item._id ? String(item._id) : `${kind}-${index}`,
      kind,
      authorName: getPersonName(item.owner),
      date: item.date || null,
      markdown: htmlToMarkdown(item[contentKey]),
    }));

const mapTicket = (data, ticketNumber) => ({
  number: data.uid ? String(data.uid) : ticketNumber,
  subject: data.subject || '',
  descriptionMarkdown: htmlToMarkdown(data.issue),
  statusText: data.statusText || null,
  priority: (data.priority && data.priority.name) || null,
  type: (data.type && data.type.name) || null,
  group: (data.group && data.group.name) || null,
  dueDate: data.dueDate || null,
  assignees: (data.assignee || []).map((assignee) => ({
    name: getPersonName(assignee),
    email: assignee.email || null,
  })),
  // Oldest first, the order they are posted to the card in
  entries: [
    ...mapEntries(data.notes, EntryKinds.NOTE, 'note'),
    ...mapEntries(data.comments, EntryKinds.COMMENT, 'comment'),
  ].sort((a, b) => getTime(a.date) - getTime(b.date)),
});

// A card's Hippo values come from its board's "Hippo Ticket" group or, failing that, from the
// card's own copy of it, which Planka makes when the card moves to another board. Cards without
// a ticket number are left out.
const getTicketValuesByCardId = ({ cards, customFieldGroups, customFields, customFieldValues }) => {
  const hippoCustomFieldGroups = customFieldGroups.filter(
    (customFieldGroup) => customFieldGroup.name === HIPPO_GROUP_NAME,
  );

  const fieldKeyByCustomFieldId = {};

  customFields.forEach((customField) => {
    const fieldKey = FIELD_KEY_BY_NAME[customField.name];

    if (fieldKey) {
      fieldKeyByCustomFieldId[customField.id] = fieldKey;
    }
  });

  const valuesByGroupedCardId = {};

  customFieldValues.forEach((customFieldValue) => {
    const fieldKey = fieldKeyByCustomFieldId[customFieldValue.customFieldId];

    if (!fieldKey) {
      return;
    }

    const groupedCardId = `${customFieldValue.cardId}:${customFieldValue.customFieldGroupId}`;

    valuesByGroupedCardId[groupedCardId] = {
      ...valuesByGroupedCardId[groupedCardId],
      [fieldKey]: customFieldValue.content,
    };
  });

  const result = {};

  cards.forEach((card) => {
    const values = [
      ...hippoCustomFieldGroups.filter((customFieldGroup) => customFieldGroup.boardId === card.boardId),
      ...hippoCustomFieldGroups.filter((customFieldGroup) => customFieldGroup.cardId === card.id),
    ]
      .map((customFieldGroup) => valuesByGroupedCardId[`${card.id}:${customFieldGroup.id}`])
      .find((groupValues) => groupValues && groupValues.ticketNumber);

    if (values) {
      result[card.id] = {
        ticketNumber: values.ticketNumber,
        ticketState: values.ticketState || null,
        priority: values.priority || null,
        ticketUrl: values.ticketUrl || null,
      };
    }
  });

  return result;
};

module.exports = {
  HIPPO_API_URL,
  TICKETING_PATH,
  VERIFY_ACCOUNT_PATH,
  REQUEST_TIMEOUT_MS,
  HIPPO_GROUP_NAME,
  HippoFieldNames,
  HippoExits,
  buildTicketDetailsBody,
  buildAddNoteBody,
  buildUpdateStatusBody,
  classifyHippoResponse,
  htmlToMarkdown,
  buildNoteHtml,
  normalizeEmail,
  matchAssignees,
  mapTicket,
  getTicketValuesByCardId,
};
```

- [ ] **Step 5: Implement `server/utils/hippo-errors.js`**

This file is not unit-tested: it is thin wiring around Sails' `.intercept`.

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Exits every helper that ends up calling Hippo may take
const HIPPO_HELPER_EXITS = {
  hippoUnauthorized: {},
  hippoTicketNotFound: {},
  hippoUnavailable: {},
  hippoRejected: {},
};

// Lets a helper that calls sendRequest end in the same exits, Hippo's message included
const forwardHippoExits = (deferred) =>
  deferred
    .intercept('hippoUnauthorized', 'hippoUnauthorized')
    .intercept('hippoTicketNotFound', 'hippoTicketNotFound')
    .intercept('hippoUnavailable', 'hippoUnavailable')
    .intercept('hippoRejected', (message) => ({
      hippoRejected: message,
    }));

// How controllers report a failed Hippo call. None answers 401, which would sign the Planka user
// out. The client translates these messages; Hippo's own refusals pass through as Hippo words them.
const HippoErrors = {
  HIPPO_NOT_CONFIGURED: {
    hippoNotConfigured: 'Hippo not configured',
  },
  HIPPO_KEY_INVALID: {
    hippoKeyInvalid: 'Hippo key invalid',
  },
  HIPPO_TICKET_NOT_FOUND: {
    hippoTicketNotFound: 'Hippo ticket not found',
  },
  HIPPO_UNAVAILABLE: {
    hippoUnavailable: 'Hippo unavailable',
  },
};

const HIPPO_ERROR_EXITS = {
  hippoNotConfigured: {
    responseType: 'unprocessableEntity',
  },
  hippoKeyInvalid: {
    responseType: 'unprocessableEntity',
  },
  hippoTicketNotFound: {
    responseType: 'notFound',
  },
  hippoUnavailable: {
    responseType: 'unprocessableEntity',
  },
  hippoRejected: {
    responseType: 'unprocessableEntity',
  },
};

const interceptHippoExits = (deferred) =>
  deferred
    .intercept('hippoUnauthorized', () => HippoErrors.HIPPO_KEY_INVALID)
    .intercept('hippoTicketNotFound', () => HippoErrors.HIPPO_TICKET_NOT_FOUND)
    .intercept('hippoUnavailable', () => HippoErrors.HIPPO_UNAVAILABLE)
    .intercept('hippoRejected', (message) => ({
      hippoRejected: message,
    }));

module.exports = {
  HIPPO_HELPER_EXITS,
  forwardHippoExits,
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
};
```

- [ ] **Step 6: Run the tests and check that they pass**

Run: `cd server && npx mocha test/utils/hippo.test.js`
Expected: PASS, 21 passing.

If the list-item assertion fails, the Turndown version formats lists differently. Inspect `htmlToMarkdown(...)` output in `node -e` and adjust only the regex in the test, not the code.

- [ ] **Step 7: Light checks**

Run: `cd server && npx eslint utils/hippo.js utils/hippo-errors.js test/utils/hippo.test.js`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/package-lock.json server/utils/hippo.js server/utils/hippo-errors.js server/test/utils/hippo.test.js
git commit -m "hippo: ticket mapping, response classification and note building" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hippo HTTP helpers and key-management endpoints

**Files:**
- Create in `server/api/helpers/hippo/`: `send-request.js`, `fetch-ticket.js`, `add-note.js`, `update-status.js`, `verify-account.js`, `get-app-secret-key.js`, `get-ticket-values-by-cards.js`
- Create in `server/api/controllers/hippo/`: `update-config.js`, `delete-config.js`, `verify-config.js`
- Modify: `server/config/routes.js`

**Interfaces:**
- Consumes: everything from Task 3, plus `ProjectHippoConfig.qm` and `CustomFieldGroup.qm.getByBoardIds` (Task 1).
- Produces these helpers:
  - `sails.helpers.hippo.sendRequest.with({ appSecretKey, path, body? })` → Hippo `data`
  - `sails.helpers.hippo.fetchTicket.with({ appSecretKey, ticketNumber })` → raw ticket `data`
  - `sails.helpers.hippo.addNote.with({ appSecretKey, ticketNumber, note })`
  - `sails.helpers.hippo.updateStatus.with({ appSecretKey, ticketNumber, status })`
  - `sails.helpers.hippo.verifyAccount.with({ appSecretKey })` → `true`
  - `sails.helpers.hippo.getAppSecretKey(projectId)` → string, or exit `hippoNotConfigured`
  - `sails.helpers.hippo.getTicketValuesByCards(cards)` → `{ [cardId]: { ticketNumber, ticketState, priority, ticketUrl } }`
- Produces these routes:
  - `PUT /api/projects/:projectId/hippo-config` with `{ appSecretKey }` → `{ item: { projectId, isHippoConfigured: true } }`
  - `DELETE /api/projects/:projectId/hippo-config` → `{ item: { projectId, isHippoConfigured: false } }`
  - `POST /api/projects/:projectId/hippo-config/verify` → `{ item: { projectId, isValid: true } }`

- [ ] **Step 1: Create `send-request.js`, the only file that talks HTTP**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { ProxyAgent } = require('undici');

const {
  HIPPO_API_URL,
  REQUEST_TIMEOUT_MS,
  HippoExits,
  classifyHippoResponse,
} = require('../../../utils/hippo');
const { HIPPO_HELPER_EXITS } = require('../../../utils/hippo-errors');

/**
 * The one place that talks to Hippo. A body makes it a POST; without one it is a GET carrying the
 * key in the query, as verifyAccount wants. The key never reaches a log line.
 */
module.exports = {
  inputs: {
    appSecretKey: {
      type: 'string',
      required: true,
    },
    path: {
      type: 'string',
      required: true,
    },
    body: {
      type: 'json',
    },
  },

  exits: {
    ...HIPPO_HELPER_EXITS,
  },

  async fn(inputs) {
    const url = new URL(inputs.path, HIPPO_API_URL);

    const options = {
      method: inputs.body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      dispatcher: sails.config.custom.outgoingProxy
        ? new ProxyAgent(sails.config.custom.outgoingProxy)
        : undefined,
    };

    if (inputs.body) {
      options.body = JSON.stringify({
        ...inputs.body,
        app_secret_key: inputs.appSecretKey,
      });
    } else {
      url.searchParams.set('app_secret_key', inputs.appSecretKey);
    }

    let response;
    let body;

    try {
      response = await fetch(url, options);
      body = await response.json().catch(() => null);
    } catch (error) {
      sails.log.warn(`Hippo request to ${inputs.path} failed: ${error.message}`);
      throw HippoExits.UNAVAILABLE;
    }

    const result = classifyHippoResponse(response.status, body);

    if (result.exit === HippoExits.REJECTED) {
      sails.log.warn(`Hippo refused a request to ${inputs.path}: ${result.message}`);

      throw {
        [HippoExits.REJECTED]: result.message,
      };
    }

    if (result.exit) {
      throw result.exit;
    }

    return result.data;
  },
};
```

- [ ] **Step 2: Create `fetch-ticket.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { TICKETING_PATH, buildTicketDetailsBody } = require('../../../utils/hippo');
const { HIPPO_HELPER_EXITS, forwardHippoExits } = require('../../../utils/hippo-errors');

module.exports = {
  inputs: {
    appSecretKey: {
      type: 'string',
      required: true,
    },
    ticketNumber: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    ...HIPPO_HELPER_EXITS,
  },

  async fn(inputs) {
    return forwardHippoExits(
      sails.helpers.hippo.sendRequest.with({
        appSecretKey: inputs.appSecretKey,
        path: TICKETING_PATH,
        body: buildTicketDetailsBody(inputs.ticketNumber),
      }),
    );
  },
};
```

- [ ] **Step 3: Create `add-note.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { TICKETING_PATH, buildAddNoteBody } = require('../../../utils/hippo');
const { HIPPO_HELPER_EXITS, forwardHippoExits } = require('../../../utils/hippo-errors');

module.exports = {
  inputs: {
    appSecretKey: {
      type: 'string',
      required: true,
    },
    ticketNumber: {
      type: 'string',
      required: true,
    },
    note: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    ...HIPPO_HELPER_EXITS,
  },

  async fn(inputs) {
    return forwardHippoExits(
      sails.helpers.hippo.sendRequest.with({
        appSecretKey: inputs.appSecretKey,
        path: TICKETING_PATH,
        body: buildAddNoteBody(inputs.ticketNumber, inputs.note),
      }),
    );
  },
};
```

- [ ] **Step 4: Create `update-status.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { TICKETING_PATH, buildUpdateStatusBody } = require('../../../utils/hippo');
const { HIPPO_HELPER_EXITS, forwardHippoExits } = require('../../../utils/hippo-errors');

module.exports = {
  inputs: {
    appSecretKey: {
      type: 'string',
      required: true,
    },
    ticketNumber: {
      type: 'string',
      required: true,
    },
    status: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    ...HIPPO_HELPER_EXITS,
  },

  async fn(inputs) {
    return forwardHippoExits(
      sails.helpers.hippo.sendRequest.with({
        appSecretKey: inputs.appSecretKey,
        path: TICKETING_PATH,
        body: buildUpdateStatusBody(inputs.ticketNumber, inputs.status),
      }),
    );
  },
};
```

- [ ] **Step 5: Create `verify-account.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { VERIFY_ACCOUNT_PATH } = require('../../../utils/hippo');
const { HIPPO_HELPER_EXITS, forwardHippoExits } = require('../../../utils/hippo-errors');

module.exports = {
  inputs: {
    appSecretKey: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    ...HIPPO_HELPER_EXITS,
  },

  async fn(inputs) {
    await forwardHippoExits(
      sails.helpers.hippo.sendRequest.with({
        appSecretKey: inputs.appSecretKey,
        path: VERIFY_ACCOUNT_PATH,
      }),
    );

    return true;
  },
};
```

- [ ] **Step 6: Create `get-app-secret-key.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = {
  inputs: {
    projectId: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    hippoNotConfigured: {},
  },

  async fn(inputs) {
    const projectHippoConfig = await ProjectHippoConfig.qm.getOneByProjectId(inputs.projectId);

    if (!projectHippoConfig) {
      throw 'hippoNotConfigured';
    }

    return projectHippoConfig.appSecretKey;
  },
};
```

- [ ] **Step 7: Create `get-ticket-values-by-cards.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const { HIPPO_GROUP_NAME, getTicketValuesByCardId } = require('../../../utils/hippo');

// The Hippo values of whichever of the cards are linked to a ticket, read in a few batched queries
module.exports = {
  inputs: {
    cards: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    if (inputs.cards.length === 0) {
      return {};
    }

    const cardIds = sails.helpers.utils.mapRecords(inputs.cards);
    const boardIds = sails.helpers.utils.mapRecords(inputs.cards, 'boardId', true);

    const boardCustomFieldGroups = await CustomFieldGroup.qm.getByBoardIds(boardIds);
    const cardCustomFieldGroups = await CustomFieldGroup.qm.getByCardIds(cardIds);

    const customFieldGroups = [...boardCustomFieldGroups, ...cardCustomFieldGroups].filter(
      (customFieldGroup) => customFieldGroup.name === HIPPO_GROUP_NAME,
    );

    if (customFieldGroups.length === 0) {
      return {};
    }

    const customFieldGroupIds = sails.helpers.utils.mapRecords(customFieldGroups);
    const customFields = await CustomField.qm.getByCustomFieldGroupIds(customFieldGroupIds);

    const customFieldValues = await CustomFieldValue.qm.getByCardIds(cardIds, {
      customFieldGroupIdOrIds: customFieldGroupIds,
    });

    return getTicketValuesByCardId({
      cards: inputs.cards,
      customFieldGroups,
      customFields,
      customFieldValues,
    });
  },
};
```

- [ ] **Step 8: Create the controller that saves the key**

Create `server/api/controllers/hippo/update-config.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /projects/{projectId}/hippo-config:
 *   put:
 *     summary: Set Hippo app secret key
 *     description: Saves or replaces the project's Hippo app secret key, which is never returned. Requires project manager permissions.
 *     tags:
 *       - Hippo
 *     operationId: updateHippoConfig
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: ID of the project
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appSecretKey
 *             properties:
 *               appSecretKey:
 *                 type: string
 *                 maxLength: 512
 *                 description: App secret key from Hippo's business settings
 *     responses:
 *       200:
 *         description: Key saved
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  PROJECT_NOT_FOUND: {
    projectNotFound: 'Project not found',
  },
};

module.exports = {
  inputs: {
    projectId: {
      ...idInput,
      required: true,
    },
    appSecretKey: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 512,
      required: true,
    },
  },

  exits: {
    projectNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const project = await Project.qm.getOneById(inputs.projectId);

    if (!project) {
      throw Errors.PROJECT_NOT_FOUND;
    }

    const isProjectManager = await sails.helpers.users.isProjectManager(currentUser.id, project.id);

    if (!isProjectManager) {
      throw Errors.PROJECT_NOT_FOUND; // Forbidden
    }

    await ProjectHippoConfig.qm.createOrUpdateOne(project.id, {
      appSecretKey: inputs.appSecretKey.trim(),
    });

    if (!project.isHippoConfigured) {
      // Without the request, the projectUpdate event reaches this manager too, whose store then
      // learns the project is configured
      await sails.helpers.projects.updateOne.with({
        record: project,
        values: {
          isHippoConfigured: true,
        },
        actorUser: currentUser,
      });
    }

    return {
      item: {
        projectId: project.id,
        isHippoConfigured: true,
      },
    };
  },
};
```

- [ ] **Step 9: Create the controller that removes the key**

Create `server/api/controllers/hippo/delete-config.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /projects/{projectId}/hippo-config:
 *   delete:
 *     summary: Remove Hippo app secret key
 *     description: Removes the project's Hippo app secret key, which turns importing and syncing off. Requires project manager permissions.
 *     tags:
 *       - Hippo
 *     operationId: deleteHippoConfig
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: ID of the project
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     responses:
 *       200:
 *         description: Key removed
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  PROJECT_NOT_FOUND: {
    projectNotFound: 'Project not found',
  },
};

module.exports = {
  inputs: {
    projectId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    projectNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const project = await Project.qm.getOneById(inputs.projectId);

    if (!project) {
      throw Errors.PROJECT_NOT_FOUND;
    }

    const isProjectManager = await sails.helpers.users.isProjectManager(currentUser.id, project.id);

    if (!isProjectManager) {
      throw Errors.PROJECT_NOT_FOUND; // Forbidden
    }

    await ProjectHippoConfig.qm.delete({
      projectId: project.id,
    });

    if (project.isHippoConfigured) {
      await sails.helpers.projects.updateOne.with({
        record: project,
        values: {
          isHippoConfigured: false,
        },
        actorUser: currentUser,
      });
    }

    return {
      item: {
        projectId: project.id,
        isHippoConfigured: false,
      },
    };
  },
};
```

- [ ] **Step 10: Create the controller that tests the key**

Create `server/api/controllers/hippo/verify-config.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /projects/{projectId}/hippo-config/verify:
 *   post:
 *     summary: Test Hippo app secret key
 *     description: Checks the stored Hippo app secret key against Hippo. Requires project manager permissions.
 *     tags:
 *       - Hippo
 *     operationId: verifyHippoConfig
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: ID of the project
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     responses:
 *       200:
 *         description: Hippo accepted the key
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const { idInput } = require('../../../utils/inputs');
const {
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
} = require('../../../utils/hippo-errors');

const Errors = {
  PROJECT_NOT_FOUND: {
    projectNotFound: 'Project not found',
  },
};

module.exports = {
  inputs: {
    projectId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    projectNotFound: {
      responseType: 'notFound',
    },
    ...HIPPO_ERROR_EXITS,
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const project = await Project.qm.getOneById(inputs.projectId);

    if (!project) {
      throw Errors.PROJECT_NOT_FOUND;
    }

    const isProjectManager = await sails.helpers.users.isProjectManager(currentUser.id, project.id);

    if (!isProjectManager) {
      throw Errors.PROJECT_NOT_FOUND; // Forbidden
    }

    const appSecretKey = await sails.helpers.hippo
      .getAppSecretKey(project.id)
      .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

    await interceptHippoExits(
      sails.helpers.hippo.verifyAccount.with({
        appSecretKey,
      }),
    );

    return {
      item: {
        projectId: project.id,
        isValid: true,
      },
    };
  },
};
```

- [ ] **Step 11: Add the routes**

In `server/config/routes.js`, add this directly after `'DELETE /api/projects/:id': 'projects/delete',`:

```js
  'PUT /api/projects/:projectId/hippo-config': 'hippo/update-config',
  'DELETE /api/projects/:projectId/hippo-config': 'hippo/delete-config',
  'POST /api/projects/:projectId/hippo-config/verify': 'hippo/verify-config',
```

- [ ] **Step 12: Light checks**

Run:

```bash
cd server && npx eslint api/helpers/hippo api/controllers/hippo config/routes.js && for f in api/helpers/hippo/*.js api/controllers/hippo/*.js; do node --check "$f" || exit 1; done && node -e "require('./api/helpers/hippo/send-request.js'); console.log('ok')"
```

Expected: no eslint output, then `ok`.

`node --check` checks syntax only. Requiring helpers outside Sails works because they touch `sails` only inside `fn`. Running these against Hippo is part of Shankar's manual checks.

- [ ] **Step 13: Commit**

```bash
git add server/api/helpers/hippo server/api/controllers/hippo server/config/routes.js
git commit -m "hippo: Hippo client helpers and project key endpoints" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ticket lookup, sync endpoints and dashboard ticket numbers

**Files:**
- Create in `server/api/controllers/hippo/`: `show-ticket.js`, `sync-note.js`, `sync-status.js`
- Modify: `server/config/routes.js`
- Modify: `server/api/controllers/dashboard/show.js`

**Interfaces:**
- Consumes: the helpers from Task 4, plus `mapTicket`, `matchAssignees` and `buildNoteHtml` (Task 3), plus `mentionMarkupToText` (`server/utils/mentions.js`).
- Produces:
  - `GET /api/boards/:boardId/hippo-tickets/:ticketNumber` → `{ item: { number, subject, descriptionMarkdown, statusText, priority, type, group, dueDate, assignees: [{ name, userId }], entries: [{ id, kind, authorName, date, markdown }] } }`
  - `POST /api/cards/:cardId/hippo-sync/note` with `{ commentId }` → `{ item: { cardId, commentId, ticketNumber } }`
  - `POST /api/cards/:cardId/hippo-sync/status` → `{ item: { cardId, ticketNumber, ticketState } }`
  - `GET /api/dashboard`: every card in `items` gains `ticketNumber: string | null`

- [ ] **Step 0: Impact check.** Run `gitnexus_impact` (upstream) on `dashboard/show.js`. The change only adds a field to each card.

- [ ] **Step 1: Create the lookup controller**

Create `server/api/controllers/hippo/show-ticket.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /boards/{boardId}/hippo-tickets/{ticketNumber}:
 *   get:
 *     summary: Look up Hippo ticket
 *     description: Fetches a Hippo ticket for prefilling a new card on the board. Assignees come matched to board members by email; emails are not returned. Requires board editor permissions.
 *     tags:
 *       - Hippo
 *     operationId: getHippoTicket
 *     parameters:
 *       - name: boardId
 *         in: path
 *         required: true
 *         description: ID of the board the card will be added to
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *       - name: ticketNumber
 *         in: path
 *         required: true
 *         description: Visible Hippo ticket number
 *         schema:
 *           type: string
 *           example: "43886"
 *     responses:
 *       200:
 *         description: Ticket found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const { idInput } = require('../../../utils/inputs');
const { mapTicket, matchAssignees } = require('../../../utils/hippo');
const {
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
} = require('../../../utils/hippo-errors');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  BOARD_NOT_FOUND: {
    boardNotFound: 'Board not found',
  },
};

module.exports = {
  inputs: {
    boardId: {
      ...idInput,
      required: true,
    },
    ticketNumber: {
      type: 'string',
      regex: /^\d{1,12}$/,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    boardNotFound: {
      responseType: 'notFound',
    },
    ...HIPPO_ERROR_EXITS,
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // ---- Step 1: Check the user may add cards to the board ----
    const { board, project } = await sails.helpers.boards
      .getPathToProjectById(inputs.boardId)
      .intercept('pathNotFound', () => Errors.BOARD_NOT_FOUND);

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.BOARD_NOT_FOUND; // Forbidden
    }

    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    // ---- Step 2: Fetch the ticket from Hippo ----
    const appSecretKey = await sails.helpers.hippo
      .getAppSecretKey(project.id)
      .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

    const data = await interceptHippoExits(
      sails.helpers.hippo.fetchTicket.with({
        appSecretKey,
        ticketNumber: inputs.ticketNumber,
      }),
    );

    if (!data) {
      throw HippoErrors.HIPPO_TICKET_NOT_FOUND;
    }

    // ---- Step 3: Match assignees to board members; emails never leave the server ----
    const ticket = mapTicket(data, inputs.ticketNumber);

    const boardMemberships = await BoardMembership.qm.getByBoardId(board.id);

    const users = await User.qm.getByIds(
      sails.helpers.utils.mapRecords(boardMemberships, 'userId'),
      {
        withDeactivated: false,
      },
    );

    return {
      item: {
        ...ticket,
        assignees: matchAssignees(ticket.assignees, users),
      },
    };
  },
};
```

- [ ] **Step 2: Create the comment-to-note sync controller**

Create `server/api/controllers/hippo/sync-note.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /cards/{cardId}/hippo-sync/note:
 *   post:
 *     summary: Post comment to Hippo
 *     description: Adds a comment of a card linked to a Hippo ticket to that ticket as a note. Requires board editor permissions.
 *     tags:
 *       - Hippo
 *     operationId: syncHippoNote
 *     parameters:
 *       - name: cardId
 *         in: path
 *         required: true
 *         description: ID of the ticket card
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - commentId
 *             properties:
 *               commentId:
 *                 type: string
 *                 description: ID of the comment to post
 *                 example: "1357158568008091265"
 *     responses:
 *       200:
 *         description: Note added in Hippo
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const { idInput } = require('../../../utils/inputs');
const { mentionMarkupToText } = require('../../../utils/mentions');
const { buildNoteHtml } = require('../../../utils/hippo');
const {
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
} = require('../../../utils/hippo-errors');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  COMMENT_NOT_FOUND: {
    commentNotFound: 'Comment not found',
  },
  NOT_A_TICKET_CARD: {
    notATicketCard: 'Not a ticket card',
  },
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
    commentId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    cardNotFound: {
      responseType: 'notFound',
    },
    commentNotFound: {
      responseType: 'notFound',
    },
    notATicketCard: {
      responseType: 'unprocessableEntity',
    },
    ...HIPPO_ERROR_EXITS,
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // ---- Step 1: Check the user may edit the card ----
    const { card, board, project } = await sails.helpers.cards
      .getPathToProjectById(inputs.cardId)
      .intercept('pathNotFound', () => Errors.CARD_NOT_FOUND);

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.CARD_NOT_FOUND; // Forbidden
    }

    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    // ---- Step 2: Find the comment and the ticket it goes to ----
    const comment = await Comment.qm.getOneById(inputs.commentId);

    if (!comment || comment.cardId !== card.id) {
      throw Errors.COMMENT_NOT_FOUND;
    }

    const ticketValuesByCardId = await sails.helpers.hippo.getTicketValuesByCards([card]);
    const ticketValues = ticketValuesByCardId[card.id];

    if (!ticketValues) {
      throw Errors.NOT_A_TICKET_CARD;
    }

    const appSecretKey = await sails.helpers.hippo
      .getAppSecretKey(project.id)
      .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

    // ---- Step 3: Post the comment as a note, led by its author ----
    const author =
      comment.userId === currentUser.id ? currentUser : await User.qm.getOneById(comment.userId);

    await interceptHippoExits(
      sails.helpers.hippo.addNote.with({
        appSecretKey,
        ticketNumber: ticketValues.ticketNumber,
        note: buildNoteHtml(author ? author.name : 'Unknown user', mentionMarkupToText(comment.text)),
      }),
    );

    return {
      item: {
        cardId: card.id,
        commentId: comment.id,
        ticketNumber: ticketValues.ticketNumber,
      },
    };
  },
};
```

- [ ] **Step 3: Create the ticket-state sync controller**

Create `server/api/controllers/hippo/sync-status.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @swagger
 * /cards/{cardId}/hippo-sync/status:
 *   post:
 *     summary: Push ticket state to Hippo
 *     description: Sets the Hippo ticket's status to the card's current Ticket State value. Requires board editor permissions.
 *     tags:
 *       - Hippo
 *     operationId: syncHippoStatus
 *     parameters:
 *       - name: cardId
 *         in: path
 *         required: true
 *         description: ID of the ticket card
 *         schema:
 *           type: string
 *           example: "1357158568008091264"
 *     responses:
 *       200:
 *         description: Status updated in Hippo
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/UnprocessableEntity'
 */

const { idInput } = require('../../../utils/inputs');
const {
  HippoErrors,
  HIPPO_ERROR_EXITS,
  interceptHippoExits,
} = require('../../../utils/hippo-errors');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  NOT_A_TICKET_CARD: {
    notATicketCard: 'Not a ticket card',
  },
  TICKET_STATE_MUST_BE_PRESENT: {
    ticketStateMustBePresent: 'Ticket state must be present',
  },
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    cardNotFound: {
      responseType: 'notFound',
    },
    notATicketCard: {
      responseType: 'unprocessableEntity',
    },
    ticketStateMustBePresent: {
      responseType: 'unprocessableEntity',
    },
    ...HIPPO_ERROR_EXITS,
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    // ---- Step 1: Check the user may edit the card ----
    const { card, board, project } = await sails.helpers.cards
      .getPathToProjectById(inputs.cardId)
      .intercept('pathNotFound', () => Errors.CARD_NOT_FOUND);

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.CARD_NOT_FOUND; // Forbidden
    }

    if (boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    // ---- Step 2: Read the state the card holds now ----
    const ticketValuesByCardId = await sails.helpers.hippo.getTicketValuesByCards([card]);
    const ticketValues = ticketValuesByCardId[card.id];

    if (!ticketValues) {
      throw Errors.NOT_A_TICKET_CARD;
    }

    if (!ticketValues.ticketState) {
      throw Errors.TICKET_STATE_MUST_BE_PRESENT;
    }

    const appSecretKey = await sails.helpers.hippo
      .getAppSecretKey(project.id)
      .intercept('hippoNotConfigured', () => HippoErrors.HIPPO_NOT_CONFIGURED);

    // ---- Step 3: Set it as the ticket's status in Hippo ----
    await interceptHippoExits(
      sails.helpers.hippo.updateStatus.with({
        appSecretKey,
        ticketNumber: ticketValues.ticketNumber,
        status: ticketValues.ticketState,
      }),
    );

    return {
      item: {
        cardId: card.id,
        ticketNumber: ticketValues.ticketNumber,
        ticketState: ticketValues.ticketState,
      },
    };
  },
};
```

- [ ] **Step 4: Add the routes**

In `server/config/routes.js`, add this directly after `'DELETE /api/cards/:cardId/card-recurrence': 'card-recurrences/delete',`:

```js

  'GET /api/boards/:boardId/hippo-tickets/:ticketNumber': 'hippo/show-ticket',
  'POST /api/cards/:cardId/hippo-sync/note': 'hippo/sync-note',
  'POST /api/cards/:cardId/hippo-sync/status': 'hippo/sync-status',
```

- [ ] **Step 5: Add ticket numbers to the dashboard**

In `server/api/controllers/dashboard/show.js`:
- Rename the comment `// ---- Step 4: Fetch users (board members + card members) ----` to `// ---- Step 5: Fetch users (board members + card members) ----`.
- Directly before that renamed comment, add:

```js
    // ---- Step 4: Mark the cards linked to a Hippo ticket with its number ----
    const ticketValuesByCardId = await sails.helpers.hippo.getTicketValuesByCards(cards);

    cards.forEach((card) => {
      const ticketValues = ticketValuesByCardId[card.id];

      // eslint-disable-next-line no-param-reassign
      card.ticketNumber = ticketValues ? ticketValues.ticketNumber : null;
    });

```

- [ ] **Step 6: Light checks**

Run:

```bash
cd server && npx eslint api/controllers/hippo api/controllers/dashboard/show.js config/routes.js && for f in api/controllers/hippo/*.js api/controllers/dashboard/show.js; do node --check "$f" || exit 1; done && npx mocha test/utils/hippo.test.js test/utils/custom-fields.test.js
```

Expected: no eslint output, no syntax errors, and mocha shows 31 passing.

- [ ] **Step 7: Commit**

```bash
git add server/api/controllers/hippo server/api/controllers/dashboard/show.js server/config/routes.js
git commit -m "hippo: ticket lookup, comment/state sync and dashboard ticket numbers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dropdown type in the client's field editors

**Files:**
- Create: `client/src/utils/custom-fields.js`
- Test: `client/src/utils/custom-fields.test.js`
- Create in `client/src/components/custom-fields/CustomFieldEditor/`: `CustomFieldEditor.jsx`, `CustomFieldEditor.module.scss`, `OptionsEditor.jsx`, `index.js`
- Modify: `client/src/constants/Enums.js`
- Modify: `client/src/models/CustomField.js`
- Modify the add and edit steps in both places:
  - `client/src/components/custom-field-groups/CustomFieldGroupStep/CustomFieldAddStep.jsx`
  - `client/src/components/custom-field-groups/CustomFieldGroupStep/CustomFieldEditStep.jsx`
  - `client/src/components/base-custom-field-groups/BaseCustomFieldGroupStep/CustomFieldAddStep.jsx`
  - `client/src/components/base-custom-field-groups/BaseCustomFieldGroupStep/CustomFieldEditStep.jsx`
- Delete both identical `CustomFieldEditor.jsx` and `CustomFieldEditor.module.scss` files in those two folders.
- Modify: `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes: the server API from Task 2.
- Produces:
  - `CustomFieldTypes = { TEXT: 'text', DROPDOWN: 'dropdown' }`
  - client model attributes `type` and `options`
  - `cleanCustomFieldOptions(options)`
  - `buildCustomFieldData({ name, showOnFrontOfCard, type, options })` → `{ name, showOnFrontOfCard, type, options }`
  - `isCustomFieldDataComplete(data)` → boolean
  - shared `<CustomFieldEditor ref data onFieldChange />`

- [ ] **Step 1: Write the failing test**

Create `client/src/utils/custom-fields.test.js`:

```js
import {
  buildCustomFieldData,
  cleanCustomFieldOptions,
  isCustomFieldDataComplete,
} from './custom-fields';

describe('cleanCustomFieldOptions', () => {
  it('trims options and drops blanks and repeats', () => {
    expect(cleanCustomFieldOptions([' New ', '', 'Closed', 'New', '  '])).toEqual(['New', 'Closed']);
  });
});

describe('buildCustomFieldData', () => {
  it('keeps the cleaned options of a dropdown', () => {
    expect(
      buildCustomFieldData({
        name: ' State ',
        showOnFrontOfCard: true,
        type: 'dropdown',
        options: ['New', ' New', 'Closed'],
      }),
    ).toEqual({
      name: 'State',
      showOnFrontOfCard: true,
      type: 'dropdown',
      options: ['New', 'Closed'],
    });
  });

  it('drops the options of a text field', () => {
    expect(
      buildCustomFieldData({ name: 'Notes', showOnFrontOfCard: false, type: 'text', options: ['A'] }),
    ).toEqual({ name: 'Notes', showOnFrontOfCard: false, type: 'text', options: null });
  });

  it('turns a blank name into null', () => {
    expect(
      buildCustomFieldData({ name: '   ', showOnFrontOfCard: false, type: 'text', options: [] })
        .name,
    ).toBeNull();
  });
});

describe('isCustomFieldDataComplete', () => {
  it('needs a name', () => {
    expect(isCustomFieldDataComplete({ name: null, type: 'text', options: null })).toBe(false);
  });

  it('needs at least one option for a dropdown', () => {
    expect(isCustomFieldDataComplete({ name: 'State', type: 'dropdown', options: [] })).toBe(false);

    expect(isCustomFieldDataComplete({ name: 'State', type: 'dropdown', options: ['New'] })).toBe(
      true,
    );
  });

  it('accepts a named text field', () => {
    expect(isCustomFieldDataComplete({ name: 'Notes', type: 'text', options: null })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `cd client && npx jest src/utils/custom-fields.test.js`
Expected: FAIL with `Cannot find module './custom-fields'`.

- [ ] **Step 3: Add the enum and implement the util**

In `client/src/constants/Enums.js`, add this directly after the `CardTypes` export:

```js
export const CustomFieldTypes = {
  TEXT: 'text',
  DROPDOWN: 'dropdown',
};
```

Create `client/src/utils/custom-fields.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { CustomFieldTypes } from '../constants/Enums';

// Trimmed, without blanks or repeats, in the order given
export const cleanCustomFieldOptions = (options) =>
  options.reduce((result, option) => {
    const trimmedOption = option.trim();

    return trimmedOption && !result.includes(trimmedOption) ? [...result, trimmedOption] : result;
  }, []);

// What an add or edit form sends; options only travel with dropdown fields
export const buildCustomFieldData = ({ name, showOnFrontOfCard, type, options }) => ({
  name: name.trim() || null,
  showOnFrontOfCard,
  type,
  options: type === CustomFieldTypes.DROPDOWN ? cleanCustomFieldOptions(options) : null,
});

export const isCustomFieldDataComplete = (data) =>
  !!data.name && (data.type !== CustomFieldTypes.DROPDOWN || data.options.length > 0);
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `cd client && npx jest src/utils/custom-fields.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add the attributes to the client model**

In `client/src/models/CustomField.js`:
- After `showOnFrontOfCard: attr(),` add `type: attr(),` and `options: attr(),`.
- In `duplicate(id, data)`, after `showOnFrontOfCard: this.showOnFrontOfCard,` add:

```js
      type: this.type,
      options: this.options,
```

- [ ] **Step 6: Create the shared editor**

Create `client/src/components/custom-fields/CustomFieldEditor/OptionsEditor.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';
import { Input } from '../../../lib/custom-ui';

import styles from './CustomFieldEditor.module.scss';

// The options a dropdown offers, in the order it offers them
const OptionsEditor = React.memo(({ value, onChange }) => {
  const [t] = useTranslation();

  const updateOption = (index, option) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? option : item)));
  };

  const removeOption = (index) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const moveOption = (index, offset) => {
    const nextValue = [...value];
    const [option] = nextValue.splice(index, 1);

    nextValue.splice(index + offset, 0, option);
    onChange(nextValue);
  };

  const handleAddClick = useCallback(() => {
    onChange([...value, '']);
  }, [value, onChange]);

  return (
    <div className={styles.field}>
      {value.length === 0 && <div className={styles.hint}>{t('common.addAtLeastOneOption')}</div>}
      {value.map((option, index) => (
        // Options are edited in place, so their position is all that identifies them
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className={styles.option}>
          <Input
            fluid
            value={option}
            maxLength={128}
            className={styles.optionField}
            onChange={(_, { value: nextOption }) => updateOption(index, nextOption)}
          />
          <Button
            type="button"
            icon="arrow up"
            disabled={index === 0}
            className={styles.optionButton}
            onClick={() => moveOption(index, -1)}
          />
          <Button
            type="button"
            icon="arrow down"
            disabled={index === value.length - 1}
            className={styles.optionButton}
            onClick={() => moveOption(index, 1)}
          />
          <Button
            type="button"
            icon="trash alternate outline"
            className={styles.optionButton}
            onClick={() => removeOption(index)}
          />
        </div>
      ))}
      <Button type="button" content={t('action.addOption')} onClick={handleAddClick} />
    </div>
  );
});

OptionsEditor.propTypes = {
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default OptionsEditor;
```

Create `client/src/components/custom-fields/CustomFieldEditor/CustomFieldEditor.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Dropdown, Radio } from 'semantic-ui-react';
import { Input } from '../../../lib/custom-ui';

import { useNestedRef } from '../../../hooks';
import { CustomFieldTypes } from '../../../constants/Enums';
import OptionsEditor from './OptionsEditor';

import styles from './CustomFieldEditor.module.scss';

// Shared by the board/card group and base group popups, which used to carry identical copies
const CustomFieldEditor = React.forwardRef(({ data, onFieldChange }, ref) => {
  const [t] = useTranslation();

  const [nameFieldRef, handleNameFieldRef] = useNestedRef('inputRef');

  const selectNameField = useCallback(() => {
    nameFieldRef.current.select();
  }, [nameFieldRef]);

  useImperativeHandle(
    ref,
    () => ({
      selectNameField,
    }),
    [selectNameField],
  );

  const handleOptionsChange = useCallback(
    (options) => {
      onFieldChange(null, {
        name: 'options',
        value: options,
      });
    },
    [onFieldChange],
  );

  useEffect(() => {
    nameFieldRef.current.focus();
  }, [nameFieldRef]);

  return (
    <>
      <div className={styles.text}>{t('common.title')}</div>
      <Input
        fluid
        ref={handleNameFieldRef}
        name="name"
        value={data.name}
        maxLength={128}
        className={styles.fieldName}
        onChange={onFieldChange}
      />
      <div className={styles.text}>{t('common.type')}</div>
      <Dropdown
        fluid
        selection
        name="type"
        options={[
          {
            text: t('common.text'),
            value: CustomFieldTypes.TEXT,
          },
          {
            text: t('common.dropdown'),
            value: CustomFieldTypes.DROPDOWN,
          },
        ]}
        value={data.type}
        className={styles.field}
        onChange={onFieldChange}
      />
      {data.type === CustomFieldTypes.DROPDOWN && (
        <>
          <div className={styles.text}>{t('common.options')}</div>
          <OptionsEditor value={data.options} onChange={handleOptionsChange} />
        </>
      )}
      <Radio
        toggle
        name="showOnFrontOfCard"
        checked={data.showOnFrontOfCard}
        label={t('common.showOnFrontOfCard')}
        className={classNames(styles.field, styles.fieldRadio)}
        onChange={onFieldChange}
      />
    </>
  );
});

CustomFieldEditor.propTypes = {
  data: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  onFieldChange: PropTypes.func.isRequired,
};

export default React.memo(CustomFieldEditor);
```

Create `client/src/components/custom-fields/CustomFieldEditor/CustomFieldEditor.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .field {
    margin-bottom: 8px;
  }

  .fieldName {
    margin-bottom: 16px;
  }

  .fieldRadio {
    width: 100%;
  }

  .hint {
    color: #6b808c;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .option {
    align-items: center;
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
  }

  .optionButton {
    flex: 0 0 auto;
    margin: 0;
    padding: 8px;
  }

  .optionField {
    flex: 1;
    min-width: 0;
  }

  .text {
    color: #444444;
    font-size: 12px;
    font-weight: bold;
    padding-bottom: 6px;
  }
}
```

Create `client/src/components/custom-fields/CustomFieldEditor/index.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import CustomFieldEditor from './CustomFieldEditor';

export default CustomFieldEditor;
```

- [ ] **Step 7: Point both add steps at the shared editor**

Make these changes in **both** `CustomFieldAddStep.jsx` files (`custom-field-groups/CustomFieldGroupStep/` and `base-custom-field-groups/BaseCustomFieldGroupStep/`):

1. Replace `import CustomFieldEditor from './CustomFieldEditor';` with:

```js
import { buildCustomFieldData, isCustomFieldDataComplete } from '../../../utils/custom-fields';
import { CustomFieldTypes } from '../../../constants/Enums';
import CustomFieldEditor from '../../custom-fields/CustomFieldEditor';
```

2. In the `useForm` initializer, after `showOnFrontOfCard: false,` add:

```js
    type: CustomFieldTypes.TEXT,
    options: [],
```

3. Replace the body of `handleSubmit` up to (not including) the `dispatch(...)` line with:

```js
    const cleanData = buildCustomFieldData(data);

    if (!isCustomFieldDataComplete(cleanData)) {
      if (!cleanData.name) {
        customFieldEditorRef.current.selectNameField();
      }

      return;
    }
```

Leave the existing `dispatch(...)`, `onBack()` and dependency list unchanged.

- [ ] **Step 8: Point both edit steps at the shared editor**

Make these changes in **both** `CustomFieldEditStep.jsx` files:

1. Replace `import CustomFieldEditor from './CustomFieldEditor';` with the same three imports as Step 7.1.

2. Replace the `defaultData` memo with:

```js
  const defaultData = useMemo(
    () => ({
      name: customField.name,
      showOnFrontOfCard: customField.showOnFrontOfCard,
      type: customField.type || CustomFieldTypes.TEXT,
      options: customField.options || [],
    }),
    [customField.name, customField.showOnFrontOfCard, customField.type, customField.options],
  );
```

3. In the `useForm` initializer, after `showOnFrontOfCard: false,` add `type: CustomFieldTypes.TEXT,` and `options: [],`.

4. Replace `handleSubmit` with:

```js
  const handleSubmit = useCallback(() => {
    const cleanData = buildCustomFieldData(data);

    if (!isCustomFieldDataComplete(cleanData)) {
      if (!cleanData.name) {
        customFieldEditorRef.current.selectNameField();
      }

      return;
    }

    if (!dequal(cleanData, buildCustomFieldData(defaultData))) {
      dispatch(entryActions.updateCustomField(id, cleanData));
    }

    onBack();
  }, [id, onBack, dispatch, defaultData, data]);
```

- [ ] **Step 9: Delete the duplicate editors**

```bash
git rm client/src/components/custom-field-groups/CustomFieldGroupStep/CustomFieldEditor.jsx client/src/components/custom-field-groups/CustomFieldGroupStep/CustomFieldEditor.module.scss client/src/components/base-custom-field-groups/BaseCustomFieldGroupStep/CustomFieldEditor.jsx client/src/components/base-custom-field-groups/BaseCustomFieldGroupStep/CustomFieldEditor.module.scss
```

- [ ] **Step 10: Add the strings**

In `client/src/locales/en-US/core.js`, add each line where it sorts alphabetically.

Add to `common`:

```js
      addAtLeastOneOption: 'Add at least one option',
      dropdown: 'Dropdown',
      options: 'Options',
      text: 'Text',
      type: 'Type',
```

Add to `action`:

```js
      addOption: 'Add option',
```

- [ ] **Step 11: Light checks**

Run:

```bash
cd client && npx jest src/utils/custom-fields.test.js && npx eslint src/utils/custom-fields.js src/utils/custom-fields.test.js src/constants/Enums.js src/models/CustomField.js src/components/custom-fields/CustomFieldEditor src/components/custom-field-groups/CustomFieldGroupStep src/components/base-custom-field-groups/BaseCustomFieldGroupStep src/locales/en-US/core.js && grep -rn "from './CustomFieldEditor'" src/components | grep -v custom-fields/CustomFieldEditor
```

Expected: jest passes, eslint prints nothing, and the final grep prints nothing (no imports of the deleted copies remain).

- [ ] **Step 12: Commit**

```bash
git add -A client/src/utils/custom-fields.js client/src/utils/custom-fields.test.js client/src/constants/Enums.js client/src/models/CustomField.js client/src/components/custom-fields/CustomFieldEditor client/src/components/custom-field-groups/CustomFieldGroupStep client/src/components/base-custom-field-groups/BaseCustomFieldGroupStep client/src/locales/en-US/core.js
git commit -m "hippo: dropdown type and options editor for custom fields" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hippo foundation on the client

**Files:**
- Create: `client/src/utils/hippo.js`
- Test: `client/src/utils/hippo.test.js`
- Create: `client/src/api/hippo.js`
- Create: `client/src/selectors/hippo.js`
- Modify: `client/src/api/index.js`, `client/src/selectors/index.js`, `client/src/models/Project.js`, `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes:
  - `CustomFieldTypes` (Task 6)
  - the server routes from Tasks 4 and 5
  - `selectPath` (`./router`), `selectCurrentUserMembershipForCurrentBoard` (`./boards`), `buildCustomFieldValueId`, `isLocalId`
- Produces, from `utils/hippo.js`:
  - constants `HIPPO_GROUP_NAME`, `HippoFieldNames`, `TICKET_CHIP_FIELD_NAMES`, `DEFAULT_TICKET_STATES`, `HIPPO_FIELD_DEFINITIONS`
  - `parseTicketNumber(input)` → `string | null`
  - `isTicketUrl(input)`
  - `toTicketUrlPattern(url, n)` → `string | null`
  - `buildTicketUrl(pattern, n)` → `string | null`
  - `toSafeHttpUrl(value)` → `string | null`
  - `buildTicketStateOptions(existingOptions, statusText)`
  - `getMatchedUserIds(ticket)`, `getUnmatchedAssigneeNames(ticket)`
  - `buildCardDescription(ticket)`
  - `applyTicketToCardData(data, ticket, prevTicket)`
  - `buildImportedCommentText(entry, dateText)`
  - `buildHippoImport({ ticket, ticketUrl, ticketState, selectedEntryIds }, formatDate)` → `{ ticketState, values: [{ name, content }], commentTexts }`
  - `getFirstLine(markdown)`
  - `getHippoErrorText(error, t)`
- Produces, from `api`: `getHippoTicket(boardId, n, headers)`, `syncHippoNote(cardId, { commentId }, headers)`, `syncHippoStatus(cardId, headers)`, `updateHippoConfig(projectId, { appSecretKey }, headers)`, `deleteHippoConfig(projectId, headers)`, `verifyHippoConfig(projectId, headers)`.
- Produces, from `selectors`:
  - `getHippoTicketForCardModel(cardModel, CustomFieldValue)` → `{ number, url, customFieldGroupId, stateCustomFieldId, urlCustomFieldId } | null`
  - `makeSelectHippoTicketByCardId()`, `selectHippoTicketByCardId`, `selectHippoTicketForCurrentCard`
  - `selectHippoFieldGroupByBoardId(state, boardId)` → `{ id, customFields: ref[] } | null`
  - `selectIsHippoConfiguredForCurrentProject`, `selectCanSyncToHippoInCurrentBoard`
- Produces: the Project model attribute `isHippoConfigured`.

- [ ] **Step 1: Write the failing test**

Create `client/src/utils/hippo.test.js`:

```js
import {
  DEFAULT_TICKET_STATES,
  HippoFieldNames,
  applyTicketToCardData,
  buildCardDescription,
  buildHippoImport,
  buildImportedCommentText,
  buildTicketStateOptions,
  buildTicketUrl,
  getFirstLine,
  getHippoErrorText,
  getUnmatchedAssigneeNames,
  isTicketUrl,
  parseTicketNumber,
  toSafeHttpUrl,
  toTicketUrlPattern,
} from './hippo';

const TICKET = {
  number: '43886',
  subject: 'Android APK not functional',
  descriptionMarkdown: 'Cannot pass the OTP screen',
  statusText: 'Pending from Dev',
  priority: 'Normal',
  dueDate: '2026-10-05T18:30:00.000Z',
  assignees: [
    { name: 'Sarabjot Kaur', userId: '11' },
    { name: 'Marketing', userId: null },
  ],
  entries: [
    {
      id: 'c1',
      kind: 'comment',
      authorName: 'Harsh Sharma',
      date: '2026-09-29T21:38:47.000Z',
      markdown: 'Hi Client,\n\nThank you for reaching out.',
    },
    {
      id: 'n1',
      kind: 'note',
      authorName: 'Harsh Sharma',
      date: '2026-10-01T06:04:16.000Z',
      markdown: '@Deepak kumar Kindly look into this',
    },
  ],
};

describe('parseTicketNumber', () => {
  it('accepts a bare or hashed number', () => {
    expect(parseTicketNumber('43886')).toBe('43886');
    expect(parseTicketNumber(' #43886 ')).toBe('43886');
  });

  it('takes the last number in the path or hash route of a link', () => {
    expect(parseTicketNumber('https://hippochat.io/en/tickets/43886')).toBe('43886');

    expect(
      parseTicketNumber('https://app2.hippochat.io:8443/#/ticket/43886?tab=notes&page=2'),
    ).toBe('43886');
  });

  it('refuses anything else', () => {
    expect(parseTicketNumber('')).toBeNull();
    expect(parseTicketNumber('ticket')).toBeNull();
    expect(parseTicketNumber('https://hippochat.io/en/tickets')).toBeNull();
    expect(parseTicketNumber('1234567890123')).toBeNull();
    expect(parseTicketNumber(null)).toBeNull();
  });
});

describe('ticket URL patterns', () => {
  it('turns a ticket link into a pattern other numbers fit into', () => {
    const pattern = toTicketUrlPattern(
      'https://app2.hippochat.io:8443/#/ticket/43886?tab=notes',
      '43886',
    );

    expect(pattern).toBe('https://app2.hippochat.io:8443/#/ticket/{ticketNumber}');
    expect(buildTicketUrl(pattern, '43934')).toBe('https://app2.hippochat.io:8443/#/ticket/43934');
  });

  it('has no pattern for a link without the number, and no link without a pattern', () => {
    expect(toTicketUrlPattern('https://hippochat.io/en/tickets', '43886')).toBeNull();
    expect(buildTicketUrl(null, '43886')).toBeNull();
  });

  it('tells links from numbers', () => {
    expect(isTicketUrl(' https://hippochat.io/x/1')).toBe(true);
    expect(isTicketUrl('#43886')).toBe(false);
  });
});

describe('toSafeHttpUrl', () => {
  it('keeps web links', () => {
    expect(toSafeHttpUrl('https://hippochat.io/t/1')).toBe('https://hippochat.io/t/1');
    expect(toSafeHttpUrl(' http://hippochat.io/t/1 ')).toBe('http://hippochat.io/t/1');
  });

  it('never lets other schemes or loose text through', () => {
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeHttpUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(toSafeHttpUrl('www.hippochat.io/t/1')).toBeNull();
    expect(toSafeHttpUrl(null)).toBeNull();
  });
});

describe('buildTicketStateOptions', () => {
  it('starts from the default states', () => {
    expect(buildTicketStateOptions(null, 'Closed')).toEqual(DEFAULT_TICKET_STATES);
  });

  it('prefers the board options and adds a state they lack', () => {
    expect(buildTicketStateOptions(['Open', 'Done'], 'Pending from Dev')).toEqual([
      'Open',
      'Done',
      'Pending from Dev',
    ]);
  });
});

describe('applyTicketToCardData', () => {
  const data = { name: '', description: null, dueDate: null, userIds: ['5'], labelIds: [] };

  it('fills the dialog in from the ticket', () => {
    expect(applyTicketToCardData(data, TICKET, null)).toEqual({
      name: 'Android APK not functional',
      description: 'Cannot pass the OTP screen\n\n— Imported from Hippo ticket #43886',
      dueDate: new Date('2026-10-05T18:30:00.000Z'),
      userIds: ['5', '11'],
      labelIds: [],
    });
  });

  it('lets go of the members a previous ticket brought, keeping those picked by hand', () => {
    const nextTicket = {
      ...TICKET,
      number: '43934',
      assignees: [{ name: 'Deepak', userId: '12' }],
    };

    const prefilledData = applyTicketToCardData(data, TICKET, null);

    expect(applyTicketToCardData(prefilledData, nextTicket, TICKET).userIds).toEqual(['5', '12']);
  });
});

describe('buildCardDescription', () => {
  it('ends with where the card came from', () => {
    expect(buildCardDescription({ ...TICKET, descriptionMarkdown: '' })).toBe(
      '— Imported from Hippo ticket #43886',
    );
  });
});

describe('imported comments', () => {
  it('heads each entry with its kind, author and date', () => {
    expect(buildImportedCommentText(TICKET.entries[1], 'October 1, 2026 at 11:34 AM')).toBe(
      '**[Hippo Note] Harsh Sharma · October 1, 2026 at 11:34 AM**\n\n@Deepak kumar Kindly look into this',
    );
  });

  it('builds what the create saga needs, keeping only the chosen entries', () => {
    expect(
      buildHippoImport(
        { ticket: TICKET, ticketUrl: null, ticketState: 'Closed', selectedEntryIds: ['n1'] },
        () => 'DATE',
      ),
    ).toEqual({
      ticketState: 'Closed',
      values: [
        { name: HippoFieldNames.TICKET_NUMBER, content: '43886' },
        { name: HippoFieldNames.TICKET_STATE, content: 'Closed' },
        { name: HippoFieldNames.PRIORITY, content: 'Normal' },
      ],
      commentTexts: ['**[Hippo Note] Harsh Sharma · DATE**\n\n@Deepak kumar Kindly look into this'],
    });
  });
});

describe('preview helpers', () => {
  it('lists assignees who are not on the board', () => {
    expect(getUnmatchedAssigneeNames(TICKET)).toEqual(['Marketing']);
  });

  it('shows the first line with text', () => {
    expect(getFirstLine('\n\nHi Client,\n\nThanks')).toBe('Hi Client,');
    expect(getFirstLine('')).toBe('');
  });
});

describe('getHippoErrorText', () => {
  const t = (key) => `t:${key}`;

  it('translates the errors Planka raises', () => {
    expect(getHippoErrorText({ message: 'Hippo ticket not found' }, t)).toBe(
      't:common.hippoTicketNotFound',
    );
  });

  it('shows Hippo refusals as worded, and falls back otherwise', () => {
    expect(getHippoErrorText({ message: 'Ticket is closed' }, t)).toBe('Ticket is closed');
    expect(getHippoErrorText({}, t)).toBe('t:common.somethingWentWrong');
  });
});
```

- [ ] **Step 2: Run the test and check that it fails**

Run: `cd client && npx jest src/utils/hippo.test.js`
Expected: FAIL with `Cannot find module './hippo'`.

- [ ] **Step 3: Implement `client/src/utils/hippo.js`**

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { CustomFieldTypes } from '../constants/Enums';

// The server reads these same names (server/utils/hippo.js); the two must stay in step
export const HIPPO_GROUP_NAME = 'Hippo Ticket';

export const HippoFieldNames = {
  TICKET_NUMBER: 'Ticket #',
  TICKET_STATE: 'Ticket State',
  PRIORITY: 'Priority',
  TICKET_URL: 'Ticket URL',
};

// The ticket chip on the card front stands in for these
export const TICKET_CHIP_FIELD_NAMES = [HippoFieldNames.TICKET_NUMBER, HippoFieldNames.TICKET_URL];

export const DEFAULT_TICKET_STATES = ['New', 'Pending from Dev', 'Pending from CSM', 'Closed'];

// What a board's "Hippo Ticket" group holds, in order
export const HIPPO_FIELD_DEFINITIONS = [
  {
    name: HippoFieldNames.TICKET_NUMBER,
    type: CustomFieldTypes.TEXT,
    showOnFrontOfCard: false,
  },
  {
    name: HippoFieldNames.TICKET_STATE,
    type: CustomFieldTypes.DROPDOWN,
    showOnFrontOfCard: true,
  },
  {
    name: HippoFieldNames.PRIORITY,
    type: CustomFieldTypes.TEXT,
    showOnFrontOfCard: false,
  },
  {
    name: HippoFieldNames.TICKET_URL,
    type: CustomFieldTypes.TEXT,
    showOnFrontOfCard: false,
  },
];

const TICKET_NUMBER_REGEX = /^#?(\d{1,12})$/;
const URL_REGEX = /^https?:\/\//i;
const TICKET_NUMBER_PLACEHOLDER = '{ticketNumber}';
const MAX_TICKET_NUMBER_LENGTH = 12;

const ENTRY_LABEL_BY_KIND = {
  note: 'Hippo Note',
  comment: 'Hippo Comment',
};

const ERROR_KEY_BY_MESSAGE = {
  'Hippo not configured': 'common.hippoNotConfigured',
  'Hippo key invalid': 'common.hippoKeyInvalid',
  'Hippo ticket not found': 'common.hippoTicketNotFound',
  'Hippo unavailable': 'common.hippoUnavailable',
  'Not a ticket card': 'common.notAHippoTicketCard',
};

const parseUrl = (value) => {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
};

// A link's origin, path and hash route, without query strings
const getUrlBase = (url) => `${url.origin}${url.pathname}${url.hash.split('?')[0]}`;

export const isTicketUrl = (input) => URL_REGEX.test((input || '').trim());

// Accepts "43886", "#43886", or a link whose path or hash route ends in the number
export const parseTicketNumber = (input) => {
  const value = (input || '').trim();
  const match = value.match(TICKET_NUMBER_REGEX);

  if (match) {
    return match[1];
  }

  if (!isTicketUrl(value)) {
    return null;
  }

  const url = parseUrl(value);

  if (!url) {
    return null;
  }

  const digitRuns = `${url.pathname}${url.hash.split('?')[0]}`.match(/\d+/g);

  if (!digitRuns) {
    return null;
  }

  const ticketNumber = digitRuns[digitRuns.length - 1];
  return ticketNumber.length <= MAX_TICKET_NUMBER_LENGTH ? ticketNumber : null;
};

// "https://x/#/ticket/43886?tab=notes" for 43886 → "https://x/#/ticket/{ticketNumber}"
export const toTicketUrlPattern = (value, ticketNumber) => {
  const url = parseUrl(value);

  if (!url) {
    return null;
  }

  const base = getUrlBase(url);
  const index = base.lastIndexOf(ticketNumber);

  if (index === -1) {
    return null;
  }

  return `${base.slice(0, index)}${TICKET_NUMBER_PLACEHOLDER}${base.slice(index + ticketNumber.length)}`;
};

export const buildTicketUrl = (pattern, ticketNumber) =>
  pattern ? pattern.replace(TICKET_NUMBER_PLACEHOLDER, ticketNumber) : null;

// Only web links may become clickable: the field is free text, and a javascript: link never may
export const toSafeHttpUrl = (value) => {
  if (!value) {
    return null;
  }

  const url = parseUrl(value);
  return url && (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : null;
};

// The board's own options when it has some, plus the ticket's state when they lack it
export const buildTicketStateOptions = (existingOptions, statusText) => {
  const options =
    existingOptions && existingOptions.length > 0 ? existingOptions : DEFAULT_TICKET_STATES;

  return statusText && !options.includes(statusText) ? [...options, statusText] : options;
};

export const getMatchedUserIds = (ticket) =>
  ticket ? ticket.assignees.flatMap((assignee) => (assignee.userId ? [assignee.userId] : [])) : [];

export const getUnmatchedAssigneeNames = (ticket) =>
  ticket.assignees.flatMap((assignee) => (assignee.userId ? [] : [assignee.name]));

export const buildCardDescription = (ticket) => {
  const footer = `— Imported from Hippo ticket #${ticket.number}`;
  return ticket.descriptionMarkdown ? `${ticket.descriptionMarkdown}\n\n${footer}` : footer;
};

// A fetched ticket fills the dialog in; members a ticket fetched before it brought are let go
export const applyTicketToCardData = (data, ticket, prevTicket) => {
  const prevUserIds = getMatchedUserIds(prevTicket);
  const keptUserIds = data.userIds.filter((userId) => !prevUserIds.includes(userId));

  const ticketUserIds = getMatchedUserIds(ticket).filter(
    (userId) => !keptUserIds.includes(userId),
  );

  return {
    ...data,
    name: ticket.subject || data.name,
    description: buildCardDescription(ticket),
    dueDate: ticket.dueDate ? new Date(ticket.dueDate) : data.dueDate,
    userIds: [...keptUserIds, ...ticketUserIds],
  };
};

// "**[Hippo Note] Harsh Sharma · October 1, 2026 at 11:34 AM**" over the entry itself
export const buildImportedCommentText = (entry, dateText) => {
  const byline = [entry.authorName, dateText].filter(Boolean).join(' · ');
  const header = `**[${ENTRY_LABEL_BY_KIND[entry.kind]}]${byline ? ` ${byline}` : ''}**`;

  return entry.markdown ? `${header}\n\n${entry.markdown}` : header;
};

// What the create saga needs to link the new card to its ticket
export const buildHippoImport = ({ ticket, ticketUrl, ticketState, selectedEntryIds }, formatDate) => ({
  ticketState: ticketState || null,
  values: [
    {
      name: HippoFieldNames.TICKET_NUMBER,
      content: ticket.number,
    },
    {
      name: HippoFieldNames.TICKET_STATE,
      content: ticketState,
    },
    {
      name: HippoFieldNames.PRIORITY,
      content: ticket.priority,
    },
    {
      name: HippoFieldNames.TICKET_URL,
      content: ticketUrl,
    },
  ].filter(({ content }) => !!content),
  commentTexts: ticket.entries
    .filter((entry) => selectedEntryIds.includes(entry.id))
    .map((entry) =>
      buildImportedCommentText(entry, entry.date ? formatDate(new Date(entry.date)) : null),
    ),
});

export const getFirstLine = (markdown) =>
  (markdown || '').split('\n').find((line) => line.trim()) || '';

// Planka's own Hippo errors are translated; Hippo's refusals are shown as Hippo words them
export const getHippoErrorText = (error, t) => {
  const key = error && ERROR_KEY_BY_MESSAGE[error.message];

  if (key) {
    return t(key);
  }

  return (error && error.message) || t('common.somethingWentWrong');
};
```

- [ ] **Step 4: Run the test and check that it passes**

Run: `cd client && npx jest src/utils/hippo.test.js`
Expected: PASS, 19 tests.

- [ ] **Step 5: Add the API module**

Create `client/src/api/hippo.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import socket from './socket';

/* Actions */

const getHippoTicket = (boardId, ticketNumber, headers) =>
  socket.get(`/boards/${boardId}/hippo-tickets/${ticketNumber}`, undefined, headers);

const syncHippoNote = (cardId, data, headers) =>
  socket.post(`/cards/${cardId}/hippo-sync/note`, data, headers);

const syncHippoStatus = (cardId, headers) =>
  socket.post(`/cards/${cardId}/hippo-sync/status`, undefined, headers);

const updateHippoConfig = (projectId, data, headers) =>
  socket.put(`/projects/${projectId}/hippo-config`, data, headers);

const deleteHippoConfig = (projectId, headers) =>
  socket.delete(`/projects/${projectId}/hippo-config`, undefined, headers);

const verifyHippoConfig = (projectId, headers) =>
  socket.post(`/projects/${projectId}/hippo-config/verify`, undefined, headers);

export default {
  getHippoTicket,
  syncHippoNote,
  syncHippoStatus,
  updateHippoConfig,
  deleteHippoConfig,
  verifyHippoConfig,
};
```

In `client/src/api/index.js`:
- After `import notificationServices from './notification-services';` add `import hippo from './hippo';`.
- After `...notificationServices,` add `...hippo,`.

- [ ] **Step 6: Add the selectors**

Create `client/src/selectors/hippo.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import keyBy from 'lodash/keyBy';
import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectPath } from './router';
import { selectCurrentUserMembershipForCurrentBoard } from './boards';
import { buildCustomFieldValueId } from '../models/CustomFieldValue';
import { isLocalId } from '../utils/local-id';
import { HIPPO_GROUP_NAME, HippoFieldNames } from '../utils/hippo';
import { BoardMembershipRoles } from '../constants/Enums';

const getContent = (CustomFieldValue, cardId, customFieldGroupId, customFieldModel) => {
  if (!customFieldModel) {
    return null;
  }

  const customFieldValueModel = CustomFieldValue.withId(
    buildCustomFieldValueId({
      cardId,
      customFieldGroupId,
      customFieldId: customFieldModel.id,
    }),
  );

  return customFieldValueModel ? customFieldValueModel.content : null;
};

/**
 * The Hippo ticket a card is linked to, or null. The board's "Hippo Ticket" group comes first; a
 * card moved from another board carries its own copy of that group.
 */
export const getHippoTicketForCardModel = (cardModel, CustomFieldValue) => {
  const customFieldGroupModels = [
    ...(cardModel.board ? cardModel.board.getCustomFieldGroupsQuerySet().toModelArray() : []),
    ...cardModel.getCustomFieldGroupsQuerySet().toModelArray(),
  ].filter((customFieldGroupModel) => customFieldGroupModel.name === HIPPO_GROUP_NAME);

  for (let i = 0; i < customFieldGroupModels.length; i += 1) {
    const customFieldGroupModel = customFieldGroupModels[i];

    const customFieldModelByName = keyBy(
      customFieldGroupModel.getCustomFieldsModelArray(),
      'name',
    );

    const number = getContent(
      CustomFieldValue,
      cardModel.id,
      customFieldGroupModel.id,
      customFieldModelByName[HippoFieldNames.TICKET_NUMBER],
    );

    if (number) {
      const stateCustomFieldModel = customFieldModelByName[HippoFieldNames.TICKET_STATE];
      const urlCustomFieldModel = customFieldModelByName[HippoFieldNames.TICKET_URL];

      return {
        number,
        url: getContent(
          CustomFieldValue,
          cardModel.id,
          customFieldGroupModel.id,
          urlCustomFieldModel,
        ),
        customFieldGroupId: customFieldGroupModel.id,
        stateCustomFieldId: stateCustomFieldModel ? stateCustomFieldModel.id : null,
        urlCustomFieldId: urlCustomFieldModel ? urlCustomFieldModel.id : null,
      };
    }
  }

  return null;
};

export const makeSelectHippoTicketByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card, CustomFieldValue }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return null;
      }

      return getHippoTicketForCardModel(cardModel, CustomFieldValue);
    },
  );

export const selectHippoTicketByCardId = makeSelectHippoTicketByCardId();

export const selectHippoTicketForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card, CustomFieldValue }, id) => {
    if (!id) {
      return null;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return null;
    }

    return getHippoTicketForCardModel(cardModel, CustomFieldValue);
  },
);

// The board's own "Hippo Ticket" group, as the import fills it, with its saved fields
export const selectHippoFieldGroupByBoardId = createSelector(
  orm,
  (_, id) => id,
  ({ Board }, id) => {
    const boardModel = Board.withId(id);

    if (!boardModel) {
      return null;
    }

    const customFieldGroupModel = boardModel
      .getCustomFieldGroupsQuerySet()
      .toModelArray()
      .find(
        (model) =>
          model.name === HIPPO_GROUP_NAME && !model.baseCustomFieldGroupId && !isLocalId(model.id),
      );

    if (!customFieldGroupModel) {
      return null;
    }

    return {
      id: customFieldGroupModel.id,
      customFields: customFieldGroupModel
        .getCustomFieldsQuerySet()
        .toRefArray()
        .filter((customField) => !isLocalId(customField.id)),
    };
  },
);

export const selectIsHippoConfiguredForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  ({ Project }, id) => {
    if (!id) {
      return false;
    }

    const projectModel = Project.withId(id);
    return !!projectModel && !!projectModel.isHippoConfigured;
  },
);

// Only editors may push to Hippo, and only once the project has a key
export const selectCanSyncToHippoInCurrentBoard = (state) => {
  if (!selectIsHippoConfiguredForCurrentProject(state)) {
    return false;
  }

  const boardMembership = selectCurrentUserMembershipForCurrentBoard(state);
  return !!boardMembership && boardMembership.role === BoardMembershipRoles.EDITOR;
};

export default {
  makeSelectHippoTicketByCardId,
  selectHippoTicketByCardId,
  selectHippoTicketForCurrentCard,
  selectHippoFieldGroupByBoardId,
  selectIsHippoConfiguredForCurrentProject,
  selectCanSyncToHippoInCurrentBoard,
};
```

In `client/src/selectors/index.js`:
- After `import notificationServices from './notification-services';` add `import hippo from './hippo';`.
- After `...notificationServices,` add `...hippo,`.

- [ ] **Step 7: Add the attribute to the client Project model**

In `client/src/models/Project.js`, add this after `isHidden: attr(),`:

```js
    isHippoConfigured: attr({
      getDefault: () => false,
    }),
```

- [ ] **Step 8: Add the error strings**

Add these to `common` in `client/src/locales/en-US/core.js`, each where it sorts alphabetically:

```js
      hippoKeyInvalid: 'The Hippo key is invalid. Ask a project manager to update it.',
      hippoNotConfigured: 'Hippo is not set up for this project',
      hippoTicketNotFound: 'Hippo ticket not found',
      hippoUnavailable: 'Hippo is unavailable. Try again.',
      notAHippoTicketCard: 'This card is not linked to a Hippo ticket',
```

- [ ] **Step 9: Light checks**

Run:

```bash
cd client && npx jest src/utils/hippo.test.js && npx eslint src/utils/hippo.js src/utils/hippo.test.js src/api/hippo.js src/api/index.js src/selectors/hippo.js src/selectors/index.js src/models/Project.js src/locales/en-US/core.js
```

Expected: jest passes and eslint prints nothing.

- [ ] **Step 10: Commit**

```bash
git add client/src/utils/hippo.js client/src/utils/hippo.test.js client/src/api client/src/selectors/hippo.js client/src/selectors/index.js client/src/models/Project.js client/src/locales/en-US/core.js
git commit -m "hippo: client utils, API module and ticket selectors" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dropdown values and the ticket link in the card modal

**Files:**
- Create in `client/src/components/hippo/TicketChip/`: `TicketChip.jsx`, `TicketChip.module.scss`, `index.js`
- Create in `client/src/components/custom-fields/CustomField/`: `DropdownValueField.jsx`, `DropdownValueField.module.scss`
- Modify in the same folder: `CustomField.jsx`, `ValueField.jsx`, `CustomField.module.scss`
- Modify: `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes: `toSafeHttpUrl` and `selectHippoTicketForCurrentCard` (Task 7), `CustomFieldTypes` (Task 6).
- Produces:
  - `<TicketChip number url? className? />`: a link to the URL only when `toSafeHttpUrl` accepts it; clicks do not bubble.
  - `<DropdownValueField defaultValue options onUpdate disabled? />`
  - `ValueField` gains `onClose?`, called after every blur.
  - `CustomField.jsx` gains a `saveValue(content)` helper. Task 12 extends it.

- [ ] **Step 0: Impact check.** Run `gitnexus_impact` (upstream) on `ValueField` and `CustomField` in `client/src/components/custom-fields/CustomField/`. Both are used only by `CustomFieldGroup.jsx`, so LOW is expected.

- [ ] **Step 1: Create the TicketChip**

Create `client/src/components/hippo/TicketChip/TicketChip.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { toSafeHttpUrl } from '../../../utils/hippo';

import styles from './TicketChip.module.scss';

// "#43886", linking to the ticket when its address is a web link. Following the link must not
// also open the card the chip sits on.
const TicketChip = React.memo(({ number, url, className }) => {
  const safeUrl = toSafeHttpUrl(url);

  const handleLinkClick = useCallback((event) => {
    event.stopPropagation();
  }, []);

  if (safeUrl) {
    return (
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={classNames(styles.wrapper, styles.wrapperLink, className)}
        onClick={handleLinkClick}
      >
        #{number}
      </a>
    );
  }

  return <span className={classNames(styles.wrapper, className)}>#{number}</span>;
});

TicketChip.propTypes = {
  number: PropTypes.string.isRequired,
  url: PropTypes.string,
  className: PropTypes.string,
};

TicketChip.defaultProps = {
  url: undefined,
  className: undefined,
};

export default TicketChip;
```

Create `client/src/components/hippo/TicketChip/TicketChip.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .wrapper {
    background: #dfe3e6;
    border-radius: 3px;
    color: #17394d;
    display: inline-block;
    font-size: 12px;
    font-weight: bold;
    line-height: 18px;
    padding: 0 6px;
    white-space: nowrap;
  }

  .wrapperLink {
    text-decoration: none;

    &:hover {
      background: #c3cbd0;
      color: #17394d;
      text-decoration: underline;
    }
  }
}
```

Create `client/src/components/hippo/TicketChip/index.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import TicketChip from './TicketChip';

export default TicketChip;
```

- [ ] **Step 2: Create the DropdownValueField**

Create `client/src/components/custom-fields/CustomField/DropdownValueField.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Dropdown } from 'semantic-ui-react';

import styles from './DropdownValueField.module.scss';

// A value whose option was removed from the field stays until someone picks another
const DropdownValueField = React.memo(({ defaultValue, options, onUpdate, ...props }) => {
  const [t] = useTranslation();

  const dropdownOptions = useMemo(() => {
    const result = options.map((option) => ({
      key: option,
      text: option,
      value: option,
    }));

    if (defaultValue && !options.includes(defaultValue)) {
      result.push({
        key: defaultValue,
        text: t('common.removedOption', {
          value: defaultValue,
        }),
        value: defaultValue,
      });
    }

    return result;
  }, [defaultValue, options, t]);

  const handleChange = useCallback(
    (_, { value }) => {
      const nextValue = value || null;

      if (nextValue !== (defaultValue || null)) {
        onUpdate(nextValue);
      }
    },
    [defaultValue, onUpdate],
  );

  return (
    <Dropdown
      {...props} // eslint-disable-line react/jsx-props-no-spreading
      fluid
      selection
      clearable
      options={dropdownOptions}
      value={defaultValue || ''}
      placeholder={t('common.selectOption')}
      className={styles.field}
      onChange={handleChange}
    />
  );
});

DropdownValueField.propTypes = {
  defaultValue: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onUpdate: PropTypes.func.isRequired,
};

DropdownValueField.defaultProps = {
  defaultValue: undefined,
};

export default DropdownValueField;
```

Create `client/src/components/custom-fields/CustomField/DropdownValueField.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .field {
    background: rgba(9, 30, 66, 0.04);
    border-color: transparent;
  }
}
```

- [ ] **Step 3: Let ValueField report when editing ends**

In `client/src/components/custom-fields/CustomField/ValueField.jsx`:
- Change the signature to `({ defaultValue, onUpdate, onClose, ...props })`.
- At the end of `handleBlur`, after the `onUpdate` check, add:

```js
    if (onClose) {
      onClose();
    }
```

- Add `onClose` to `handleBlur`'s dependency list.
- Add `onClose: PropTypes.func,` to `propTypes` and `onClose: undefined,` to `defaultProps`.

- [ ] **Step 4: Render dropdowns and the ticket link in CustomField.jsx**

In `client/src/components/custom-fields/CustomField/CustomField.jsx`:

1. Change the imports:
   - `import { BoardMembershipRoles } from '../../../constants/Enums';` becomes `import { BoardMembershipRoles, CustomFieldTypes } from '../../../constants/Enums';`.
   - After `import ValueField from './ValueField';` add:

```js
import DropdownValueField from './DropdownValueField';
import TicketChip from '../../hippo/TicketChip';
```

2. After the `customFieldValue` selector, add:

```js
  const hippoTicket = useSelector(selectors.selectHippoTicketForCurrentCard);
```

3. After `const [isCopied, setIsCopied] = useState(false);` add:

```js
  const [isUrlEditing, setIsUrlEditing] = useState(false);

  const content = customFieldValue ? customFieldValue.content : undefined;

  // The Ticket URL of a ticket card shows as its "#43886" link, editable behind a button
  const isTicketUrlField =
    !!hippoTicket &&
    hippoTicket.customFieldGroupId === customFieldGroupId &&
    hippoTicket.urlCustomFieldId === id;
```

4. Replace `handleValueUpdate` with a `saveValue` helper and a handler that uses it:

```js
  const saveValue = useCallback(
    (nextContent) => {
      if (nextContent) {
        dispatch(
          entryActions.updateCustomFieldValue(cardId, customFieldGroupId, id, {
            content: nextContent,
          }),
        );
      } else {
        dispatch(entryActions.deleteCustomFieldValue(cardId, customFieldGroupId, id));
      }
    },
    [id, customFieldGroupId, cardId, dispatch],
  );

  const handleValueUpdate = useCallback(
    (nextContent) => {
      saveValue(nextContent);
    },
    [saveValue],
  );

  const handleUrlEditClick = useCallback(() => {
    setIsUrlEditing(true);
  }, []);

  const handleUrlEditClose = useCallback(() => {
    setIsUrlEditing(false);
  }, []);
```

5. In `handleCopyClick`, replace `customFieldValue.content` with `content`. In its dependency list, replace `customFieldValue` with `content`.

6. Replace the whole `return (...)` with:

```jsx
  let valueNode;

  if (isTicketUrlField && content && !isUrlEditing) {
    valueNode = (
      <div className={styles.ticketValue}>
        <TicketChip number={hippoTicket.number} url={content} />
        {canEdit && (
          <Button className={styles.editButton} onClick={handleUrlEditClick}>
            <Icon fitted name="pencil" />
          </Button>
        )}
      </div>
    );
  } else if (!canEdit) {
    valueNode = <div className={styles.value}>{content || ' '}</div>;
  } else if (customField.type === CustomFieldTypes.DROPDOWN) {
    valueNode = (
      <DropdownValueField
        defaultValue={content}
        options={customField.options || []}
        disabled={!customField.isPersisted}
        onUpdate={handleValueUpdate}
      />
    );
  } else {
    valueNode = (
      <ValueField
        defaultValue={content}
        autoFocus={isUrlEditing}
        disabled={!customField.isPersisted}
        onUpdate={handleValueUpdate}
        onClose={isUrlEditing ? handleUrlEditClose : undefined}
      />
    );
  }

  return (
    <div>
      <div className={styles.name}>{customField.name}</div>
      <div className={styles.valueWrapper}>
        {valueNode}
        {content && (
          <Button className={styles.copyButton} onClick={handleCopyClick}>
            <Icon fitted name={isCopied ? 'check' : 'copy'} />
          </Button>
        )}
      </div>
    </div>
  );
```

- [ ] **Step 5: Add the styles**

In `client/src/components/custom-fields/CustomField/CustomField.module.scss`, add these two rules inside `:global(#app)`, in alphabetical position:

```scss
  .editButton {
    background: #ebeef0;
    border-radius: 3px;
    box-shadow: none;
    box-sizing: content-box;
    color: #516b7a;
    display: none;
    height: 30px;
    margin: 0;
    min-height: auto;
    outline: none;
    padding: 4px;
    position: absolute;
    right: 32px;
    top: 0;
    width: 20px;

    &:hover {
      background: #dfe3e6;
      color: #4c4c4c;
    }
  }

  .ticketValue {
    background: rgba(9, 30, 66, 0.04);
    border: 1px solid transparent;
    border-radius: 3px;
    line-height: 20px;
    padding: 8px 12px;
  }
```

Then, inside the `.valueWrapper` `&:hover:not(:has(input:focus))` block, next to `.copyButton`, add:

```scss
      .editButton {
        display: block;
      }
```

- [ ] **Step 6: Add the strings**

Add these to `common`, each where it sorts alphabetically:

```js
      removedOption: '{{value}} (removed option)',
      selectOption: 'Select an option',
```

- [ ] **Step 7: Light checks**

Run: `cd client && npx eslint src/components/hippo src/components/custom-fields/CustomField src/locales/en-US/core.js`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/hippo client/src/components/custom-fields/CustomField client/src/locales/en-US/core.js
git commit -m "hippo: dropdown values and ticket link in the card modal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Integrations tab in Project Settings

**Files:**
- Create: `client/src/components/projects/ProjectSettingsModal/IntegrationsPane.jsx`
- Create: `client/src/components/projects/ProjectSettingsModal/IntegrationsPane.module.scss`
- Modify: `client/src/components/projects/ProjectSettingsModal/ProjectSettingsModal.jsx`
- Modify: `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes: `api.updateHippoConfig`, `api.deleteHippoConfig`, `api.verifyHippoConfig`, `getHippoErrorText` (Task 7); `selectors.selectCurrentProject`, `selectors.selectAccessToken`.
- Produces: a managers-only "Integrations" tab. The `isHippoConfigured` flag arrives through the `projectUpdate` socket event (Task 4).

- [ ] **Step 0: Impact check.** Run `gitnexus_impact` (upstream) on `ProjectSettingsModal`. The change only adds a tab.

- [ ] **Step 1: Create the pane**

Create `client/src/components/projects/ProjectSettingsModal/IntegrationsPane.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Form, Header, Message, Tab } from 'semantic-ui-react';
import { Input } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import api from '../../../api';
import { useForm, useNestedRef } from '../../../hooks';
import { getHippoErrorText } from '../../../utils/hippo';

import styles from './IntegrationsPane.module.scss';

const DEFAULT_DATA = {
  appSecretKey: '',
};

// Talks to the server directly, as the team dashboard does. Whether a key is set comes back
// through the projectUpdate socket event; the key itself never comes back.
const IntegrationsPane = React.memo(() => {
  const project = useSelector(selectors.selectCurrentProject);
  const accessToken = useSelector(selectors.selectAccessToken);

  const [t] = useTranslation();
  const [data, handleFieldChange, setData] = useForm(DEFAULT_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const [keyFieldRef, handleKeyFieldRef] = useNestedRef('inputRef');

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  const run = useCallback(
    async (sendRequest, successKey) => {
      setIsSubmitting(true);
      setMessage(null);

      try {
        await sendRequest();

        setMessage({
          isError: false,
          content: t(successKey),
        });
      } catch (error) {
        setMessage({
          isError: true,
          content: getHippoErrorText(error, t),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [t],
  );

  const handleSubmit = useCallback(() => {
    const appSecretKey = data.appSecretKey.trim();

    if (!appSecretKey) {
      keyFieldRef.current.select();
      return;
    }

    run(
      () =>
        api.updateHippoConfig(
          project.id,
          {
            appSecretKey,
          },
          headers,
        ),
      'common.hippoKeySaved',
    );

    setData(DEFAULT_DATA);
  }, [project.id, headers, data, setData, run, keyFieldRef]);

  const handleTestClick = useCallback(() => {
    run(() => api.verifyHippoConfig(project.id, headers), 'common.hippoConnectionWorks');
  }, [project.id, headers, run]);

  const handleRemoveClick = useCallback(() => {
    run(() => api.deleteHippoConfig(project.id, headers), 'common.hippoKeyRemoved');
  }, [project.id, headers, run]);

  return (
    <Tab.Pane attached={false} className={styles.wrapper}>
      <Header as="h4">
        {t('common.hippo', {
          context: 'title',
        })}
      </Header>
      <p className={styles.status}>
        {project.isHippoConfigured ? t('common.hippoIsConfigured') : t('common.hippoNotConfigured')}
      </p>
      <Form onSubmit={handleSubmit}>
        <div className={styles.text}>{t('common.hippoAppSecretKey')}</div>
        <Input
          fluid
          ref={handleKeyFieldRef}
          type="password"
          name="appSecretKey"
          value={data.appSecretKey}
          maxLength={512}
          autoComplete="off"
          className={styles.field}
          onChange={handleFieldChange}
        />
        <Button positive type="submit" disabled={isSubmitting} content={t('action.save')} />
        {project.isHippoConfigured && (
          <>
            <Button
              type="button"
              disabled={isSubmitting}
              content={t('action.testConnection')}
              onClick={handleTestClick}
            />
            <Button
              type="button"
              disabled={isSubmitting}
              content={t('action.remove')}
              onClick={handleRemoveClick}
            />
          </>
        )}
      </Form>
      {message && (
        <Message
          visible
          size="tiny"
          positive={!message.isError}
          negative={message.isError}
          content={message.content}
          className={styles.message}
        />
      )}
    </Tab.Pane>
  );
});

export default IntegrationsPane;
```

Create `client/src/components/projects/ProjectSettingsModal/IntegrationsPane.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .field {
    margin-bottom: 12px;
  }

  .message {
    margin-top: 12px;
  }

  .status {
    color: #6b808c;
  }

  .text {
    color: #444444;
    font-size: 12px;
    font-weight: bold;
    padding-bottom: 6px;
  }

  .wrapper {
    border: none;
    box-shadow: none;
  }
}
```

- [ ] **Step 2: Add the tab**

In `client/src/components/projects/ProjectSettingsModal/ProjectSettingsModal.jsx`:
- After `import BaseCustomFieldGroupsPane from './BaseCustomFieldGroupsPane';` add `import IntegrationsPane from './IntegrationsPane';`.
- Inside `if (withManagablePanes) { panes.push(...) }`, add this as the last pushed pane, after the base custom fields pane:

```js
      {
        menuItem: t('common.integrations', {
          context: 'title',
        }),
        render: () => <IntegrationsPane />,
      },
```

The new tab goes last, so `isBackgroundPaneActive` (index 2) is unaffected.

- [ ] **Step 3: Add the strings**

Add these to `common`, each where it sorts alphabetically:

```js
      hippo_title: 'Hippo',
      hippoAppSecretKey: 'Hippo app secret key',
      hippoConnectionWorks: 'Hippo accepted the key',
      hippoIsConfigured: 'Hippo is set up for this project',
      hippoKeyRemoved: 'Hippo key removed',
      hippoKeySaved: 'Hippo key saved',
      integrations_title: 'Integrations',
```

Add this to `action`:

```js
      testConnection: 'Test connection',
```

- [ ] **Step 4: Light checks**

Run: `cd client && npx eslint src/components/projects/ProjectSettingsModal src/locales/en-US/core.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/projects/ProjectSettingsModal client/src/locales/en-US/core.js
git commit -m "hippo: integrations tab for the project's Hippo key" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Sagas for import, sync, retry and toasts

**Files:**
- Create: `client/src/sagas/core/services/hippo-sync.js`
- Create: `client/src/sagas/core/services/hippo.js`
- Create: `client/src/sagas/core/watchers/hippo.js`
- Create: `client/src/entry-actions/hippo.js`
- Create in `client/src/components/common/Toaster/`: `HippoSyncFailedToast.jsx`, `HippoSyncFailedToast.module.scss`, `HippoImportIncompleteToast.jsx`
- Modify in `client/src/sagas/core/services/`: `comments.js`, `custom-field-values.js`, `custom-fields.js`, `custom-field-groups.js`, `cards.js`, `index.js`
- Modify in `client/src/sagas/core/watchers/`: `comments.js`, `custom-field-values.js`, `cards.js`, `index.js`
- Modify in `client/src/entry-actions/`: `comments.js`, `custom-field-values.js`, `cards.js`, `index.js`
- Modify: `client/src/constants/EntryActionTypes.js`, `client/src/constants/ToastTypes.js`, `client/src/components/common/Toaster/Toaster.jsx`, `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes: `api.syncHippoNote` and `api.syncHippoStatus`; `selectHippoFieldGroupByBoardId`; `HIPPO_FIELD_DEFINITIONS`, `HIPPO_GROUP_NAME`, `buildTicketStateOptions` and `getHippoErrorText` (Task 7).
- Produces these service return values (each returns null when the server refuses):
  - `createComment(cardId, data, { syncToHippo })` → comment
  - `updateCustomFieldValue(cardId, groupId, fieldId, data, { syncToHippo })` → value
  - `createCustomFieldGroupInBoard` → group
  - `createCustomFieldInGroup` → field
  - `updateCustomField` → field
- Produces these sagas:
  - `syncCommentToHippo(cardId, commentId)`, `syncTicketStateToHippo(cardId)`, `retryHippoSync(cardId, commentId)`
  - `ensureHippoFieldGroup(boardId, ticketState)` → `{ customFieldGroupId, customFieldIdByName } | null`
  - `importHippoTicketToCard(card, { ticketState, values, commentTexts })`
- Produces these entry actions:
  - `createCommentInCurrentCard(data, { syncToHippo })`
  - `updateCustomFieldValue(cardId, groupId, fieldId, data, { syncToHippo })`
  - `createCardWithDetails(listId, data, { userIds, labelIds, recurrence, hippo })`
  - `retryHippoSync(cardId, commentId)`

- [ ] **Step 0: Impact check**
  - `gitnexus_impact` on `createCardWithDetails` and `createCommentInCurrentCard` (entry actions). Planning found LOW: one caller each, `TimelineView.jsx` and `comments/Comments/Add.jsx`.
  - The saga generators are not indexed. `grep -rn "createComment\b\|updateCustomFieldValue\b\|createCustomFieldGroupInBoard\|createCustomFieldInGroup\|updateCustomField\b" client/src/sagas` shows only `createCommentInCurrentCard`, `createCustomFieldGroupInCurrentBoard`, `moveCustomField` and the watchers call them. Adding return values breaks none of them.

- [ ] **Step 1: Make the services return what they created**

In `client/src/sagas/core/services/custom-field-groups.js`, in `createCustomFieldGroupInBoard`:
- Change the `return;` inside `catch` to `return null;`.
- After `yield put(actions.createCustomFieldGroup.success(localId, customFieldGroup));` add `return customFieldGroup;`.
- Above the function, add the comment `// Returns the group the server created, or null when it refused`.

In `client/src/sagas/core/services/custom-fields.js`, make the same two changes:
- In `createCustomFieldInGroup`: `return null;` in `catch`, and `return customField;` after the success put.
- In `updateCustomField`: `return null;` in `catch`, and `return customField;` after `yield put(actions.updateCustomField.success(customField));`.

- [ ] **Step 2: Create the sync service**

Create `client/src/sagas/core/services/hippo-sync.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { call } from 'redux-saga/effects';
import toast from 'react-hot-toast';

import request from '../request';
import api from '../../../api';
import ToastTypes from '../../../constants/ToastTypes';

const FAILED_TOAST_DURATION = 10 * 1000;

// A failed push leaves the Planka change in place; the toast offers to push again
function* toastSyncFailure(cardId, commentId, error) {
  yield call(
    toast,
    {
      type: ToastTypes.HIPPO_SYNC_FAILED,
      params: {
        cardId,
        commentId,
        error: {
          message: error.message,
        },
      },
    },
    {
      duration: FAILED_TOAST_DURATION,
    },
  );
}

export function* syncCommentToHippo(cardId, commentId) {
  try {
    yield call(request, api.syncHippoNote, cardId, {
      commentId,
    });
  } catch (error) {
    yield call(toastSyncFailure, cardId, commentId, error);
  }
}

export function* syncTicketStateToHippo(cardId) {
  try {
    yield call(request, api.syncHippoStatus, cardId);
  } catch (error) {
    yield call(toastSyncFailure, cardId, null, error);
  }
}

export function* retryHippoSync(cardId, commentId) {
  if (commentId) {
    yield call(syncCommentToHippo, cardId, commentId);
  } else {
    yield call(syncTicketStateToHippo, cardId);
  }
}

export default {
  syncCommentToHippo,
  syncTicketStateToHippo,
  retryHippoSync,
};
```

- [ ] **Step 3: Let comment and value saves push to Hippo**

In `client/src/sagas/core/services/comments.js`:

1. After the `createLocalId` import, add:

```js
import { syncCommentToHippo } from './hippo-sync';
```

2. Replace `createComment` and `createCommentInCurrentCard` with:

```js
// Returns the comment the server created, or null when it refused. On a ticket card the user may
// also have chosen to post it to Hippo, which happens once Planka has it.
export function* createComment(cardId, data, { syncToHippo = false } = {}) {
  const localId = yield call(createLocalId);
  const currentUser = yield select(selectors.selectCurrentUser);

  yield put(
    actions.createComment({
      ...data,
      cardId,
      id: localId,
      userId: currentUser.id,
    }),
  );

  let comment;
  try {
    ({ item: comment } = yield call(request, api.createComment, cardId, data));
  } catch (error) {
    yield put(actions.createComment.failure(localId, error));
    return null;
  }

  yield put(actions.createComment.success(localId, comment));

  if (syncToHippo) {
    yield call(syncCommentToHippo, cardId, comment.id);
  }

  return comment;
}

export function* createCommentInCurrentCard(data, options) {
  const { cardId } = yield select(selectors.selectPath);

  yield call(createComment, cardId, data, options);
}
```

In `client/src/sagas/core/services/custom-field-values.js`:

1. After the `createLocalId` import, add `import { syncTicketStateToHippo } from './hippo-sync';`.

2. Change the signature to:

```js
export function* updateCustomFieldValue(
  cardId,
  customFieldGroupId,
  customFieldId,
  data,
  { syncToHippo = false } = {},
) {
```

3. Change the `return;` in `catch` to `return null;`.

4. After `yield put(actions.updateCustomFieldValue.success(localId, customFieldValue));` add:

```js

  if (syncToHippo) {
    yield call(syncTicketStateToHippo, cardId);
  }

  return customFieldValue;
```

- [ ] **Step 4: Create the import service**

Create `client/src/sagas/core/services/hippo.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { call, select } from 'redux-saga/effects';
import toast from 'react-hot-toast';

import { createCustomFieldGroupInBoard } from './custom-field-groups';
import { createCustomFieldInGroup, updateCustomField } from './custom-fields';
import { updateCustomFieldValue } from './custom-field-values';
import { createComment } from './comments';
import selectors from '../../../selectors';
import {
  HIPPO_FIELD_DEFINITIONS,
  HIPPO_GROUP_NAME,
  buildTicketStateOptions,
} from '../../../utils/hippo';
import { CustomFieldTypes } from '../../../constants/Enums';
import ToastTypes from '../../../constants/ToastTypes';

/**
 * Finds the board's "Hippo Ticket" group, creating it and whichever of its fields are missing. A
 * state the Ticket State dropdown does not offer yet joins its options. Returns the ids to set the
 * values with, or null when the server refused any of it.
 */
export function* ensureHippoFieldGroup(boardId, ticketState) {
  const hippoFieldGroup = yield select(selectors.selectHippoFieldGroupByBoardId, boardId);

  let customFieldGroupId;
  let customFields;

  if (hippoFieldGroup) {
    ({ id: customFieldGroupId, customFields } = hippoFieldGroup);
  } else {
    const customFieldGroup = yield call(createCustomFieldGroupInBoard, boardId, {
      name: HIPPO_GROUP_NAME,
    });

    if (!customFieldGroup) {
      return null;
    }

    customFieldGroupId = customFieldGroup.id;
    customFields = [];
  }

  const customFieldIdByName = {};

  for (let i = 0; i < HIPPO_FIELD_DEFINITIONS.length; i += 1) {
    const definition = HIPPO_FIELD_DEFINITIONS[i];
    const isDropdown = definition.type === CustomFieldTypes.DROPDOWN;

    let customField = customFields.find(({ name }) => name === definition.name);

    if (!customField) {
      customField = yield call(createCustomFieldInGroup, customFieldGroupId, {
        ...definition,
        options: isDropdown ? buildTicketStateOptions(null, ticketState) : null,
      });
    } else if (
      isDropdown &&
      customField.type === CustomFieldTypes.DROPDOWN &&
      ticketState &&
      !(customField.options || []).includes(ticketState)
    ) {
      customField = yield call(updateCustomField, customField.id, {
        options: [...(customField.options || []), ticketState],
      });
    }

    if (!customField) {
      return null;
    }

    customFieldIdByName[definition.name] = customField.id;
  }

  return {
    customFieldGroupId,
    customFieldIdByName,
  };
}

/**
 * Links a card that was just created to its Hippo ticket. The ticket's values go into the board's
 * "Hippo Ticket" fields, and the chosen notes and comments become comments, oldest first. Each
 * step waits for the one before it, so the comments keep their order and a failure stops the rest
 * and is reported once. Imported comments are never posted back to Hippo.
 */
export function* importHippoTicketToCard(card, { ticketState, values, commentTexts }) {
  const hippoFieldGroup = yield call(ensureHippoFieldGroup, card.boardId, ticketState);

  let isComplete = !!hippoFieldGroup;

  for (let i = 0; isComplete && i < values.length; i += 1) {
    const { name, content } = values[i];

    const customFieldValue = yield call(
      updateCustomFieldValue,
      card.id,
      hippoFieldGroup.customFieldGroupId,
      hippoFieldGroup.customFieldIdByName[name],
      {
        content,
      },
    );

    isComplete = !!customFieldValue;
  }

  for (let i = 0; isComplete && i < commentTexts.length; i += 1) {
    const comment = yield call(createComment, card.id, {
      text: commentTexts[i],
    });

    isComplete = !!comment;
  }

  if (!isComplete) {
    yield call(toast, {
      type: ToastTypes.HIPPO_IMPORT_INCOMPLETE,
    });
  }
}

export default {
  ensureHippoFieldGroup,
  importHippoTicketToCard,
};
```

- [ ] **Step 5: Link the ticket in `createCardWithDetails`**

In `client/src/sagas/core/services/cards.js`:

1. After the `./card-recurrences` import block, add:

```js
import { importHippoTicketToCard } from './hippo';
```

2. Replace the doc comment and the function with:

```js
/**
 * The API only takes members and labels on a card that already exists, so they follow the create
 * instead of riding along with it, addressed by the server's id rather than the local one the
 * store showed in the meantime. Each attach rolls itself back if it fails. A Hippo ticket the
 * dialog imported is linked next. A repeat comes last, since every card of the series is a copy
 * of this one, members, labels and Hippo fields included.
 */
export function* createCardWithDetails(listId, data, { userIds, labelIds, recurrence, hippo }) {
  const card = yield call(createCard, listId, data);

  if (!card) {
    return;
  }

  yield all([
    ...userIds.map((userId) => call(addUserToCard, userId, card.id)),
    ...labelIds.map((labelId) => call(addLabelToCard, labelId, card.id)),
  ]);

  if (hippo) {
    yield call(importHippoTicketToCard, card, hippo);
  }

  if (recurrence) {
    yield call(createCardRecurrence, card.id, recurrence);
  }
}
```

- [ ] **Step 6: Register the services**

In `client/src/sagas/core/services/index.js`:
- After `import notificationServices from './notification-services';` add:

```js
import hippo from './hippo';
import hippoSync from './hippo-sync';
```

- After `...notificationServices,` add `...hippo,` and `...hippoSync,`.

- [ ] **Step 7: Update the entry actions and watchers**

In `client/src/entry-actions/comments.js`, replace `createCommentInCurrentCard` with:

```js
const createCommentInCurrentCard = (data, { syncToHippo = false } = {}) => ({
  type: EntryActionTypes.COMMENT_IN_CURRENT_CARD_CREATE,
  payload: {
    data,
    syncToHippo,
  },
});
```

In `client/src/sagas/core/watchers/comments.js`, replace the `COMMENT_IN_CURRENT_CARD_CREATE` line with:

```js
    takeEvery(EntryActionTypes.COMMENT_IN_CURRENT_CARD_CREATE, ({ payload: { data, syncToHippo } }) =>
      services.createCommentInCurrentCard(data, { syncToHippo }),
    ),
```

In `client/src/entry-actions/custom-field-values.js`, replace `updateCustomFieldValue` with:

```js
const updateCustomFieldValue = (
  cardId,
  customFieldGroupId,
  customFieldId,
  data,
  { syncToHippo = false } = {},
) => ({
  type: EntryActionTypes.CUSTOM_FIELD_VALUE_UPDATE,
  payload: {
    cardId,
    customFieldGroupId,
    customFieldId,
    data,
    syncToHippo,
  },
});
```

In `client/src/sagas/core/watchers/custom-field-values.js`, replace the `CUSTOM_FIELD_VALUE_UPDATE` `takeEvery` with:

```js
    takeEvery(
      EntryActionTypes.CUSTOM_FIELD_VALUE_UPDATE,
      ({ payload: { cardId, customFieldGroupId, customFieldId, data, syncToHippo } }) =>
        services.updateCustomFieldValue(cardId, customFieldGroupId, customFieldId, data, {
          syncToHippo,
        }),
    ),
```

In `client/src/entry-actions/cards.js`, replace `createCardWithDetails` with:

```js
// Members, labels and an imported Hippo ticket ride along for the create dialog; they are
// attached once the card exists
const createCardWithDetails = (listId, data, { userIds, labelIds, recurrence, hippo }) => ({
  type: EntryActionTypes.CARD_WITH_DETAILS_CREATE,
  payload: {
    listId,
    data,
    userIds,
    labelIds,
    recurrence,
    hippo,
  },
});
```

In `client/src/sagas/core/watchers/cards.js`, replace the `CARD_WITH_DETAILS_CREATE` `takeEvery` with:

```js
    takeEvery(
      EntryActionTypes.CARD_WITH_DETAILS_CREATE,
      ({ payload: { listId, data, userIds, labelIds, recurrence, hippo } }) =>
        services.createCardWithDetails(listId, data, { userIds, labelIds, recurrence, hippo }),
    ),
```

- [ ] **Step 8: Add the retry entry action and watcher**

In `client/src/constants/EntryActionTypes.js`, add this before the closing `};`, after the Notification Services block:

```js

  /* Hippo */

  HIPPO_SYNC_RETRY: `${PREFIX}/HIPPO_SYNC_RETRY`,
```

Create `client/src/entry-actions/hippo.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import EntryActionTypes from '../constants/EntryActionTypes';

// A comment push when commentId is given, a ticket state push otherwise
const retryHippoSync = (cardId, commentId) => ({
  type: EntryActionTypes.HIPPO_SYNC_RETRY,
  payload: {
    cardId,
    commentId,
  },
});

export default {
  retryHippoSync,
};
```

Create `client/src/sagas/core/watchers/hippo.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { all, takeEvery } from 'redux-saga/effects';

import services from '../services';
import EntryActionTypes from '../../../constants/EntryActionTypes';

export default function* hippoWatchers() {
  yield all([
    takeEvery(EntryActionTypes.HIPPO_SYNC_RETRY, ({ payload: { cardId, commentId } }) =>
      services.retryHippoSync(cardId, commentId),
    ),
  ]);
}
```

Register both:
- In `client/src/entry-actions/index.js`: add `import hippo from './hippo';` after the notification-services import, and `...hippo,` after `...notificationServices,`.
- In `client/src/sagas/core/watchers/index.js`: add `import hippo from './hippo';` after the notification-services import, and add `hippo,` as the last entry of the exported array.

- [ ] **Step 9: Add the toasts**

In `client/src/constants/ToastTypes.js`:
- Add `const HIPPO_SYNC_FAILED = 'HIPPO_SYNC_FAILED';` and `const HIPPO_IMPORT_INCOMPLETE = 'HIPPO_IMPORT_INCOMPLETE';` after `SOURCE_CARD_NOT_MOVABLE`.
- Add both names to the default export.

Create `client/src/components/common/Toaster/HippoSyncFailedToast.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { Button, Icon, Message } from 'semantic-ui-react';

import entryActions from '../../../entry-actions';
import { getHippoErrorText } from '../../../utils/hippo';

import styles from './HippoSyncFailedToast.module.scss';

const HippoSyncFailedToast = React.memo(({ id, cardId, commentId, error }) => {
  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleRetryClick = useCallback(() => {
    dispatch(entryActions.retryHippoSync(cardId, commentId));
    toast.dismiss(id);
  }, [id, cardId, commentId, dispatch]);

  return (
    <Message visible negative size="tiny">
      <Icon name="ticket alternate" />
      {t('common.hippoSyncFailed', {
        reason: getHippoErrorText(error, t),
      })}
      <Button
        content={t('action.retry')}
        size="mini"
        className={styles.button}
        onClick={handleRetryClick}
      />
    </Message>
  );
});

HippoSyncFailedToast.propTypes = {
  id: PropTypes.string.isRequired,
  cardId: PropTypes.string.isRequired,
  commentId: PropTypes.string,
  error: PropTypes.shape({
    message: PropTypes.string,
  }).isRequired,
};

HippoSyncFailedToast.defaultProps = {
  commentId: null,
};

export default HippoSyncFailedToast;
```

Create `client/src/components/common/Toaster/HippoSyncFailedToast.module.scss`. It styles the Retry button the way `EmptyTrashToast.module.scss` styles its button:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .button {
    background: transparent;
    box-shadow: none;
    color: #6b808c;
    font-weight: normal;
    margin-left: 6px;
    margin-right: 0;
    padding: 6px 11px;
    text-align: left;
    text-decoration: underline;
    transition: none;

    &:hover {
      background: rgba(9, 30, 66, 0.08);
      color: #092d42;
    }
  }
}
```

Create `client/src/components/common/Toaster/HippoImportIncompleteToast.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, Message } from 'semantic-ui-react';

const HippoImportIncompleteToast = React.memo(() => {
  const [t] = useTranslation();

  return (
    <Message visible warning size="tiny">
      <Icon name="ticket alternate" />
      {t('common.hippoImportIncomplete')}
    </Message>
  );
});

export default HippoImportIncompleteToast;
```

In `client/src/components/common/Toaster/Toaster.jsx`:
- Import both components after `SourceCardNotMovableToast`.
- Add these two entries to `TOAST_BY_TYPE`:

```js
  [ToastTypes.HIPPO_SYNC_FAILED]: HippoSyncFailedToast,
  [ToastTypes.HIPPO_IMPORT_INCOMPLETE]: HippoImportIncompleteToast,
```

- [ ] **Step 10: Add the strings**

Add these to `common`, each where it sorts alphabetically:

```js
      hippoImportIncomplete: 'The card was added, but some Hippo details were not imported',
      hippoSyncFailed: 'Saved in Planka, but the Hippo update failed: {{reason}}',
```

Add this to `action`:

```js
      retry: 'Retry',
```

- [ ] **Step 11: Light checks**

Run:

```bash
cd client && npx eslint src/sagas/core src/entry-actions src/constants src/components/common/Toaster src/locales/en-US/core.js && npx jest
```

Expected: no eslint output, and every jest suite passes (the existing ones plus Tasks 6 and 7).

- [ ] **Step 12: Commit**

```bash
git add client/src/sagas/core client/src/entry-actions client/src/constants client/src/components/common/Toaster client/src/locales/en-US/core.js
git commit -m "hippo: sagas for ticket import, sync, retry and their toasts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Hippo import in the Add Card dialog and the Kanban entry point

**Files:**
- Create in `client/src/components/cards/AddCardModal/`: `ticket-url-pattern-storage.js`, `use-hippo-ticket-lookup.js`, `HippoImportField.jsx`, `HippoImportField.module.scss`, `HippoTicketDetails.jsx`, `HippoTicketDetails.module.scss`
- Modify in the same folder: `AddCardModal.jsx`, `Content.jsx`
- Modify: `client/src/components/lists/List/List.jsx`
- Modify: `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes:
  - `api.getHippoTicket`
  - the utils from Task 7: `parseTicketNumber`, `isTicketUrl`, `toTicketUrlPattern`, `buildTicketUrl`, `applyTicketToCardData`, `buildHippoImport`, `buildTicketStateOptions`, `getUnmatchedAssigneeNames`, `getFirstLine`, `getHippoErrorText`, `HippoFieldNames`
  - the selectors `selectIsHippoConfiguredForCurrentProject` and `selectHippoFieldGroupByBoardId`
  - `createCardWithDetails` with `hippo` (Task 10)
  - `TicketChip` (Task 8)
- Produces:
  - `AddCardModal` `defaultData.focusHippoImport?: boolean`
  - the details object passed to `onCreate` gains `hippo`
  - in each Kanban list footer, a ticket button that opens the dialog

- [ ] **Step 0: Impact check.** Run `gitnexus_impact` (upstream) on `AddCardModal` (`TimelineView` only) and on `List` (rendered by the Kanban board). Both changes only add code.

- [ ] **Step 1: Create the URL-pattern storage**

Create `client/src/components/cards/AddCardModal/ticket-url-pattern-storage.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Ticket links follow one pattern per project. The last one pasted is remembered in this browser,
// so a bare number can become a link too. Private windows may refuse storage, which only means no
// link.

const buildStorageKey = (projectId) => `hippoTicketUrlPattern:${projectId}`;

export const readTicketUrlPattern = (projectId) => {
  try {
    return window.localStorage.getItem(buildStorageKey(projectId));
  } catch {
    return null;
  }
};

export const writeTicketUrlPattern = (projectId, pattern) => {
  try {
    window.localStorage.setItem(buildStorageKey(projectId), pattern);
  } catch {
    /* empty */
  }
};
```

- [ ] **Step 2: Create the lookup hook**

Create `client/src/components/cards/AddCardModal/use-hippo-ticket-lookup.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import api from '../../../api';
import selectors from '../../../selectors';

// Looks a ticket up through the server; only the latest lookup may settle the state
export default (boardId) => {
  const accessToken = useSelector(selectors.selectAccessToken);

  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  const requestIdRef = useRef(0);

  const fetchTicket = useCallback(
    async (ticketNumber) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      setIsFetching(true);
      setError(null);

      try {
        const { item } = await api.getHippoTicket(boardId, ticketNumber, {
          Authorization: `Bearer ${accessToken}`,
        });

        return requestId === requestIdRef.current ? item : null;
      } catch (fetchError) {
        if (requestId === requestIdRef.current) {
          setError(fetchError);
        }

        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setIsFetching(false);
        }
      }
    },
    [boardId, accessToken],
  );

  return [fetchTicket, isFetching, error];
};
```

- [ ] **Step 3: Create the import field**

Create `client/src/components/cards/AddCardModal/HippoImportField.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Form, Icon } from 'semantic-ui-react';
import { Input } from '../../../lib/custom-ui';

import { useNestedRef } from '../../../hooks';
import {
  buildTicketUrl,
  getHippoErrorText,
  isTicketUrl,
  parseTicketNumber,
  toTicketUrlPattern,
} from '../../../utils/hippo';
import { readTicketUrlPattern, writeTicketUrlPattern } from './ticket-url-pattern-storage';
import useHippoTicketLookup from './use-hippo-ticket-lookup';

import styles from './HippoImportField.module.scss';

const HippoImportField = React.memo(({ boardId, projectId, autoFocus, onFetch }) => {
  const [t] = useTranslation();
  const [value, setValue] = useState('');
  const [inputErrorText, setInputErrorText] = useState(null);
  const [fetchTicket, isFetching, fetchError] = useHippoTicketLookup(boardId);

  const [fieldRef, handleFieldRef] = useNestedRef('inputRef');

  const handleChange = useCallback((_, { value: nextValue }) => {
    setValue(nextValue);
    setInputErrorText(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const ticketNumber = parseTicketNumber(value);

    if (!ticketNumber) {
      setInputErrorText(t('common.enterTicketNumberOrUrl'));
      fieldRef.current.select();
      return;
    }

    const ticket = await fetchTicket(ticketNumber);

    if (!ticket) {
      return;
    }

    let ticketUrl;

    if (isTicketUrl(value)) {
      ticketUrl = value.trim();

      const pattern = toTicketUrlPattern(ticketUrl, ticketNumber);

      if (pattern) {
        writeTicketUrlPattern(projectId, pattern);
      }
    } else {
      ticketUrl = buildTicketUrl(readTicketUrlPattern(projectId), ticketNumber);
    }

    onFetch(ticket, ticketUrl);
  }, [value, projectId, fetchTicket, onFetch, fieldRef, t]);

  useEffect(() => {
    if (autoFocus) {
      fieldRef.current.focus();
    }
  }, [autoFocus, fieldRef]);

  const errorText = inputErrorText || (fetchError && getHippoErrorText(fetchError, t));

  return (
    <Form className={styles.wrapper} onSubmit={handleSubmit}>
      <Icon name="ticket alternate" className={styles.icon} />
      <Input
        ref={handleFieldRef}
        value={value}
        placeholder={t('common.ticketNumberOrUrl')}
        maxLength={1024}
        className={styles.field}
        onChange={handleChange}
      />
      <Button
        type="submit"
        loading={isFetching}
        disabled={isFetching}
        content={t('action.fetch')}
        className={styles.button}
      />
      {errorText && <div className={styles.error}>{errorText}</div>}
    </Form>
  );
});

HippoImportField.propTypes = {
  boardId: PropTypes.string.isRequired,
  projectId: PropTypes.string.isRequired,
  autoFocus: PropTypes.bool,
  onFetch: PropTypes.func.isRequired,
};

HippoImportField.defaultProps = {
  autoFocus: false,
};

export default HippoImportField;
```

Create `client/src/components/cards/AddCardModal/HippoImportField.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .button {
    flex: 0 0 auto;
    margin: 0 0 0 8px;
  }

  .error {
    color: #db2828;
    flex-basis: 100%;
    font-size: 12px;
    margin-top: 6px;
  }

  .field {
    flex: 1;
    min-width: 0;
  }

  .icon {
    color: #6b808c;
    margin-right: 8px;
  }

  .wrapper {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    width: 100%;
  }
}
```

- [ ] **Step 4: Create the ticket details section**

Create `client/src/components/cards/AddCardModal/HippoTicketDetails.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Dropdown, Icon } from 'semantic-ui-react';

import { getFirstLine, getUnmatchedAssigneeNames } from '../../../utils/hippo';
import TicketChip from '../../hippo/TicketChip';

import cardStyles from '../CardModal/ProjectContent.module.scss';
import styles from './HippoTicketDetails.module.scss';

// What the new card takes from the ticket beyond its title, description and dates
const HippoTicketDetails = React.memo(
  ({
    ticket,
    ticketUrl,
    ticketState,
    stateOptions,
    selectedEntryIds,
    onTicketStateChange,
    onSelectedEntryIdsChange,
  }) => {
    const [t] = useTranslation();

    const unmatchedNames = useMemo(() => getUnmatchedAssigneeNames(ticket), [ticket]);
    const isAllSelected = selectedEntryIds.length === ticket.entries.length;

    const handleStateChange = useCallback(
      (_, { value }) => {
        onTicketStateChange(value || null);
      },
      [onTicketStateChange],
    );

    const handleAllToggle = useCallback(() => {
      onSelectedEntryIdsChange(isAllSelected ? [] : ticket.entries.map((entry) => entry.id));
    }, [isAllSelected, ticket.entries, onSelectedEntryIdsChange]);

    const toggleEntry = (entryId) => {
      onSelectedEntryIdsChange(
        selectedEntryIds.includes(entryId)
          ? selectedEntryIds.filter((id) => id !== entryId)
          : [...selectedEntryIds, entryId],
      );
    };

    return (
      <div className={cardStyles.contentModule}>
        <div className={cardStyles.moduleWrapper}>
          <Icon name="ticket alternate" className={cardStyles.moduleIcon} />
          <div className={cardStyles.moduleHeader}>
            {t('common.hippoTicket', {
              context: 'title',
            })}
            <TicketChip number={ticket.number} url={ticketUrl} className={styles.ticketChip} />
          </div>
          <div className={styles.fields}>
            <div className={styles.field}>
              <div className={styles.label}>{t('common.ticketState')}</div>
              <Dropdown
                fluid
                selection
                options={stateOptions.map((option) => ({
                  key: option,
                  text: option,
                  value: option,
                }))}
                value={ticketState || ''}
                placeholder={t('common.selectOption')}
                onChange={handleStateChange}
              />
            </div>
            <div className={styles.field}>
              <div className={styles.label}>{t('common.priority')}</div>
              <div className={styles.value}>{ticket.priority || '—'}</div>
            </div>
          </div>
          {unmatchedNames.length > 0 && (
            <div className={styles.hint}>
              {t('common.notOnThisBoard', {
                names: unmatchedNames.join(', '),
              })}
            </div>
          )}
          {ticket.entries.length > 0 && (
            <div className={styles.entries}>
              <div className={styles.entriesHeader}>
                {t('common.notesAndComments', {
                  context: 'title',
                })}
                <Button
                  basic
                  type="button"
                  size="mini"
                  content={isAllSelected ? t('action.selectNone') : t('action.selectAll')}
                  onClick={handleAllToggle}
                />
              </div>
              {ticket.entries.map((entry) => (
                <div key={entry.id} className={styles.entry}>
                  <Checkbox
                    checked={selectedEntryIds.includes(entry.id)}
                    onChange={() => toggleEntry(entry.id)}
                  />
                  <div className={styles.entryContent}>
                    <span className={styles.entryBadge}>
                      {entry.kind === 'note'
                        ? t('common.hippoNoteBadge')
                        : t('common.hippoCommentBadge')}
                    </span>
                    <span>{entry.authorName}</span>
                    {entry.date && (
                      <span className={styles.entryDate}>
                        {t('format:fullDateTime', {
                          value: new Date(entry.date),
                          postProcess: 'formatDate',
                        })}
                      </span>
                    )}
                    <div className={styles.entryText}>{getFirstLine(entry.markdown)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

HippoTicketDetails.propTypes = {
  ticket: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  ticketUrl: PropTypes.string,
  ticketState: PropTypes.string,
  stateOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedEntryIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onTicketStateChange: PropTypes.func.isRequired,
  onSelectedEntryIdsChange: PropTypes.func.isRequired,
};

HippoTicketDetails.defaultProps = {
  ticketUrl: null,
  ticketState: null,
};

export default HippoTicketDetails;
```

Create `client/src/components/cards/AddCardModal/HippoTicketDetails.module.scss`:

```scss
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

:global(#app) {
  .entries {
    margin-top: 12px;
  }

  .entriesHeader {
    align-items: center;
    color: #17394d;
    display: flex;
    font-weight: bold;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .entry {
    align-items: flex-start;
    display: flex;
    gap: 8px;
    padding: 6px 0;
  }

  .entryBadge {
    background: #dfe3e6;
    border-radius: 3px;
    font-size: 11px;
    font-weight: bold;
    margin-right: 6px;
    padding: 0 4px;
  }

  .entryContent {
    flex: 1;
    min-width: 0;
  }

  .entryDate {
    color: #6b808c;
    font-size: 12px;
    margin-left: 6px;
  }

  .entryText {
    color: #6b808c;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field {
    flex: 1;
    min-width: 0;
  }

  .fields {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
  }

  .hint {
    color: #6b808c;
    font-size: 12px;
    margin-bottom: 8px;
  }

  .label {
    color: #6b808c;
    font-size: 12px;
    margin-bottom: 4px;
  }

  .ticketChip {
    margin-left: 8px;
  }

  .value {
    line-height: 38px;
  }
}
```

- [ ] **Step 5: Wire it into `Content.jsx`**

In `client/src/components/cards/AddCardModal/Content.jsx`:

1. After `import { areDatesInOrder, buildCardData } from './card-data';` add:

```js
import {
  HippoFieldNames,
  applyTicketToCardData,
  buildHippoImport,
  buildTicketStateOptions,
} from '../../../utils/hippo';
import HippoImportField from './HippoImportField';
import HippoTicketDetails from './HippoTicketDetails';
```

2. Replace `const { defaultCardType } = useSelector(selectors.selectCurrentBoard);` with:

```js
  const {
    id: boardId,
    projectId,
    defaultCardType,
  } = useSelector(selectors.selectCurrentBoard);
```

3. After the `labels` selector, add:

```js
  const isHippoConfigured = useSelector(selectors.selectIsHippoConfiguredForCurrentProject);

  const hippoFieldGroup = useSelector((state) =>
    selectors.selectHippoFieldGroupByBoardId(state, boardId),
  );
```

4. After `const [, , setIsClosableActive] = useContext(ClosableContext);` add:

```js
  // The fetched ticket and what to take from it: { ticket, ticketUrl, ticketState, selectedEntryIds }
  const [hippo, setHippo] = useState(null);
```

5. After `const canCreate = …;` add:

```js
  const hippoStateOptions = useMemo(() => {
    if (!hippo) {
      return [];
    }

    const stateCustomField =
      hippoFieldGroup &&
      hippoFieldGroup.customFields.find(
        (customField) => customField.name === HippoFieldNames.TICKET_STATE,
      );

    return buildTicketStateOptions(
      stateCustomField && stateCustomField.options,
      hippo.ticket.statusText,
    );
  }, [hippo, hippoFieldGroup]);
```

6. After `handleEditDescriptionClose`, add:

```js
  // A second ticket replaces the first one's prefill, members included
  const handleHippoTicketFetch = useCallback(
    (ticket, ticketUrl) => {
      setData((prevData) => applyTicketToCardData(prevData, ticket, hippo && hippo.ticket));
      setDescriptionDraft(null);

      setHippo({
        ticket,
        ticketUrl,
        ticketState: ticket.statusText,
        selectedEntryIds: ticket.entries.map((entry) => entry.id),
      });
    },
    [hippo, setData],
  );

  const handleHippoTicketStateChange = useCallback((ticketState) => {
    setHippo((prevHippo) => ({
      ...prevHippo,
      ticketState,
    }));
  }, []);

  const handleHippoSelectedEntryIdsChange = useCallback((selectedEntryIds) => {
    setHippo((prevHippo) => ({
      ...prevHippo,
      selectedEntryIds,
    }));
  }, []);

  const formatEntryDate = useCallback(
    (date) =>
      t('format:fullDateTime', {
        value: date,
        postProcess: 'formatDate',
      }),
    [t],
  );
```

7. In `submit`, replace the third argument of `onCreate(...)` with:

```js
      {
        userIds,
        labelIds,
        recurrence: recurrence || undefined,
        hippo: hippo ? buildHippoImport(hippo, formatEntryDate) : undefined,
      },
```

   Then add `hippo` and `formatEntryDate` to `submit`'s dependency list.

8. Replace the name-focus effect with:

```js
  // From a list's Hippo button the ticket field takes the focus instead
  useEffect(() => {
    if (!(isHippoConfigured && defaultData.focusHippoImport)) {
      nameFieldRef.current.focus();
    }
  }, [nameFieldRef]); // eslint-disable-line react-hooks/exhaustive-deps
```

9. In the JSX, directly after `<Grid className={cardStyles.wrapper}>`, insert:

```jsx
      {isHippoConfigured && (
        <Grid.Row className={cardStyles.headerPadding}>
          <Grid.Column width={16} className={cardStyles.headerPadding}>
            <HippoImportField
              boardId={boardId}
              projectId={projectId}
              autoFocus={!!defaultData.focusHippoImport}
              onFetch={handleHippoTicketFetch}
            />
          </Grid.Column>
        </Grid.Row>
      )}
```

10. In the 12-wide main column, directly after the closing `</div>` of the description `contentModule`, insert:

```jsx
          {hippo && (
            <HippoTicketDetails
              ticket={hippo.ticket}
              ticketUrl={hippo.ticketUrl}
              ticketState={hippo.ticketState}
              stateOptions={hippoStateOptions}
              selectedEntryIds={hippo.selectedEntryIds}
              onTicketStateChange={handleHippoTicketStateChange}
              onSelectedEntryIdsChange={handleHippoSelectedEntryIdsChange}
            />
          )}
```

11. In `Content.propTypes.defaultData`'s shape, and in the same shape in `AddCardModal.jsx`, add `focusHippoImport: PropTypes.bool,`.

- [ ] **Step 6: Add the Kanban list entry point**

In `client/src/components/lists/List/List.jsx`:

1. After `import ArchiveCardsStep from '../../cards/ArchiveCardsStep';` add `import AddCardModal from '../../cards/AddCardModal';`.

2. After the `isFavoritesActive` selector, add:

```js
  const isHippoConfigured = useSelector(selectors.selectIsHippoConfiguredForCurrentProject);
```

3. After `const [addCardPosition, setAddCardPosition] = useState(null);` add:

```js
  const [hippoImportDefaultData, setHippoImportDefaultData] = useState(null);
```

4. After `handleCardCreate`, add:

```js
  const handleHippoImportClick = useCallback(() => {
    setHippoImportDefaultData({
      listId: id,
      focusHippoImport: true,
    });
  }, [id]);

  const handleHippoCardCreate = useCallback(
    (listId, data, details) => {
      dispatch(entryActions.createCardWithDetails(listId, data, details));
    },
    [dispatch],
  );

  const handleHippoImportClose = useCallback(() => {
    setHippoImportDefaultData(null);
  }, []);
```

5. In the `addCardButtonWrapper` block, after the paste button's `)}`, insert:

```jsx
                {isHippoConfigured && (
                  <button
                    type="button"
                    disabled={!list.isPersisted}
                    title={t('action.importFromHippo')}
                    className={classNames(styles.addCardButton, styles.paste)}
                    onClick={handleHippoImportClick}
                  >
                    <Icon name="ticket alternate" />
                  </button>
                )}
```

6. Wrap the returned `<Draggable>` in a fragment and render the modal after it. The modal portals
   to `<body>`, but keeping it outside the Draggable keeps its events out of the list's handlers.
   Replace the opening

```jsx
  return (
    <Draggable
```

   with

```jsx
  return (
    <>
      <Draggable
```

   and replace the closing

```jsx
    </Draggable>
  );
});
```

   with

```jsx
      </Draggable>
      {hippoImportDefaultData && (
        <AddCardModal
          defaultData={hippoImportDefaultData}
          onCreate={handleHippoCardCreate}
          onClose={handleHippoImportClose}
        />
      )}
    </>
  );
});
```

   Then run `npx eslint --fix src/components/lists/List/List.jsx` to re-indent the wrapped block.

The footer only renders when `canAddCard` (editors), so the button is editors-only.

- [ ] **Step 7: Add the strings**

Add these to `common`, each where it sorts alphabetically:

```js
      enterTicketNumberOrUrl: 'Enter a ticket number or a link to the ticket',
      hippoCommentBadge: 'Comment',
      hippoNoteBadge: 'Note',
      hippoTicket_title: 'Hippo Ticket',
      notesAndComments_title: 'Notes & Comments',
      notOnThisBoard: 'Not on this board: {{names}}',
      priority: 'Priority',
      ticketNumberOrUrl: 'Hippo ticket number or URL',
      ticketState: 'Ticket state',
```

Add these to `action`:

```js
      fetch: 'Fetch',
      importFromHippo: 'Import from Hippo',
      selectAll: 'Select all',
      selectNone: 'Select none',
```

- [ ] **Step 8: Light checks**

Run: `cd client && npx eslint src/components/cards/AddCardModal src/components/lists/List src/locales/en-US/core.js && npx jest src/components/cards/AddCardModal`
Expected: no eslint output, and `card-data.test.js` still passes.

- [ ] **Step 9: Commit**

```bash
git add client/src/components/cards/AddCardModal client/src/components/lists/List/List.jsx client/src/locales/en-US/core.js
git commit -m "hippo: import a ticket from the Add Card dialog and from Kanban lists" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Sync confirmations for comments and Ticket State

**Files:**
- Create in `client/src/components/hippo/HippoSyncModal/`: `HippoSyncModal.jsx`, `index.js`
- Modify: `client/src/components/comments/Comments/Add.jsx`
- Modify: `client/src/components/custom-fields/CustomField/CustomField.jsx`
- Modify: `client/src/locales/en-US/core.js`

**Interfaces:**
- Consumes: `selectHippoTicketForCurrentCard` and `selectCanSyncToHippoInCurrentBoard` (Task 7); the entry-action options `{ syncToHippo }` (Task 10); `saveValue` in `CustomField.jsx` (Task 8).
- Produces: `<HippoSyncModal content syncContent onSync onSkip onClose />`, a three-choice modal. Closing it saves nothing.

- [ ] **Step 0: Impact check.** Run `gitnexus_impact` (upstream) on `Add` (`comments/Comments/Add.jsx`, used by `Comments.jsx` and `CommentsAndActivities.jsx`) and on `CustomField`.

- [ ] **Step 1: Create the modal**

Create `client/src/components/hippo/HippoSyncModal/HippoSyncModal.jsx`:

```jsx
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';

import { useClosableModal } from '../../../hooks';

/**
 * Asks whether a change on a ticket card should reach Hippo too. Nothing is saved until a choice
 * is made, and closing the dialog saves nothing. It opens over the card modal, the way
 * AddTextFileModal does.
 */
const HippoSyncModal = React.memo(({ content, syncContent, onSync, onSkip, onClose }) => {
  const [t] = useTranslation();
  const [ClosableModal] = useClosableModal();

  return (
    <ClosableModal closeIcon size="tiny" onClose={onClose}>
      <ClosableModal.Header>
        {t('common.syncToHippo', {
          context: 'title',
        })}
      </ClosableModal.Header>
      <ClosableModal.Content>
        <p>{content}</p>
      </ClosableModal.Content>
      <ClosableModal.Actions>
        <Button content={t('action.cancel')} onClick={onClose} />
        <Button content={t('action.plankaOnly')} onClick={onSkip} />
        <Button primary content={syncContent} onClick={onSync} />
      </ClosableModal.Actions>
    </ClosableModal>
  );
});

HippoSyncModal.propTypes = {
  content: PropTypes.string.isRequired,
  syncContent: PropTypes.string.isRequired,
  onSync: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default HippoSyncModal;
```

Create `client/src/components/hippo/HippoSyncModal/index.js`:

```js
/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import HippoSyncModal from './HippoSyncModal';

export default HippoSyncModal;
```

- [ ] **Step 2: Ask before a comment on a ticket card is created**

In `client/src/components/comments/Comments/Add.jsx`:

1. After `import UserAvatar from '../../users/UserAvatar';` add `import HippoSyncModal from '../../hippo/HippoSyncModal';`.

2. After the `boardMemberships` selector, add:

```js
  const hippoTicket = useSelector(selectors.selectHippoTicketForCurrentCard);
  const canSyncToHippo = useSelector(selectors.selectCanSyncToHippoInCurrentBoard);
```

3. After `const [isOpened, setIsOpened] = useState(false);` add `const [pendingData, setPendingData] = useState(null);`.

4. Replace `submit` with `createComment`, a new `submit` and the three modal handlers:

```js
  const createComment = useCallback(
    (cleanData, syncToHippo) => {
      dispatch(
        entryActions.createCommentInCurrentCard(cleanData, {
          syncToHippo,
        }),
      );

      setData(DEFAULT_DATA);
      selectTextField();
    },
    [dispatch, setData, selectTextField],
  );

  const submit = useCallback(() => {
    const cleanData = {
      ...data,
      text: mentionTextToMarkup(data.text.trim(), userByUsername),
    };

    if (!cleanData.text) {
      textInputRef.current.select();
      return;
    }

    // On a ticket card the user first decides whether the comment goes to Hippo too
    if (hippoTicket && canSyncToHippo) {
      setPendingData(cleanData);
      return;
    }

    createComment(cleanData, false);
  }, [data, userByUsername, hippoTicket, canSyncToHippo, createComment]);

  const handleHippoSync = useCallback(() => {
    createComment(pendingData, true);
    setPendingData(null);
  }, [pendingData, createComment]);

  const handleHippoSkip = useCallback(() => {
    createComment(pendingData, false);
    setPendingData(null);
  }, [pendingData, createComment]);

  // The draft stays in the box
  const handleHippoSyncClose = useCallback(() => {
    setPendingData(null);
  }, []);
```

5. Wrap the returned form in a fragment and add the modal after it.
   - Replace `  return (\n    <Form onSubmit={handleSubmit}>` with `  return (\n    <>\n      <Form onSubmit={handleSubmit}>`.
   - Replace the closing `    </Form>\n  );\n});` with the block below.
   - Run `npx eslint --fix src/components/comments/Comments/Add.jsx` to re-indent.

```jsx
      </Form>
      {pendingData && hippoTicket && (
        <HippoSyncModal
          content={t('common.alsoPostCommentToHippo', {
            ticketNumber: hippoTicket.number,
          })}
          syncContent={t('action.postToPlankaAndHippo')}
          onSync={handleHippoSync}
          onSkip={handleHippoSkip}
          onClose={handleHippoSyncClose}
        />
      )}
    </>
  );
});
```

- [ ] **Step 3: Ask before a ticket card's state changes**

In `client/src/components/custom-fields/CustomField/CustomField.jsx`:

1. Add `import { useTranslation } from 'react-i18next';` after the react-redux import, and `import HippoSyncModal from '../../hippo/HippoSyncModal';` after the TicketChip import.

2. After the `hippoTicket` selector, add `const canSyncToHippo = useSelector(selectors.selectCanSyncToHippoInCurrentBoard);`.

3. After `const dispatch = useDispatch();` add `const [t] = useTranslation();`. After the `isUrlEditing` state, add `const [pendingTicketState, setPendingTicketState] = useState(null);`.

4. After `isTicketUrlField`, add:

```js
  const isTicketStateField =
    !!hippoTicket &&
    hippoTicket.customFieldGroupId === customFieldGroupId &&
    hippoTicket.stateCustomFieldId === id;
```

5. Replace `saveValue` and `handleValueUpdate` with:

```js
  const saveValue = useCallback(
    (nextContent, syncToHippo = false) => {
      if (nextContent) {
        dispatch(
          entryActions.updateCustomFieldValue(
            cardId,
            customFieldGroupId,
            id,
            {
              content: nextContent,
            },
            {
              syncToHippo,
            },
          ),
        );
      } else {
        dispatch(entryActions.deleteCustomFieldValue(cardId, customFieldGroupId, id));
      }
    },
    [id, customFieldGroupId, cardId, dispatch],
  );

  // A new state may go to Hippo too, which the user decides first. Clearing never goes, since
  // Hippo has no empty status.
  const handleValueUpdate = useCallback(
    (nextContent) => {
      if (nextContent && isTicketStateField && canSyncToHippo) {
        setPendingTicketState(nextContent);
        return;
      }

      saveValue(nextContent);
    },
    [isTicketStateField, canSyncToHippo, saveValue],
  );

  const handleTicketStateSync = useCallback(() => {
    saveValue(pendingTicketState, true);
    setPendingTicketState(null);
  }, [pendingTicketState, saveValue]);

  const handleTicketStateSkip = useCallback(() => {
    saveValue(pendingTicketState);
    setPendingTicketState(null);
  }, [pendingTicketState, saveValue]);

  // The dropdown shows the saved value, so cancelling puts it back
  const handleTicketStateSyncClose = useCallback(() => {
    setPendingTicketState(null);
  }, []);
```

6. In the returned JSX, after the closing `</div>` of `valueWrapper` and before the outer closing `</div>`, insert:

```jsx
      {pendingTicketState && hippoTicket && (
        <HippoSyncModal
          content={t('common.changeHippoTicketStatus', {
            ticketNumber: hippoTicket.number,
            status: pendingTicketState,
          })}
          syncContent={t('action.updatePlankaAndHippo')}
          onSync={handleTicketStateSync}
          onSkip={handleTicketStateSkip}
          onClose={handleTicketStateSyncClose}
        />
      )}
```

- [ ] **Step 4: Add the strings**

Add these to `common`, each where it sorts alphabetically:

```js
      alsoPostCommentToHippo: 'Also post this comment to Hippo ticket #{{ticketNumber}} as a note?',
      changeHippoTicketStatus: 'Change Hippo ticket #{{ticketNumber}} status to "{{status}}"?',
      syncToHippo_title: 'Sync to Hippo',
```

Add these to `action`:

```js
      plankaOnly: 'Planka only',
      postToPlankaAndHippo: 'Post to Planka & Hippo',
      updatePlankaAndHippo: 'Update Planka & Hippo',
```

- [ ] **Step 5: Light checks**

Run: `cd client && npx eslint src/components/hippo src/components/comments/Comments/Add.jsx src/components/custom-fields/CustomField src/locales/en-US/core.js`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/hippo client/src/components/comments/Comments/Add.jsx client/src/components/custom-fields/CustomField/CustomField.jsx client/src/locales/en-US/core.js
git commit -m "hippo: confirm before comments and state changes reach Hippo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Ticket chip on card previews and both timelines

**Files:**
- Modify: `client/src/selectors/cards.js`
- Modify in `client/src/components/cards/Card/`: `ProjectContent.jsx`, `StoryContent.jsx`, `InlineContent.jsx`, `ProjectContent.module.scss`, `StoryContent.module.scss`, `InlineContent.module.scss`
- Modify: `client/src/components/boards/Board/TimelineView/TimelineView.jsx`
- Modify: `client/src/components/common/Home/TeamDashboardView/TeamTimeline.jsx`
- Modify in `client/src/components/common/TimelineChart/`: `TimelineChart.jsx`, `Bar.jsx`, `TimelineChart.module.scss`

**Interfaces:**
- Consumes: `getHippoTicketForCardModel` and `makeSelectHippoTicketByCardId` (Task 7); `HIPPO_GROUP_NAME` and `TICKET_CHIP_FIELD_NAMES` (Task 7); `TicketChip` (Task 8); the dashboard `card.ticketNumber` (Task 5).
- Produces:
  - Timeline items gain `ticketNumber?: string`.
  - The front-of-card custom field list no longer includes the Hippo `Ticket #` and `Ticket URL` fields.

- [ ] **Step 0: Impact check.** Run `gitnexus_impact` (upstream):
  - `makeSelectShownOnFrontOfCardCustomFieldValueIdsByCardId`: planning found LOW, with direct callers `ProjectContent.jsx` and `StoryContent.jsx`.
  - `selectTimelineCardsByIds`: callers `TimelineView.jsx` and `UnscheduledSidebar`. The change only adds a field.
  - `Bar`.

- [ ] **Step 1: Update the selectors**

In `client/src/selectors/cards.js`:

1. After the `isLocalId` import, add:

```js
import { getHippoTicketForCardModel } from './hippo';
import { HIPPO_GROUP_NAME, TICKET_CHIP_FIELD_NAMES } from '../utils/hippo';

// The ticket chip shows these two Hippo fields, so the custom field chips leave them out
const isShownAsTicketChip = (customFieldGroupModel, customFieldModel) =>
  customFieldGroupModel.name === HIPPO_GROUP_NAME &&
  TICKET_CHIP_FIELD_NAMES.includes(customFieldModel.name);
```

2. Inside `makeSelectShownOnFrontOfCardCustomFieldValueIdsByCardId`, the following snippet appears exactly twice (once for board groups, once for card groups). Replace both occurrences.

   Old:

```js
              .flatMap((customFieldModel) => {
                const customFieldValue = CustomFieldValue.withId(
```

   New:

```js
              .flatMap((customFieldModel) => {
                if (isShownAsTicketChip(customFieldGroupModel, customFieldModel)) {
                  return [];
                }

                const customFieldValue = CustomFieldValue.withId(
```

   Check: `grep -c "isShownAsTicketChip(customFieldGroupModel" client/src/selectors/cards.js` prints `2`.

3. In `selectTimelineCardsByIds`:
   - Change `({ Card }, ids) => {` to `({ Card, CustomFieldValue }, ids) => {`.
   - Before the `return {` that builds each card, add `const hippoTicket = getHippoTicketForCardModel(cardModel, CustomFieldValue);`.
   - After `tasksCompleted,` in that object, add `ticketNumber: hippoTicket ? hippoTicket.number : null,`.

- [ ] **Step 2: Show the chip before the name on card previews**

In each of `ProjectContent.jsx`, `StoryContent.jsx` and `InlineContent.jsx` (`client/src/components/cards/Card/`):

1. Import the chip after the last component import:

```js
import TicketChip from '../../hippo/TicketChip';
```

   In `InlineContent.jsx`, also change `import { useSelector } from 'react-redux';` to `import { shallowEqual, useSelector } from 'react-redux';`.

2. After the `selectCardById` memo, add:

```js
  const selectHippoTicketByCardId = useMemo(() => selectors.makeSelectHippoTicketByCardId(), []);
```

3. After the `card` selector, add:

```js
  // Compared by value: the ticket selector builds a new object whenever any field value changes
  const hippoTicket = useSelector(
    (state) => selectHippoTicketByCardId(state, cardId),
    shallowEqual,
  );
```

4. Put the chip in front of `{card.name}`:
   - In `ProjectContent.jsx`, replace `<div className={classNames(styles.name, card.isClosed && styles.nameClosed)}>{card.name}</div>` with:

```jsx
      <div className={classNames(styles.name, card.isClosed && styles.nameClosed)}>
        {hippoTicket && (
          <TicketChip
            number={hippoTicket.number}
            url={hippoTicket.url}
            className={styles.ticketChip}
          />
        )}
        {card.name}
      </div>
```

   - In `StoryContent.jsx`, inside the existing name `<div>`, add the same `{hippoTicket && (<TicketChip … />)}` block directly before `{card.name}`.
   - In `InlineContent.jsx`, replace `<div className={styles.hidable}>{card.name}</div>` with:

```jsx
        <div className={styles.hidable}>
          {hippoTicket && (
            <TicketChip
              number={hippoTicket.number}
              url={hippoTicket.url}
              className={styles.ticketChip}
            />
          )}
          {card.name}
        </div>
```

5. Add this rule to each component's `.module.scss`, in alphabetical position inside `:global(#app)`:

```scss
  .ticketChip {
    margin-right: 6px;
    vertical-align: 1px;
  }
```

- [ ] **Step 3: Pass the ticket number to both timelines**

- In `client/src/components/boards/Board/TimelineView/TimelineView.jsx`, in the `items` mapping, add `ticketNumber: card.ticketNumber || undefined,` after `seriesId: card.recurrenceId || undefined,`.
- In `client/src/components/common/Home/TeamDashboardView/TeamTimeline.jsx`, add the same line after `seriesId: card.recurrenceId || undefined,`. The value comes from `GET /api/dashboard` (Task 5).
- In `client/src/components/common/TimelineChart/TimelineChart.jsx`, add `ticketNumber: PropTypes.string,` after `seriesId: PropTypes.string,` in the `items` shape.

- [ ] **Step 4: Render it on the bars**

In `client/src/components/common/TimelineChart/Bar.jsx`, directly after the recurring-icon line inside `barLabel`, add:

```jsx
            {item.ticketNumber && <span className={styles.barTicket}>#{item.ticketNumber}</span>}
```

In `client/src/components/common/TimelineChart/TimelineChart.module.scss`, directly after the `.barRecurringIcon` rule, add:

```scss
  .barTicket {
    font-weight: bold;
    margin: 0 4px 0 0;
    opacity: 0.85;
  }
```

- [ ] **Step 5: Light checks**

Run:

```bash
cd client && npx eslint src/selectors/cards.js src/components/cards/Card src/components/boards/Board/TimelineView/TimelineView.jsx src/components/common/Home/TeamDashboardView/TeamTimeline.jsx src/components/common/TimelineChart && npx jest src/components/common
```

Expected: no eslint output, and the timeline and dashboard tests still pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/selectors/cards.js client/src/components/cards/Card client/src/components/boards/Board/TimelineView/TimelineView.jsx client/src/components/common/Home/TeamDashboardView/TeamTimeline.jsx client/src/components/common/TimelineChart
git commit -m "hippo: ticket chip on card previews and timelines" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Whole-branch verification and the manual test list

**Files:** none new. Fix whatever these checks report in the file it points at.

- [ ] **Step 1: Server lint and unit tests**

Run: `cd server && npm run lint && npx mocha test/utils/*.test.js`
Expected: `✔  Your .js files look good.`, then every util suite passes, including `hippo` (21) and `custom-fields` (10).

Do not run `npm test`: it lifts Sails against a database.

- [ ] **Step 2: Client lint, unit tests and build**

Run: `cd client && npm run lint && npx jest && npm run build`
Expected: lint is clean, all jest suites pass, and `vite build` finishes without errors.

- [ ] **Step 3: Scope check**

Run `gitnexus_detect_changes({scope: "compare", base_ref: "master", repo: "planka"})`. Confirm that the changed symbols are only those listed in this plan's File Map.

- [ ] **Step 4: Hand Shankar the manual test list**

Post this list to Shankar, adjusted to whatever the checks above turned up:

```
Setup
- cd server && npm run db:migrate  (adds custom_field.type/options, project.is_hippo_configured, project_hippo_config)

Project settings (as a project manager)
1. Settings → Integrations shows "not set up". Save a wrong key → "Hippo key saved"; Test connection → an error message (not a logout).
2. Save the real key → Test connection → "Hippo accepted the key". A board member who is not a manager sees no Integrations tab.
3. Remove → importing and the sync dialogs disappear. Put the key back.

Dropdown custom fields
4. Add a board custom field of type Dropdown with options A, B; pick B on a card; rename/remove option B → the card shows "B (removed option)".
5. Duplicate that card and move one to another board → the field is still a dropdown.

Import
6. Kanban list footer → ticket button → dialog opens with the ticket field focused. Enter 43886 → Fetch.
   - VERIFY FIRST: if this says "Hippo ticket not found" for a ticket that exists, Hippo's ticket_id wants its internal _id (spec §2 open assumption). Report it before going further.
7. Title, description (ending "— Imported from Hippo ticket #43886"), due date and members fill in; assignees not on the board are listed.
8. Paste the ticket's Hippo URL instead → same ticket; then a bare number of another ticket → its URL is built from the pattern.
9. Untick one note, change Ticket State, add the card → "Hippo Ticket" fields are set, ticked notes/comments appear as comments oldest first, the front shows "#43886" linking to Hippo, and no raw URL is shown.
10. Timeline view → Add card → the same Hippo field is there. Board timeline and Team Dashboard timeline bars show "#43886".

Sync back (as a board editor)
11. Comment on the ticket card → dialog: Post to Planka & Hippo → the note appears in Hippo, prefixed "<your name> (via Planka):", and its line breaks look right.
12. Planka only → comment in Planka only. Cancel → the draft stays in the box.
13. Change Ticket State → dialog: Update Planka & Hippo → Hippo status changes. Cancel → the dropdown shows the old state.
14. With Hippo unreachable (wrong key saved temporarily), sync → the Planka change stays and a toast offers Retry.
15. A viewer, or a commenter who is not an editor, sees no sync dialog and no import field.
```

- [ ] **Step 5: Final commit, only if Steps 1–3 required fixes**

```bash
git add -A
git commit -m "hippo: fixes from whole-branch checks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
