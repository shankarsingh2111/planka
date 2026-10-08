/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { Button, Icon, Message } from 'semantic-ui-react';

import entryActions from '../../../entry-actions';
import { getHippoErrorText } from '../../../utils/hippo';

import styles from './HippoSyncFailedToast.module.scss';

const HippoSyncFailedToast = React.memo(({ id, cardId, commentId, error }) => {
  const dispatch = useDispatch();
  const [t] = useTranslation();

  const handleRetryClick = useCallback(() => {
    dispatch(entryActions.retryHippoSync(cardId, commentId));
    toast.dismiss(id);
  }, [id, cardId, commentId, dispatch]);

  return (
    <Message visible negative size="tiny">
      <Icon name="ticket alternate" />
      {t('common.hippoSyncFailed', {
        reason: getHippoErrorText(error, t),
      })}
      <Button
        content={t('action.retry')}
        size="mini"
        className={styles.button}
        onClick={handleRetryClick}
      />
    </Message>
  );
});

HippoSyncFailedToast.propTypes = {
  id: PropTypes.string.isRequired,
  cardId: PropTypes.string.isRequired,
  commentId: PropTypes.string,
  error: PropTypes.shape({
    message: PropTypes.string,
  }).isRequired,
};

HippoSyncFailedToast.defaultProps = {
  commentId: null,
};

export default HippoSyncFailedToast;
