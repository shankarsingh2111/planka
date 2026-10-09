/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';
import { useDidUpdate } from '../../../../lib/hooks';

import selectors from '../../../../selectors';
import { usePopupInClosableContext } from '../../../../hooks';
import { isListArchiveOrTrash } from '../../../../utils/record-helpers';
import { HIPPO_GROUP_NAME, getHippoErrorText } from '../../../../utils/hippo';
import { BoardMembershipRoles } from '../../../../constants/Enums';
import CustomFieldGroup from '../../../custom-field-groups/CustomFieldGroup';
import CustomFieldGroupStep from '../../../custom-field-groups/CustomFieldGroupStep';
import TimeAgo from '../../../common/TimeAgo';
import useHippoCardSync from './use-hippo-card-sync';

import styles from './Item.module.scss';

const Item = React.memo(({ id, dragHandleProps }) => {
  const selectCustomFieldGroupById = useMemo(() => selectors.makeSelectCustomFieldGroupById(), []);
  const selectListById = useMemo(() => selectors.makeSelectListById(), []);

  const selectHasValues = useMemo(
    () => selectors.makeSelectHasValuesInCustomFieldGroupForCurrentCard(),
    [],
  );

  const customFieldGroup = useSelector((state) => selectCustomFieldGroupById(state, id));
  const hasValues = useSelector((state) => selectHasValues(state, id));
  const { cardId } = useSelector(selectors.selectPath);
  const hippoTicket = useSelector(selectors.selectHippoTicketForCurrentCard);
  const canSyncToHippo = useSelector(selectors.selectCanSyncToHippoInCurrentBoard);

  const canEdit = useSelector((state) => {
    if (customFieldGroup.boardId) {
      return false;
    }

    const { listId } = selectors.selectCurrentCard(state);
    const list = selectListById(state, listId);

    if (isListArchiveOrTrash(list)) {
      return false;
    }

    const boardMembership = selectors.selectCurrentUserMembershipForCurrentBoard(state);
    return !!boardMembership && boardMembership.role === BoardMembershipRoles.EDITOR;
  });

  // A Hippo Ticket section on a card not linked to a ticket stays out of the way until opened
  const isCollapsible = customFieldGroup.name === HIPPO_GROUP_NAME;

  // Editors sync the card with its ticket from here; the card holds its number in this group
  const isHippoGroup = isCollapsible && canSyncToHippo;
  const isLinked = !!hippoTicket && hippoTicket.customFieldGroupId === id;

  const [t] = useTranslation();
  const [hippoSync, syncWithHippoNow] = useHippoCardSync(cardId, isHippoGroup && isLinked);
  const isPull = !isLinked || hippoSync.hasSynced === false;
  const [isOpened, setIsOpened] = useState(!isCollapsible || hasValues);

  const handleToggleClick = useCallback(() => {
    setIsOpened((prevIsOpened) => !prevIsOpened);
  }, []);

  // Values that arrive while the card is open, from an import or another user, show at once
  useDidUpdate(() => {
    if (hasValues) {
      setIsOpened(true);
    }
  }, [hasValues]);

  const CustomFieldGroupPopup = usePopupInClosableContext(CustomFieldGroupStep);

  return (
    <div className={styles.wrapper}>
      <div className={styles.moduleWrapper}>
        <Icon name="sticky note outline" className={styles.moduleIcon} />
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <div {...dragHandleProps}>
          <div className={classNames(styles.moduleHeader, canEdit && styles.moduleHeaderEditable)}>
            {customFieldGroup.isPersisted && canEdit && (
              <CustomFieldGroupPopup id={customFieldGroup.id}>
                <Button className={styles.editButton}>
                  <Icon fitted name="pencil" size="small" />
                </Button>
              </CustomFieldGroupPopup>
            )}
            {isCollapsible ? (
              <>
                <button type="button" className={styles.toggleButton} onClick={handleToggleClick}>
                  <span className={styles.moduleHeaderTitle}>{customFieldGroup.name}</span>
                  <Icon
                    name={isOpened ? 'chevron up' : 'chevron down'}
                    className={styles.toggleIcon}
                  />
                </button>
                {isHippoGroup && (
                  <Button
                    basic
                    size="mini"
                    icon={isPull ? 'download' : 'sync'}
                    content={isPull ? t('action.pullFromHippo') : t('action.syncWithHippo')}
                    loading={hippoSync.isSyncing}
                    disabled={!isLinked || hippoSync.isSyncing}
                    className={styles.syncButton}
                    onClick={syncWithHippoNow}
                  />
                )}
              </>
            ) : (
              <span className={styles.moduleHeaderTitle}>{customFieldGroup.name}</span>
            )}
          </div>
        </div>
        {isHippoGroup && hippoSync.error && (
          <div className={styles.syncError}>{getHippoErrorText(hippoSync.error, t)}</div>
        )}
        {isHippoGroup && !hippoSync.error && hippoSync.syncedAt && (
          <div className={styles.syncStatus}>
            {t('common.syncedFromHippo')} <TimeAgo date={hippoSync.syncedAt} />
          </div>
        )}
        {isOpened && <CustomFieldGroup id={id} />}
      </div>
    </div>
  );
});

Item.propTypes = {
  id: PropTypes.string.isRequired,
  dragHandleProps: PropTypes.object, // eslint-disable-line react/forbid-prop-types
};

Item.defaultProps = {
  dragHandleProps: undefined,
};

export default Item;
