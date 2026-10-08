/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import { Toaster as HotToaster, ToastBar as HotToastBar } from 'react-hot-toast';

import ToastTypes from '../../../constants/ToastTypes';
import FileIsTooBigToast from './FileIsTooBigToast';
import FileTypeNotAllowedToast from './FileTypeNotAllowedToast';
import SvgContainsActiveContentToast from './SvgContainsActiveContentToast';
import NotEnoughStorageToast from './NotEnoughStorageToast';
import EmptyTrashToast from './EmptyTrashToast';
import SourceCardNotCopyableToast from './SourceCardNotCopyableToast';
import SourceCardNotMovableToast from './SourceCardNotMovableToast';
import HippoSyncFailedToast from './HippoSyncFailedToast';
import HippoImportIncompleteToast from './HippoImportIncompleteToast';

const TOAST_BY_TYPE = {
  [ToastTypes.FILE_IS_TOO_BIG]: FileIsTooBigToast,
  [ToastTypes.FILE_TYPE_NOT_ALLOWED]: FileTypeNotAllowedToast,
  [ToastTypes.SVG_CONTAINS_ACTIVE_CONTENT]: SvgContainsActiveContentToast,
  [ToastTypes.NOT_ENOUGH_STORAGE]: NotEnoughStorageToast,
  [ToastTypes.EMPTY_TRASH]: EmptyTrashToast,
  [ToastTypes.SOURCE_CARD_NOT_COPYABLE]: SourceCardNotCopyableToast,
  [ToastTypes.SOURCE_CARD_NOT_MOVABLE]: SourceCardNotMovableToast,
  [ToastTypes.HIPPO_SYNC_FAILED]: HippoSyncFailedToast,
  [ToastTypes.HIPPO_IMPORT_INCOMPLETE]: HippoImportIncompleteToast,
};

const Toaster = React.memo(() => (
  <HotToaster>
    {(toast) => (
      <HotToastBar
        toast={toast}
        style={{
          background: 'transparent',
          borderRadius: 0,
          maxWidth: '90%',
          padding: 0,
        }}
      >
        {() => {
          const Toast = TOAST_BY_TYPE[toast.message.type];

          // eslint-disable-next-line react/jsx-props-no-spreading
          return <Toast {...toast.message.params} id={toast.id} />;
        }}
      </HotToastBar>
    )}
  </HotToaster>
));

export default Toaster;
