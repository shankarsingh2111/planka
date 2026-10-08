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
