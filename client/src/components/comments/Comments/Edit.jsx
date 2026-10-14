/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { dequal } from 'dequal';
import { keyBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Mention, MentionsInput } from 'react-mentions';
import { Button, Form } from 'semantic-ui-react';
import { useClickAwayListener } from '../../../lib/hooks';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { useForm, useNestedRef } from '../../../hooks';
import { isUsernameChar, mentionTextToMarkup } from '../../../utils/mentions';
import { focusEnd } from '../../../utils/element-helpers';
import { isModifierKeyPressed } from '../../../utils/event-helpers';
import { FORMAT_BY_SHORTCUT_KEY } from '../../../utils/markdown-format';
import UserAvatar from '../../users/UserAvatar';
import { getStoredAttachmentChipProps } from '../../attachments/AttachmentChip';
import {
  ComposerAttachments,
  FormattingToolbar,
  useAttachmentDropTarget,
  useMarkdownFormatting,
  usePendingAttachments,
} from '../CommentComposer';

import styles from './Edit.module.scss';

const Edit = React.memo(({ commentId, onClose }) => {
  const selectCommentById = useMemo(() => selectors.makeSelectCommentById(), []);
  const selectAttachmentsByCommentId = useMemo(
    () => selectors.makeSelectAttachmentsByCommentId(),
    [],
  );

  const comment = useSelector((state) => selectCommentById(state, commentId));
  const boardMemberships = useSelector(selectors.selectMembershipsForCurrentBoard);
  const attachments = useSelector((state) => selectAttachmentsByCommentId(state, commentId));

  const dispatch = useDispatch();
  const [t] = useTranslation();

  const defaultData = useMemo(
    () => ({
      text: comment.text,
    }),
    [comment.text],
  );

  const [data, , setData] = useForm(() => ({
    text: '',
    ...defaultData,
  }));

  const textFieldRef = useRef(null);
  const textMentionsRef = useRef(null);
  const textInputRef = useRef(null);
  const [submitButtonRef, handleSubmitButtonRef] = useNestedRef();
  const [cancelButtonRef, handleCancelButtonRef] = useNestedRef();

  const pendingAttachments = usePendingAttachments();
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState(() => new Set());

  const setText = useCallback(
    (text) => {
      setData({
        text,
      });
    },
    [setData],
  );

  const applyFormat = useMarkdownFormatting(textInputRef, data.text, setText);

  useAttachmentDropTarget(textFieldRef, pendingAttachments.addFiles);

  const userByUsername = useMemo(
    () =>
      keyBy(
        boardMemberships.flatMap(({ user }) => (user.username ? user : [])),
        'username',
      ),
    [boardMemberships],
  );

  const submit = useCallback(() => {
    const cleanData = {
      ...data,
      text: mentionTextToMarkup(data.text.trim(), userByUsername),
    };

    const isTextChanged = !dequal(cleanData, defaultData);
    const removeAttachmentIds = [...removedAttachmentIds];
    const addAttachments = pendingAttachments.toData();

    const attachmentsTotal =
      attachments.length - removeAttachmentIds.length + addAttachments.length;

    // A comment left with neither text nor attachments keeps what it had
    if (cleanData.text || attachmentsTotal > 0) {
      if (isTextChanged || removeAttachmentIds.length > 0 || addAttachments.length > 0) {
        dispatch(
          entryActions.updateComment(commentId, isTextChanged ? cleanData : null, {
            addAttachments,
            removeAttachmentIds,
          }),
        );
      }
    }

    pendingAttachments.clear();
    onClose();
  }, [
    commentId,
    onClose,
    dispatch,
    defaultData,
    data,
    userByUsername,
    attachments,
    removedAttachmentIds,
    pendingAttachments,
  ]);

  const handleSubmit = useCallback(() => {
    submit();
  }, [submit]);

  const handleFieldChange = useCallback(
    (_, text) => {
      setData({
        text: !isUsernameChar(text.slice(-1)) ? mentionTextToMarkup(text, userByUsername) : text,
      });
    },
    [setData, userByUsername],
  );

  const handleFieldKeyDown = useCallback(
    (event) => {
      if (isModifierKeyPressed(event)) {
        if (event.key === 'Enter') {
          submit();
          return;
        }

        const format = FORMAT_BY_SHORTCUT_KEY[event.key.toLowerCase()];

        if (format) {
          event.preventDefault();
          applyFormat(format);
        }
      } else if (event.key === 'Escape') {
        if (textMentionsRef.current.isOpened()) {
          textMentionsRef.current.clearSuggestions();
          return;
        }

        onClose();
      }
    },
    [onClose, submit, applyFormat],
  );

  const handleCancelClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleClickAwayCancel = useCallback(() => {
    textInputRef.current.focus();
  }, []);

  const clickAwayProps = useClickAwayListener(
    [textFieldRef, submitButtonRef, cancelButtonRef],
    submit,
    handleClickAwayCancel,
  );

  const suggestionRenderer = useCallback(
    (entry, _, highlightedDisplay) => (
      <div className={styles.suggestion}>
        <UserAvatar id={entry.id} size="tiny" />
        {highlightedDisplay}
      </div>
    ),
    [],
  );

  const handleAttachmentRemove = useCallback(
    (key) => {
      if (attachments.some(({ id }) => id === key)) {
        setRemovedAttachmentIds((prevIds) => {
          const nextIds = new Set(prevIds);

          if (nextIds.has(key)) {
            nextIds.delete(key);
          } else {
            nextIds.add(key);
          }

          return nextIds;
        });
      } else {
        pendingAttachments.remove(key);
      }
    },
    [attachments, pendingAttachments],
  );

  useEffect(() => {
    focusEnd(textInputRef.current);
  }, []);

  const attachmentItems = [
    ...attachments
      .filter(({ isPersisted }) => isPersisted)
      .map((attachment) => ({
        key: attachment.id,
        ...getStoredAttachmentChipProps(attachment),
        isMarked: removedAttachmentIds.has(attachment.id),
      })),
    ...pendingAttachments.items.map(({ localId, kind, name, previewUrl }) => ({
      key: localId,
      kind,
      name,
      previewUrl,
    })),
  ];

  return (
    <Form onSubmit={handleSubmit}>
      <div ref={textFieldRef} className={styles.field} onPaste={pendingAttachments.handlePaste}>
        <FormattingToolbar onFormat={applyFormat} />
        <MentionsInput
          {...clickAwayProps} // eslint-disable-line react/jsx-props-no-spreading
          allowSpaceInQuery
          allowSuggestionsAboveCursor
          ref={textMentionsRef}
          inputRef={textInputRef}
          value={data.text}
          maxLength={1048576}
          rows={3}
          className="mentions-input"
          style={{
            control: {
              minHeight: '79px',
            },
          }}
          onChange={handleFieldChange}
          onKeyDown={handleFieldKeyDown}
        >
          <Mention
            appendSpaceOnAdd
            data={boardMemberships.map(({ user }) => ({
              id: user.id,
              display: user.username || user.name,
            }))}
            displayTransform={(_, display) => `@${display}`}
            renderSuggestion={suggestionRenderer}
            className={styles.mention}
          />
        </MentionsInput>
        <ComposerAttachments
          items={attachmentItems}
          onFilesAdd={pendingAttachments.addFiles}
          onLinkAdd={pendingAttachments.addLink}
          onRemove={handleAttachmentRemove}
        />
      </div>
      <div className={styles.controls}>
        <Button
          {...clickAwayProps} // eslint-disable-line react/jsx-props-no-spreading
          positive
          ref={handleSubmitButtonRef}
          content={t('action.save')}
        />
        <Button
          {...clickAwayProps} // eslint-disable-line react/jsx-props-no-spreading
          ref={handleCancelButtonRef}
          type="button"
          content={t('action.cancel')}
          onClick={handleCancelClick}
        />
      </div>
    </Form>
  );
});

Edit.propTypes = {
  commentId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default Edit;
