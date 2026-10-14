/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Icon, Loader } from 'semantic-ui-react';

import { AttachmentTypes } from '../../../constants/Enums';

import styles from './AttachmentChip.module.scss';

export const AttachmentKinds = {
  IMAGE: 'image',
  PDF: 'pdf',
  FILE: 'file',
  LINK: 'link',
};

const ICON_BY_KIND = {
  [AttachmentKinds.IMAGE]: 'file image outline',
  [AttachmentKinds.PDF]: 'file pdf outline',
  [AttachmentKinds.FILE]: 'file outline',
  [AttachmentKinds.LINK]: 'linkify',
};

export const getAttachmentKind = ({ type, mimeType, isImage }) => {
  if (type === AttachmentTypes.LINK) {
    return AttachmentKinds.LINK;
  }

  if (isImage) {
    return AttachmentKinds.IMAGE;
  }

  return mimeType === 'application/pdf' ? AttachmentKinds.PDF : AttachmentKinds.FILE;
};

// For an attachment from the store; one still uploading has no data yet
export const getStoredAttachmentChipProps = (attachment) => ({
  kind: getAttachmentKind({
    type: attachment.type,
    mimeType: attachment.data && attachment.data.mimeType,
    isImage: !!(attachment.data && attachment.data.image),
  }),
  name: attachment.name,
  previewUrl:
    attachment.data && attachment.data.thumbnailUrls
      ? attachment.data.thumbnailUrls.outside360
      : undefined,
});

const AttachmentChip = React.forwardRef(
  ({ kind, name, previewUrl, isSubmitting, isMarked, onClick, onRemove }, ref) => {
    const [t] = useTranslation();

    const handleRemoveClick = useCallback(
      (event) => {
        event.stopPropagation();
        onRemove();
      },
      [onRemove],
    );

    const handleRemoveKeyDown = useCallback(
      (event) => {
        if (event.key === 'Enter') {
          handleRemoveClick(event);
        }
      },
      [handleRemoveClick],
    );

    const Wrapper = onClick ? 'button' : 'span';

    return (
      <Wrapper
        ref={ref}
        type={onClick ? 'button' : undefined}
        title={name}
        className={classNames(styles.wrapper, isMarked && styles.wrapperMarked)}
        onClick={onClick}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className={styles.preview} />
        ) : (
          <Icon name={ICON_BY_KIND[kind]} className={styles.icon} />
        )}
        <span className={styles.name}>{name}</span>
        {isSubmitting && <Loader active inline size="mini" className={styles.loader} />}
        {onRemove && (
          <span
            role="button"
            tabIndex={0}
            title={t('action.removeAttachment')}
            className={styles.remove}
            onClick={handleRemoveClick}
            onKeyDown={handleRemoveKeyDown}
          >
            <Icon fitted name={isMarked ? 'undo' : 'close'} size="small" />
          </span>
        )}
      </Wrapper>
    );
  },
);

AttachmentChip.propTypes = {
  kind: PropTypes.oneOf(Object.values(AttachmentKinds)).isRequired,
  name: PropTypes.string.isRequired,
  previewUrl: PropTypes.string,
  isSubmitting: PropTypes.bool,
  isMarked: PropTypes.bool,
  onClick: PropTypes.func,
  onRemove: PropTypes.func,
};

AttachmentChip.defaultProps = {
  previewUrl: undefined,
  isSubmitting: false,
  isMarked: false,
  onClick: undefined,
  onRemove: undefined,
};

export default React.memo(AttachmentChip);
