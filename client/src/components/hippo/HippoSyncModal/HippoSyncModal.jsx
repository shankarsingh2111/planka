/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';

import { useClosableModal } from '../../../hooks';

/**
 * Asks whether a change on a ticket card should reach Hippo too. Nothing is saved until a choice
 * is made, and closing the dialog saves nothing. It opens over the card modal, the way
 * AddTextFileModal does.
 */
const HippoSyncModal = React.memo(({ content, syncContent, onSync, onSkip, onClose }) => {
  const [t] = useTranslation();
  const [ClosableModal] = useClosableModal();

  return (
    <ClosableModal closeIcon size="tiny" onClose={onClose}>
      <ClosableModal.Header>
        {t('common.syncToHippo', {
          context: 'title',
        })}
      </ClosableModal.Header>
      <ClosableModal.Content>
        <p>{content}</p>
      </ClosableModal.Content>
      <ClosableModal.Actions>
        <Button content={t('action.cancel')} onClick={onClose} />
        <Button content={t('action.plankaOnly')} onClick={onSkip} />
        <Button primary content={syncContent} onClick={onSync} />
      </ClosableModal.Actions>
    </ClosableModal>
  );
});

HippoSyncModal.propTypes = {
  content: PropTypes.string.isRequired,
  syncContent: PropTypes.string.isRequired,
  onSync: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default HippoSyncModal;
