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
import { HIPPO_FIELD_DEFINITIONS, HIPPO_GROUP_NAME, mergeFieldOptions } from '../../../utils/hippo';
import { isChoiceFieldType, splitMultiselectContent } from '../../../utils/custom-fields';
import { CustomFieldTypes } from '../../../constants/Enums';
import ToastTypes from '../../../constants/ToastTypes';

const getPicks = (definition, values) => {
  const value = values.find(({ name }) => name === definition.name);

  if (!value) {
    return [];
  }

  return definition.type === CustomFieldTypes.MULTISELECT
    ? splitMultiselectContent(value.content)
    : [value.content];
};

/**
 * Finds the board's "Hippo Ticket" group, creating it and whichever of its fields are missing. A
 * choice field takes the type it is defined with, and any default option or imported value it
 * does not offer yet joins its options. Returns the ids to set the values with, or null when the
 * server refused any of it.
 */
export function* ensureHippoFieldGroup(boardId, values) {
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
    const { defaultOptions, ...definition } = HIPPO_FIELD_DEFINITIONS[i];
    const isChoice = isChoiceFieldType(definition.type);
    const picks = isChoice ? getPicks(definition, values) : [];

    let customField = customFields.find(({ name }) => name === definition.name);

    if (!customField) {
      customField = yield call(createCustomFieldInGroup, customFieldGroupId, {
        ...definition,
        options: isChoice ? mergeFieldOptions(null, defaultOptions, picks) : null,
      });
    } else if (isChoice) {
      // A field made before it was a dropdown, such as Priority, turns into one
      const isSameType = customField.type === definition.type;

      const options = mergeFieldOptions(
        isSameType ? customField.options : null,
        defaultOptions,
        picks,
      );

      if (!isSameType || options.length !== (customField.options || []).length) {
        customField = yield call(updateCustomField, customField.id, {
          type: definition.type,
          options,
        });
      }
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
export function* importHippoTicketToCard(card, { values, commentTexts }) {
  const hippoFieldGroup = yield call(ensureHippoFieldGroup, card.boardId, values);

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
