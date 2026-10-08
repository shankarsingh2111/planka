/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import keyBy from 'lodash/keyBy';
import React, { useCallback, useState, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Mention, MentionsInput } from 'react-mentions';
import { Button, Form } from 'semantic-ui-react';
import { useClickAwayListener, useDidUpdate, useToggle } from '../../../lib/hooks';

import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import { useEscapeInterceptor, useForm, useNestedRef } from '../../../hooks';
import { isUsernameChar, mentionTextToMarkup } from '../../../utils/mentions';
import { isModifierKeyPressed } from '../../../utils/event-helpers';
import UserAvatar from '../../users/UserAvatar';
import HippoSyncModal from '../../hippo/HippoSyncModal';

import styles from './Add.module.scss';

const DEFAULT_DATA = {
  text: '',
};

const Add = React.memo(() => {
  const boardMemberships = useSelector(selectors.selectMembershipsForCurrentBoard);
  const hippoTicket = useSelector(selectors.selectHippoTicketForCurrentCard);
  const canSyncToHippo = useSelector(selectors.selectCanSyncToHippoInCurrentBoard);

  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [data, , setData] = useForm(DEFAULT_DATA);
  const [isOpened, setIsOpened] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [selectTextFieldState, selectTextField] = useToggle();

  const textFieldRef = useRef(null);
  const textMentionsRef = useRef(null);
  const textInputRef = useRef(null);
  const [buttonRef, handleButtonRef] = useNestedRef();

  const userByUsername = useMemo(
    () =>
      keyBy(
        boardMemberships.flatMap(({ user }) => (user.username ? user : [])),
        'username',
      ),
    [boardMemberships],
  );

  const createComment = useCallback(
    (cleanData, syncToHippo) => {
      dispatch(
        entryActions.createCommentInCurrentCard(cleanData, {
          syncToHippo,
        }),
      );

      setData(DEFAULT_DATA);
      selectTextField();
    },
    [dispatch, setData, selectTextField],
  );

  const submit = useCallback(() => {
    const cleanData = {
      ...data,
      text: mentionTextToMarkup(data.text.trim(), userByUsername),
    };

    if (!cleanData.text) {
      textInputRef.current.select();
      return;
    }

    // On a ticket card the user first decides whether the comment goes to Hippo too
    if (hippoTicket && canSyncToHippo) {
      setPendingData(cleanData);
      return;
    }

    createComment(cleanData, false);
  }, [data, userByUsername, hippoTicket, canSyncToHippo, createComment]);

  const handleHippoSync = useCallback(() => {
    createComment(pendingData, true);
    setPendingData(null);
  }, [pendingData, createComment]);

  const handleHippoSkip = useCallback(() => {
    createComment(pendingData, false);
    setPendingData(null);
  }, [pendingData, createComment]);

  // The draft stays in the box
  const handleHippoSyncClose = useCallback(() => {
    setPendingData(null);
  }, []);

  const handleEscape = useCallback(() => {
    if (textMentionsRef.current.isOpened()) {
      textMentionsRef.current.clearSuggestions();
      return;
    }

    setIsOpened(false);
    textInputRef.current.blur();
  }, []);

  const [activateEscapeInterceptor, deactivateEscapeInterceptor] =
    useEscapeInterceptor(handleEscape);

  const handleSubmit = useCallback(() => {
    submit();
  }, [submit]);

  const handleFieldFocus = useCallback(() => {
    setIsOpened(true);
  }, []);

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
      if (isModifierKeyPressed(event) && event.key === 'Enter') {
        submit();
      }
    },
    [submit],
  );

  const handleAwayClick = useCallback(() => {
    setIsOpened(false);
  }, []);

  const handleClickAwayCancel = useCallback(() => {
    textInputRef.current.focus();
  }, []);

  const clickAwayProps = useClickAwayListener(
    [textFieldRef, buttonRef],
    handleAwayClick,
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

  useDidUpdate(() => {
    if (isOpened) {
      activateEscapeInterceptor();
    } else {
      deactivateEscapeInterceptor();
    }
  }, [isOpened]);

  useDidUpdate(() => {
    textInputRef.current.focus();
  }, [selectTextFieldState]);

  return (
    <>
      <Form onSubmit={handleSubmit}>
        <div ref={textFieldRef} className={styles.field}>
          <MentionsInput
            {...clickAwayProps} // eslint-disable-line react/jsx-props-no-spreading
            allowSpaceInQuery
            allowSuggestionsAboveCursor
            ref={textMentionsRef}
            inputRef={textInputRef}
            value={data.text}
            placeholder={t('common.writeComment')}
            maxLength={1048576}
            rows={isOpened ? 3 : 1}
            className="mentions-input"
            style={{
              control: {
                minHeight: isOpened ? '79px' : '37px',
              },
            }}
            onFocus={handleFieldFocus}
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
        </div>
        {(isOpened || data.text.length > 0) && (
          <div className={styles.controls}>
            <Button
              {...clickAwayProps} // eslint-disable-line react/jsx-props-no-spreading
              positive
              ref={handleButtonRef}
              content={t('action.addComment')}
              className={styles.button}
            />
          </div>
        )}
      </Form>
      {pendingData && hippoTicket && (
        <HippoSyncModal
          content={t('common.alsoPostCommentToHippo', {
            ticketNumber: hippoTicket.number,
          })}
          syncContent={t('action.postToPlankaAndHippo')}
          onSync={handleHippoSync}
          onSkip={handleHippoSkip}
          onClose={handleHippoSyncClose}
        />
      )}
    </>
  );
});

export default Add;
