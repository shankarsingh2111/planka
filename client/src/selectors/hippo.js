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

    const customFieldModelByName = keyBy(customFieldGroupModel.getCustomFieldsModelArray(), 'name');

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
