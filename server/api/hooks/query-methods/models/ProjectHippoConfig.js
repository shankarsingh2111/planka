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
