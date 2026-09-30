/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';

import { useClosableModal } from '../../../hooks';
import { CardRecurrenceScopes } from '../../../constants/Enums';

/**
 * Asks which cards of a series a change made outside the card modal - a drag on the timeline -
 * reaches. Until a choice is made nothing is saved, so the bar stays where it was.
 */
const RecurrenceScopeModal = React.memo(({ onSelect, onClose }) => {
  const [t] = useTranslation();
  const [ClosableModal] = useClosableModal();

  return (
    <ClosableModal closeIcon size="tiny" onClose={onClose}>
      <ClosableModal.Header>
        {t('common.changeRecurringCard', {
          context: 'title',
        })}
      </ClosableModal.Header>
      <ClosableModal.Content>
        <p>{t('common.whichCardsShouldChange')}</p>
        <p>{t('common.doneCardsOfSeriesAreKept')}</p>
      </ClosableModal.Content>
      <ClosableModal.Actions>
        <Button
          content={t('common.thisCard')}
          onClick={() => onSelect(CardRecurrenceScopes.THIS)}
        />
        <Button
          content={t('common.thisAndFollowingCards')}
          onClick={() => onSelect(CardRecurrenceScopes.FOLLOWING)}
        />
        <Button
          primary
          content={t('common.allCards')}
          onClick={() => onSelect(CardRecurrenceScopes.ALL)}
        />
      </ClosableModal.Actions>
    </ClosableModal>
  );
});

RecurrenceScopeModal.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default RecurrenceScopeModal;
