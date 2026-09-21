/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Mirrors the visibility rules of projects/index: project managers see every board of their
// projects, admins see every board of shared projects, everyone else sees membership boards.

module.exports = {
  inputs: {
    user: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const { user } = inputs;

    const managerProjectIds = await sails.helpers.users.getManagerProjectIds(user.id);
    const fullyVisibleProjectIds = [...managerProjectIds];

    if (user.role === User.Roles.ADMIN) {
      const sharedProjects = await Project.qm.getShared({
        exceptIdOrIds: managerProjectIds,
      });

      fullyVisibleProjectIds.push(...sails.helpers.utils.mapRecords(sharedProjects));
    }

    const boardMemberships = await BoardMembership.qm.getByUserId(user.id);
    const membershipBoardIds = sails.helpers.utils.mapRecords(boardMemberships, 'boardId');

    const membershipBoards = await Board.qm.getByIds(membershipBoardIds, {
      exceptProjectIdOrIds: fullyVisibleProjectIds,
    });

    const fullyVisibleBoards = await Board.qm.getByProjectIds(fullyVisibleProjectIds);

    return [...fullyVisibleBoards, ...membershipBoards];
  },
};
