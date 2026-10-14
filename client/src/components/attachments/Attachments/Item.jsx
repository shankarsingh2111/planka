/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Item as GalleryItem } from 'react-photoswipe-gallery';

import selectors from '../../../selectors';
import { AttachmentTypes } from '../../../constants/Enums';
import ItemContent from './ItemContent';
import { buildGalleryItemProps } from './gallery';

const Item = React.memo(({ id, isVisible }) => {
  const selectAttachmentById = useMemo(() => selectors.makeSelectAttachmentById(), []);

  const attachment = useSelector((state) => selectAttachmentById(state, id));

  const [t] = useTranslation();

  if (!attachment.isPersisted) {
    return <ItemContent id={id} />;
  }

  const galleryItemProps = buildGalleryItemProps(attachment, t);

  return (
    <GalleryItem
      {...galleryItemProps} // eslint-disable-line react/jsx-props-no-spreading
      original={attachment.data.url}
      caption={attachment.name}
    >
      {({ ref, open }) =>
        isVisible ? (
          <ItemContent
            ref={ref}
            id={id}
            onOpen={attachment.type === AttachmentTypes.FILE ? open : undefined}
          />
        ) : (
          <span ref={ref} />
        )
      }
    </GalleryItem>
  );
});

Item.propTypes = {
  id: PropTypes.string.isRequired,
  isVisible: PropTypes.bool.isRequired,
};

export default Item;
