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
