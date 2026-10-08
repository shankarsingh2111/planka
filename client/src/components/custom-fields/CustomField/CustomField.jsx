/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { buildCustomFieldValueId } from '../../../models/CustomFieldValue';
import { isListArchiveOrTrash } from '../../../utils/record-helpers';
import { isChoiceFieldType } from '../../../utils/custom-fields';
import { getTicketUrl } from '../../../utils/hippo';
import { BoardMembershipRoles, CustomFieldTypes } from '../../../constants/Enums';
import ValueField from './ValueField';
import DropdownValueField from './DropdownValueField';
import HippoSyncModal from '../../hippo/HippoSyncModal';

import styles from './CustomField.module.scss';

const CustomField = React.memo(({ id, customFieldGroupId }) => {
  const selectCustomFieldById = useMemo(() => selectors.makeSelectCustomFieldById(), []);
  const selectCustomFieldValueById = useMemo(() => selectors.makeSelectCustomFieldValueById(), []);
  const selectListById = useMemo(() => selectors.makeSelectListById(), []);

  const { cardId } = useSelector(selectors.selectPath);
  const customField = useSelector((state) => selectCustomFieldById(state, id));

  const customFieldValue = useSelector((state) =>
    selectCustomFieldValueById(
      state,
      buildCustomFieldValueId({
        cardId,
        customFieldGroupId,
        customFieldId: id,
      }),
    ),
  );

  const hippoTicket = useSelector(selectors.selectHippoTicketForCurrentCard);
  const canSyncToHippo = useSelector(selectors.selectCanSyncToHippoInCurrentBoard);

  const canEdit = useSelector((state) => {
    const { listId } = selectors.selectCurrentCard(state);
    const list = selectListById(state, listId);

    if (isListArchiveOrTrash(list)) {
      return false;
    }

    const boardMembership = selectors.selectCurrentUserMembershipForCurrentBoard(state);
    return !!boardMembership && boardMembership.role === BoardMembershipRoles.EDITOR;
  });

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const [pendingTicketState, setPendingTicketState] = useState(null);

  const content = customFieldValue ? customFieldValue.content : undefined;

  const isHippoField = !!hippoTicket && hippoTicket.customFieldGroupId === customFieldGroupId;

  // A ticket card's Ticket URL is reached from its Ticket # instead, so it is not shown
  const isTicketUrlField = isHippoField && hippoTicket.urlCustomFieldId === id;
  const isTicketNumberField = isHippoField && hippoTicket.numberCustomFieldId === id;
  const isTicketStateField = isHippoField && hippoTicket.stateCustomFieldId === id;

  const ticketUrl = isTicketNumberField ? getTicketUrl(hippoTicket.url, hippoTicket.number) : null;
  const isChoiceField = isChoiceFieldType(customField.type);

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

  const handleCopyClick = useCallback(() => {
    if (isCopied) {
      return;
    }

    navigator.clipboard.writeText(content);

    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  }, [content, isCopied]);

  if (isTicketUrlField) {
    return null;
  }

  let valueNode;

  if (!canEdit) {
    valueNode = <div className={styles.value}>{content || ' '}</div>;
  } else if (isChoiceField) {
    // Hippo always has a state and a priority, so its fields are never cleared from here
    valueNode = (
      <DropdownValueField
        defaultValue={content}
        options={customField.options || []}
        multiple={customField.type === CustomFieldTypes.MULTISELECT}
        clearable={!isHippoField}
        disabled={!customField.isPersisted}
        onUpdate={handleValueUpdate}
      />
    );
  } else {
    valueNode = (
      <ValueField
        defaultValue={content}
        disabled={!customField.isPersisted}
        onUpdate={handleValueUpdate}
      />
    );
  }

  // A picked option has nothing worth copying, and a ticket number opens its ticket instead
  let sideButtonNode = null;

  if (ticketUrl) {
    sideButtonNode = (
      <Button
        as="a"
        href={ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={t('action.openInHippo')}
        className={styles.linkButton}
      >
        <Icon fitted name="external alternate" />
      </Button>
    );
  } else if (content && !isTicketNumberField && !isChoiceField) {
    sideButtonNode = (
      <Button className={styles.copyButton} onClick={handleCopyClick}>
        <Icon fitted name={isCopied ? 'check' : 'copy'} />
      </Button>
    );
  }

  return (
    <div>
      <div className={styles.name}>{customField.name}</div>
      <div className={styles.valueWrapper}>
        {valueNode}
        {sideButtonNode}
      </div>
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
    </div>
  );
});

CustomField.propTypes = {
  id: PropTypes.string.isRequired,
  customFieldGroupId: PropTypes.string.isRequired,
};

export default CustomField;
