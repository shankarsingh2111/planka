/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useDropzone } from 'react-dropzone';
import { closePopup } from '../../../../lib/popup';

import entryActions from '../../../../entry-actions';
import { useModal } from '../../../../hooks';
import { AttachmentDropContext } from '../../../../contexts';
import { isUrl } from '../../../../utils/validator';
import { isActiveTextElement } from '../../../../utils/element-helpers';
import { AttachmentTypes } from '../../../../constants/Enums';
import AddTextFileModal from './AddTextFileModal';

import styles from './AddAttachmentZone.module.scss';

const AddAttachmentZone = React.memo(({ children }) => {
  const dispatch = useDispatch();
  const [t] = useTranslation();
  const [modal, openModal, handleModalClose] = useModal();

  const submitFile = useCallback(
    (file) => {
      dispatch(
        entryActions.createAttachmentInCurrentCard({
          file,
          type: AttachmentTypes.FILE,
          name: file.name,
        }),
      );
    },
    [dispatch],
  );

  const submitLink = useCallback(
    (url) => {
      dispatch(
        entryActions.createAttachmentInCurrentCard({
          url,
          type: AttachmentTypes.LINK,
          name: url,
        }),
      );
    },
    [dispatch],
  );

  const dropTargetsRef = useRef(new Set());

  const registerDropTarget = useCallback((elementRef, onFiles) => {
    const target = {
      elementRef,
      onFiles,
    };

    dropTargetsRef.current.add(target);

    return () => {
      dropTargetsRef.current.delete(target);
    };
  }, []);

  // The drop overlay covers the whole modal, so a target is found by where the pointer was
  const handleDropAccepted = useCallback(
    (files, event) => {
      const target =
        event &&
        [...dropTargetsRef.current].find(({ elementRef }) => {
          if (!elementRef.current) {
            return false;
          }

          const rect = elementRef.current.getBoundingClientRect();

          return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );
        });

      if (target) {
        target.onFiles(files);
        return;
      }

      files.forEach((file) => {
        submitFile(file);
      });
    },
    [submitFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    noKeyboard: true,
    onDropAccepted: handleDropAccepted,
  });

  const handleFileCreate = useCallback(
    (file) => {
      submitFile(file);
    },
    [submitFile],
  );

  useEffect(() => {
    const handlePaste = (event) => {
      if (!event.clipboardData) {
        return;
      }

      const { files, items } = event.clipboardData;

      if (files.length > 0) {
        [...files].forEach((file) => {
          submitFile(file);
        });

        return;
      }

      if (items.length === 0) {
        return;
      }

      if (items[0].kind === 'string') {
        if (isActiveTextElement(event.target)) {
          return;
        }

        items[0].getAsString((content) => {
          if (isUrl(content)) {
            submitLink(content);
          } else {
            closePopup();

            openModal({
              content,
            });
          }
        });

        return;
      }

      [...items].forEach((item) => {
        if (item.kind !== 'file') {
          return;
        }

        submitFile(item.getAsFile());
      });
    };

    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [openModal, submitFile, submitLink]);

  return (
    <AttachmentDropContext.Provider value={registerDropTarget}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <div {...getRootProps()}>
        {isDragActive && (
          <div className={styles.dropzone}>
            <div className={styles.dropzoneText}>{t('common.dropFileToUpload')}</div>
          </div>
        )}
        {children}
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <input {...getInputProps()} />
      </div>
      {modal && (
        <AddTextFileModal
          content={modal.content}
          onCreate={handleFileCreate}
          onClose={handleModalClose}
        />
      )}
    </AttachmentDropContext.Provider>
  );
});

AddAttachmentZone.propTypes = {
  children: PropTypes.element.isRequired,
};

export default AddAttachmentZone;
