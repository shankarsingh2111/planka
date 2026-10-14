/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createLocalId } from '../../../utils/local-id';
import { AttachmentTypes } from '../../../constants/Enums';
import { getAttachmentKind } from '../../attachments/AttachmentChip';

const revokePreview = ({ previewUrl }) => {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
};

// Files and links picked for a comment, held in the browser until it is posted or saved
export default () => {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const addFiles = useCallback((files) => {
    setItems((prevItems) => [
      ...prevItems,
      ...files.map((file) => {
        const isImage = file.type.startsWith('image/');

        return {
          localId: createLocalId(),
          type: AttachmentTypes.FILE,
          file,
          name: file.name,
          kind: getAttachmentKind({
            type: AttachmentTypes.FILE,
            mimeType: file.type,
            isImage,
          }),
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        };
      }),
    ]);
  }, []);

  const addLink = useCallback(({ url, name }) => {
    setItems((prevItems) => [
      ...prevItems,
      {
        localId: createLocalId(),
        type: AttachmentTypes.LINK,
        url,
        name,
        kind: getAttachmentKind({
          type: AttachmentTypes.LINK,
        }),
      },
    ]);
  }, []);

  const remove = useCallback((localId) => {
    setItems((prevItems) =>
      prevItems.filter((item) => {
        if (item.localId === localId) {
          revokePreview(item);
          return false;
        }

        return true;
      }),
    );
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.forEach(revokePreview);
    setItems([]);
  }, []);

  // What the sagas send to the server
  const toData = useCallback(
    () =>
      itemsRef.current.map(({ type, file, url, name }) =>
        type === AttachmentTypes.FILE ? { type, file, name } : { type, url, name },
      ),
    [],
  );

  // Only pasted files become attachments; a text paste, links included, stays text. Stopping the
  // event keeps the card's own paste-to-attach from taking the files as well.
  const handlePaste = useCallback(
    (event) => {
      const files = event.clipboardData ? [...event.clipboardData.files] : [];

      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      addFiles(files);
    },
    [addFiles],
  );

  useEffect(
    () => () => {
      itemsRef.current.forEach(revokePreview);
    },
    [],
  );

  return useMemo(
    () => ({
      items,
      addFiles,
      addLink,
      remove,
      clear,
      toData,
      handlePaste,
    }),
    [items, addFiles, addLink, remove, clear, toData, handlePaste],
  );
};
