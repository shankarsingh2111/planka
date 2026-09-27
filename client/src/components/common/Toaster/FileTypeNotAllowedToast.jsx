/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, Message } from 'semantic-ui-react';

const FileTypeNotAllowedToast = React.memo(({ filename }) => {
  const [t] = useTranslation();

  return (
    <Message visible negative size="tiny">
      <Icon name="file" />
      {t('common.uploadFailedFileTypeIsNotAllowed', {
        filename,
      })}
    </Message>
  );
});

FileTypeNotAllowedToast.propTypes = {
  filename: PropTypes.string.isRequired,
};

export default FileTypeNotAllowedToast;
