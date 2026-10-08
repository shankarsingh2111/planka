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
