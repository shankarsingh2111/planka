/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Gallery, Item as GalleryItem } from 'react-photoswipe-gallery';

import selectors from '../../../selectors';
import { ClosableContext } from '../../../contexts';
import { AttachmentTypes } from '../../../constants/Enums';
import { GALLERY_OPTIONS, buildGalleryItemProps } from '../../attachments/Attachments';
import AttachmentChip, { getStoredAttachmentChipProps } from '../../attachments/AttachmentChip';

import styles from './CommentAttachments.module.scss';

const CommentAttachments = React.memo(({ commentId }) => {
  const selectAttachmentsByCommentId = useMemo(
    () => selectors.makeSelectAttachmentsByCommentId(),
    [],
  );

  const attachments = useSelector((state) => selectAttachmentsByCommentId(state, commentId));

  const [t] = useTranslation();
  const [activateClosable, deactivateClosable] = useContext(ClosableContext);

  const handleBeforeGalleryOpen = useCallback(
    (gallery) => {
      activateClosable();

      gallery.on('destroy', () => {
        deactivateClosable();
      });
    },
    [activateClosable, deactivateClosable],
  );

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Gallery
        withCaption
        withDownloadButton
        options={GALLERY_OPTIONS}
        onBeforeOpen={handleBeforeGalleryOpen}
      >
        {attachments.map((attachment) => {
          const chipProps = getStoredAttachmentChipProps(attachment);

          if (!attachment.isPersisted) {
            return (
              <AttachmentChip
                key={attachment.id}
                kind={chipProps.kind}
                name={chipProps.name}
                isSubmitting
              />
            );
          }

          if (attachment.type === AttachmentTypes.LINK) {
            return (
              <AttachmentChip
                key={attachment.id}
                kind={chipProps.kind}
                name={chipProps.name}
                onClick={() => window.open(attachment.data.url, '_blank')}
              />
            );
          }

          return (
            <GalleryItem
              key={attachment.id}
              {...buildGalleryItemProps(attachment, t)} // eslint-disable-line react/jsx-props-no-spreading
              original={attachment.data.url}
              caption={attachment.name}
            >
              {({ ref, open }) =>
                attachment.data.image ? (
                  <button
                    ref={ref}
                    type="button"
                    title={attachment.name}
                    className={styles.thumbnail}
                    onClick={open}
                  >
                    <img src={chipProps.previewUrl} alt={attachment.name} />
                  </button>
                ) : (
                  <AttachmentChip
                    ref={ref}
                    kind={chipProps.kind}
                    name={chipProps.name}
                    onClick={open}
                  />
                )
              }
            </GalleryItem>
          );
        })}
      </Gallery>
    </div>
  );
});

CommentAttachments.propTypes = {
  commentId: PropTypes.string.isRequired,
};

export default CommentAttachments;
