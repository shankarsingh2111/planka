/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import TextareaAutosize from 'react-textarea-autosize';
import { Button, Grid, Icon, TextArea } from 'semantic-ui-react';
import { useDidUpdate } from '../../../lib/hooks';

import selectors from '../../../selectors';
import { useForm, useNestedRef, usePopupInClosableContext } from '../../../hooks';
import { isUsableMarkdownElement } from '../../../utils/element-helpers';
import { ListTypeStates } from '../../../constants/Enums';
import LIST_TYPE_STATE_BY_TYPE from '../../../constants/ListTypeStateByType';
import { CardTypeIcons } from '../../../constants/Icons';
import { ClosableContext } from '../../../contexts';
import { areDatesInOrder, buildCardData } from './card-data';
import DueDateChip from '../DueDateChip';
import StartDateChip from '../StartDateChip';
import EditDueDateStep from '../EditDueDateStep';
import EditStartDateStep from '../EditStartDateStep';
import ExpandableMarkdown from '../../common/ExpandableMarkdown';
import EditMarkdown from '../../common/EditMarkdown';
import UserAvatar from '../../users/UserAvatar';
import BoardMembershipsStep from '../../board-memberships/BoardMembershipsStep';
import LabelChip from '../../labels/LabelChip';
import LabelsStep from '../../labels/LabelsStep';
import ListsStep from '../../lists/ListsStep';

import cardStyles from '../CardModal/ProjectContent.module.scss';
import nameFieldStyles from '../CardModal/NameField.module.scss';
import styles from './Content.module.scss';

const Content = React.memo(({ defaultData, onCreate, onClose }) => {
  const { defaultCardType } = useSelector(selectors.selectCurrentBoard);
  const lists = useSelector(selectors.selectAvailableListsForCurrentBoard);
  const memberships = useSelector(selectors.selectMembershipsForCurrentBoard);
  const labels = useSelector(selectors.selectLabelsForCurrentBoard);

  const [t] = useTranslation();
  const [descriptionDraft, setDescriptionDraft] = useState(null);
  const [isEditDescriptionOpened, setIsEditDescriptionOpened] = useState(false);
  const [, , setIsClosableActive] = useContext(ClosableContext);

  const [data, handleFieldChange, setData] = useForm(() => ({
    listId: defaultData.listId,
    name: '',
    description: null,
    startDate: defaultData.startDate || null,
    dueDate: defaultData.dueDate || null,
    userIds: defaultData.userIds || [],
    labelIds: defaultData.labelIds || [],
  }));

  const [nameFieldRef, handleNameFieldRef] = useNestedRef();

  // The board can change under an open dialog: a list, member or label picked here may be gone
  // by the time the card is added, and a label can even be deleted from inside its own popup
  const list = lists.find((item) => item.id === data.listId) || lists[0];

  const userIds = useMemo(
    () =>
      data.userIds.filter((userId) =>
        memberships.some((membership) => membership.user.id === userId),
      ),
    [data.userIds, memberships],
  );

  const labelIds = useMemo(
    () => data.labelIds.filter((labelId) => labels.some((label) => label.id === labelId)),
    [data.labelIds, labels],
  );

  const isClosed = !!list && LIST_TYPE_STATE_BY_TYPE[list.type] === ListTypeStates.CLOSED;
  const isDatesOrderValid = areDatesInOrder(data.startDate, data.dueDate);
  const canCreate = !!list && isDatesOrderValid;

  // Edits build on the previous state, so quick successive picks in a popup never undo each other
  const setField = useCallback(
    (fieldName, value) => {
      setData((prevData) => ({
        ...prevData,
        [fieldName]: value,
      }));
    },
    [setData],
  );

  const addToField = useCallback(
    (fieldName, id) => {
      setData((prevData) => ({
        ...prevData,
        [fieldName]: [...prevData[fieldName], id],
      }));
    },
    [setData],
  );

  const removeFromField = useCallback(
    (fieldName, id) => {
      setData((prevData) => ({
        ...prevData,
        [fieldName]: prevData[fieldName].filter((item) => item !== id),
      }));
    },
    [setData],
  );

  const handleListSelect = useCallback((listId) => setField('listId', listId), [setField]);
  const handleUserSelect = useCallback((userId) => addToField('userIds', userId), [addToField]);

  const handleUserDeselect = useCallback(
    (userId) => removeFromField('userIds', userId),
    [removeFromField],
  );

  const handleLabelSelect = useCallback((labelId) => addToField('labelIds', labelId), [addToField]);

  const handleLabelDeselect = useCallback(
    (labelId) => removeFromField('labelIds', labelId),
    [removeFromField],
  );

  const handleStartDateUpdate = useCallback((value) => setField('startDate', value), [setField]);
  const handleDueDateUpdate = useCallback((value) => setField('dueDate', value), [setField]);

  const handleDescriptionUpdate = useCallback(
    (description) => setField('description', description),
    [setField],
  );

  const handleEditDescriptionClick = useCallback((event) => {
    if (window.getSelection().toString() || isUsableMarkdownElement(event.target)) {
      return;
    }

    setIsEditDescriptionOpened(true);
  }, []);

  const handleEditDescriptionClose = useCallback((nextDescriptionDraft) => {
    setDescriptionDraft(nextDescriptionDraft);
    setIsEditDescriptionOpened(false);
  }, []);

  const submit = useCallback(() => {
    if (!canCreate) {
      return;
    }

    if (!data.name.trim()) {
      nameFieldRef.current.focus();
      return;
    }

    onCreate(
      list.id,
      buildCardData({
        ...data,
        type: defaultCardType,
      }),
      {
        userIds,
        labelIds,
      },
    );

    onClose();
  }, [
    onCreate,
    onClose,
    defaultCardType,
    data,
    list,
    userIds,
    labelIds,
    canCreate,
    nameFieldRef,
  ]);

  const handleNameKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  useEffect(() => {
    nameFieldRef.current.focus();
  }, [nameFieldRef]);

  useDidUpdate(() => {
    setIsClosableActive(isEditDescriptionOpened);
  }, [isEditDescriptionOpened]);

  const BoardMembershipsPopup = usePopupInClosableContext(BoardMembershipsStep);
  const LabelsPopup = usePopupInClosableContext(LabelsStep);
  const ListsPopup = usePopupInClosableContext(ListsStep);
  const EditStartDatePopup = usePopupInClosableContext(EditStartDateStep);
  const EditDueDatePopup = usePopupInClosableContext(EditDueDateStep);

  return (
    <Grid className={cardStyles.wrapper}>
      <Grid.Row className={cardStyles.headerPadding}>
        <Grid.Column width={16} className={cardStyles.headerPadding}>
          <div className={cardStyles.headerWrapper}>
            <Icon name={CardTypeIcons[defaultCardType]} className={cardStyles.moduleIcon} />
            <div className={cardStyles.headerTitleWrapper}>
              <TextArea
                ref={handleNameFieldRef}
                as={TextareaAutosize}
                name="name"
                value={data.name}
                placeholder={t('common.enterCardTitle')}
                maxLength={1024}
                className={classNames(nameFieldStyles.field, nameFieldStyles.fieldMedium)}
                onKeyDown={handleNameKeyDown}
                onChange={handleFieldChange}
              />
            </div>
          </div>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row className={cardStyles.modalPadding}>
        <Grid.Column width={12} className={cardStyles.contentPadding}>
          {(userIds.length > 0 || labelIds.length > 0 || data.startDate || data.dueDate) && (
            <div className={cardStyles.moduleWrapper}>
              {userIds.length > 0 && (
                <div className={cardStyles.attachments}>
                  <div className={cardStyles.text}>
                    {t('common.members', {
                      context: 'title',
                    })}
                  </div>
                  {userIds.map((userId) => (
                    <span key={userId} className={cardStyles.attachment}>
                      <BoardMembershipsPopup
                        currentUserIds={userIds}
                        onUserSelect={handleUserSelect}
                        onUserDeselect={handleUserDeselect}
                      >
                        <UserAvatar id={userId} />
                      </BoardMembershipsPopup>
                    </span>
                  ))}
                  <BoardMembershipsPopup
                    currentUserIds={userIds}
                    onUserSelect={handleUserSelect}
                    onUserDeselect={handleUserDeselect}
                  >
                    <button
                      type="button"
                      className={classNames(cardStyles.attachment, cardStyles.dueDate)}
                    >
                      <Icon name="add" size="small" className={cardStyles.addAttachment} />
                    </button>
                  </BoardMembershipsPopup>
                </div>
              )}
              {labelIds.length > 0 && (
                <div className={cardStyles.attachments}>
                  <div className={cardStyles.text}>
                    {t('common.labels', {
                      context: 'title',
                    })}
                  </div>
                  {labelIds.map((labelId) => (
                    <span key={labelId} className={cardStyles.attachment}>
                      <LabelsPopup
                        currentIds={labelIds}
                        onSelect={handleLabelSelect}
                        onDeselect={handleLabelDeselect}
                      >
                        <LabelChip id={labelId} />
                      </LabelsPopup>
                    </span>
                  ))}
                  <LabelsPopup
                    currentIds={labelIds}
                    onSelect={handleLabelSelect}
                    onDeselect={handleLabelDeselect}
                  >
                    <button
                      type="button"
                      className={classNames(cardStyles.attachment, cardStyles.dueDate)}
                    >
                      <Icon name="add" size="small" className={cardStyles.addAttachment} />
                    </button>
                  </LabelsPopup>
                </div>
              )}
              {data.startDate && (
                <div className={cardStyles.attachments}>
                  <div className={cardStyles.text}>
                    {t('common.startDate', {
                      context: 'title',
                    })}
                  </div>
                  <span className={classNames(cardStyles.attachment, cardStyles.attachmentDueDate)}>
                    <EditStartDatePopup
                      defaultValue={data.startDate}
                      onUpdate={handleStartDateUpdate}
                    >
                      <StartDateChip value={data.startDate} />
                    </EditStartDatePopup>
                  </span>
                </div>
              )}
              {data.dueDate && (
                <div className={cardStyles.attachments}>
                  <div className={cardStyles.text}>
                    {t('common.dueDate', {
                      context: 'title',
                    })}
                  </div>
                  <span className={classNames(cardStyles.attachment, cardStyles.attachmentDueDate)}>
                    <EditDueDatePopup defaultValue={data.dueDate} onUpdate={handleDueDateUpdate}>
                      <DueDateChip
                        withStatusIcon
                        value={data.dueDate}
                        isCompleted={false}
                        withStatus={!isClosed}
                      />
                    </EditDueDatePopup>
                  </span>
                </div>
              )}
              {!isDatesOrderValid && (
                <div className={styles.error}>{t('common.startDateMustNotBeAfterDueDate')}</div>
              )}
            </div>
          )}
          <div className={classNames(cardStyles.contentModule, cardStyles.contentModuleDescription)}>
            <div className={cardStyles.moduleWrapper}>
              <Icon name="align left" className={cardStyles.moduleIcon} />
              <div className={cardStyles.moduleHeader}>
                {t('common.description')}
                {!isEditDescriptionOpened && descriptionDraft && (
                  <span className={cardStyles.draftChip}>{t('common.unsavedChanges')}</span>
                )}
              </div>
              {isEditDescriptionOpened && (
                <EditMarkdown
                  defaultValue={data.description}
                  draftValue={descriptionDraft}
                  placeholder="common.enterDescription"
                  onUpdate={handleDescriptionUpdate}
                  onClose={handleEditDescriptionClose}
                />
              )}
              {!isEditDescriptionOpened &&
                (data.description ? (
                  /* eslint-disable-next-line jsx-a11y/click-events-have-key-events,
                                              jsx-a11y/no-static-element-interactions */
                  <div className={cardStyles.cursorPointer} onClick={handleEditDescriptionClick}>
                    <Button className={cardStyles.editButton}>
                      <Icon fitted name="pencil" size="small" />
                    </Button>
                    <ExpandableMarkdown>{data.description}</ExpandableMarkdown>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={cardStyles.descriptionButton}
                    onClick={handleEditDescriptionClick}
                  >
                    <span className={cardStyles.descriptionButtonText}>
                      {t('action.addMoreDetailedDescription')}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </Grid.Column>
        <Grid.Column width={4} className={cardStyles.sidebarPadding}>
          <div className={cardStyles.sticky}>
            <div className={cardStyles.actions}>
              <div className={classNames(cardStyles.attachments, cardStyles.attachmentsList)}>
                <div className={classNames(cardStyles.text, cardStyles.textList)}>
                  {t('common.list')}
                </div>
                {list && (
                  <ListsPopup currentId={list.id} onSelect={handleListSelect}>
                    <button type="button" className={cardStyles.listButton}>
                      <span className={classNames(cardStyles.list, cardStyles.listHoverable)}>
                        <Icon name="columns" size="small" className={cardStyles.listIcon} />
                        <span className={cardStyles.hidable}>
                          {list.name || t(`common.${list.type}`)}
                        </span>
                      </span>
                    </button>
                  </ListsPopup>
                )}
              </div>
            </div>
            <div className={cardStyles.actions}>
              <span className={cardStyles.actionsTitle}>{t('action.addToCard')}</span>
              <BoardMembershipsPopup
                currentUserIds={userIds}
                onUserSelect={handleUserSelect}
                onUserDeselect={handleUserDeselect}
              >
                <Button fluid className={classNames(cardStyles.actionButton, cardStyles.hidable)}>
                  <Icon name="user outline" className={cardStyles.actionIcon} />
                  {t('common.members')}
                </Button>
              </BoardMembershipsPopup>
              <LabelsPopup
                currentIds={labelIds}
                onSelect={handleLabelSelect}
                onDeselect={handleLabelDeselect}
              >
                <Button fluid className={classNames(cardStyles.actionButton, cardStyles.hidable)}>
                  <Icon name="bookmark outline" className={cardStyles.actionIcon} />
                  {t('common.labels')}
                </Button>
              </LabelsPopup>
              <EditStartDatePopup defaultValue={data.startDate} onUpdate={handleStartDateUpdate}>
                <Button fluid className={classNames(cardStyles.actionButton, cardStyles.hidable)}>
                  <Icon name="calendar outline" className={cardStyles.actionIcon} />
                  {t('common.startDate', {
                    context: 'title',
                  })}
                </Button>
              </EditStartDatePopup>
              <EditDueDatePopup defaultValue={data.dueDate} onUpdate={handleDueDateUpdate}>
                <Button fluid className={classNames(cardStyles.actionButton, cardStyles.hidable)}>
                  <Icon name="calendar check outline" className={cardStyles.actionIcon} />
                  {t('common.dueDate', {
                    context: 'title',
                  })}
                </Button>
              </EditDueDatePopup>
            </div>
            <div className={cardStyles.actions}>
              <Button
                positive
                fluid
                disabled={!canCreate}
                content={t('action.addCard')}
                className={styles.submitButton}
                onClick={submit}
              />
              <Button
                fluid
                content={t('action.cancel')}
                className={classNames(cardStyles.actionButton, styles.cancelButton)}
                onClick={onClose}
              />
            </div>
          </div>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
});

Content.propTypes = {
  defaultData: PropTypes.shape({
    listId: PropTypes.string.isRequired,
    startDate: PropTypes.instanceOf(Date),
    dueDate: PropTypes.instanceOf(Date),
    userIds: PropTypes.arrayOf(PropTypes.string),
    labelIds: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onCreate: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default Content;
