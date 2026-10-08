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
import { BoardMembershipRoles, CustomFieldTypes } from '../../../constants/Enums';
import ValueField from './ValueField';
import DropdownValueField from './DropdownValueField';
import TicketChip from '../../hippo/TicketChip';
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
  const [isUrlEditing, setIsUrlEditing] = useState(false);
  const [pendingTicketState, setPendingTicketState] = useState(null);

  const content = customFieldValue ? customFieldValue.content : undefined;

  // The Ticket URL of a ticket card shows as its "#43886" link, editable behind a button
  const isTicketUrlField =
    !!hippoTicket &&
    hippoTicket.customFieldGroupId === customFieldGroupId &&
    hippoTicket.urlCustomFieldId === id;

  const isTicketStateField =
    !!hippoTicket &&
    hippoTicket.customFieldGroupId === customFieldGroupId &&
    hippoTicket.stateCustomFieldId === id;

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

  const handleUrlEditClick = useCallback(() => {
    setIsUrlEditing(true);
  }, []);

  const handleUrlEditClose = useCallback(() => {
    setIsUrlEditing(false);
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

  let valueNode;

  if (isTicketUrlField && content && !isUrlEditing) {
    valueNode = (
      <div className={styles.ticketValue}>
        <TicketChip number={hippoTicket.number} url={content} />
        {canEdit && (
          <Button className={styles.editButton} onClick={handleUrlEditClick}>
            <Icon fitted name="pencil" />
          </Button>
        )}
      </div>
    );
  } else if (!canEdit) {
    valueNode = <div className={styles.value}>{content || ' '}</div>;
  } else if (customField.type === CustomFieldTypes.DROPDOWN) {
    valueNode = (
      <DropdownValueField
        defaultValue={content}
        options={customField.options || []}
        disabled={!customField.isPersisted}
        onUpdate={handleValueUpdate}
      />
    );
  } else {
    valueNode = (
      <ValueField
        defaultValue={content}
        autoFocus={isUrlEditing}
        disabled={!customField.isPersisted}
        onUpdate={handleValueUpdate}
        onClose={isUrlEditing ? handleUrlEditClose : undefined}
      />
    );
  }

  return (
    <div>
      <div className={styles.name}>{customField.name}</div>
      <div className={styles.valueWrapper}>
        {valueNode}
        {content && (
          <Button className={styles.copyButton} onClick={handleCopyClick}>
            <Icon fitted name={isCopied ? 'check' : 'copy'} />
          </Button>
        )}
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
