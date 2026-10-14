/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from 'semantic-ui-react';
import { FilePicker } from '../../../lib/custom-ui';

import selectors from '../../../selectors';
import { buildAcceptAttribute } from '../../../utils/attachment-files';
import { isUrl } from '../../../utils/validator';
import AttachmentChip from '../../attachments/AttachmentChip';

import styles from './ComposerAttachments.module.scss';

const ComposerAttachments = React.memo(({ items, onFilesAdd, onLinkAdd, onRemove }) => {
  const allowedExtensions = useSelector(selectors.selectAllowedAttachmentExtensions);

  const [t] = useTranslation();
  const [isLinkFormOpened, setIsLinkFormOpened] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const linkUrlRef = useRef(null);

  const closeLinkForm = useCallback(() => {
    setIsLinkFormOpened(false);
    setLinkUrl('');
    setLinkName('');
  }, []);

  const submitLink = useCallback(() => {
    const url = linkUrl.trim();

    if (!isUrl(url)) {
      linkUrlRef.current.focus();
      return;
    }

    onLinkAdd({
      url,
      name: linkName.trim() || url,
    });

    closeLinkForm();
  }, [linkUrl, linkName, onLinkAdd, closeLinkForm]);

  const handleLinkButtonClick = useCallback(() => {
    setIsLinkFormOpened((prevIsOpened) => !prevIsOpened);
  }, []);

  const handleLinkUrlChange = useCallback((event) => {
    setLinkUrl(event.target.value);
  }, []);

  const handleLinkNameChange = useCallback((event) => {
    setLinkName(event.target.value);
  }, []);

  // Enter would submit the comment form; Escape only closes this row
  const handleLinkFieldKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitLink();
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        closeLinkForm();
      }
    },
    [submitLink, closeLinkForm],
  );

  return (
    <div className={styles.wrapper}>
      {items.length > 0 && (
        <div className={styles.chips}>
          {items.map(({ key, kind, name, previewUrl, isMarked }) => (
            <AttachmentChip
              key={key}
              kind={kind}
              name={name}
              previewUrl={previewUrl}
              isMarked={isMarked}
              onRemove={() => onRemove(key)}
            />
          ))}
        </div>
      )}
      {isLinkFormOpened && (
        <div className={styles.linkForm}>
          <input
            ref={linkUrlRef}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={linkUrl}
            placeholder={t('common.url')}
            maxLength={2048}
            className={styles.linkField}
            onChange={handleLinkUrlChange}
            onKeyDown={handleLinkFieldKeyDown}
          />
          <input
            value={linkName}
            placeholder={t('common.linkNameOptional')}
            maxLength={128}
            className={styles.linkField}
            onChange={handleLinkNameChange}
            onKeyDown={handleLinkFieldKeyDown}
          />
          <Button type="button" size="mini" content={t('action.addLink')} onClick={submitLink} />
        </div>
      )}
      <div className={styles.actions}>
        <FilePicker multiple accept={buildAcceptAttribute(allowedExtensions)} onSelect={onFilesAdd}>
          <button type="button" title={t('action.attachFile')} className={styles.action}>
            <Icon fitted name="attach" />
          </button>
        </FilePicker>
        <button
          type="button"
          title={t('action.addLink')}
          className={styles.action}
          onClick={handleLinkButtonClick}
        >
          <Icon fitted name="linkify" />
        </button>
      </div>
    </div>
  );
});

ComposerAttachments.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      kind: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      previewUrl: PropTypes.string,
      isMarked: PropTypes.bool,
    }),
  ).isRequired,
  onFilesAdd: PropTypes.func.isRequired,
  onLinkAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default ComposerAttachments;
