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
