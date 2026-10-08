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
