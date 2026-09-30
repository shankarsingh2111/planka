/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';
import { Popup } from '../../../lib/custom-ui';

import { CardRecurrenceScopes } from '../../../constants/Enums';

import styles from './SelectRecurrenceScopeStep.module.scss';

// Asks which cards of a series an action on one of them reaches, one button per choice
const SelectRecurrenceScopeStep = React.memo(
  ({ title, content, buttonContents, isNegative, onSelect, onBack, onClose }) => {
    const [t] = useTranslation();

    const handleSelect = useCallback(
      (scope) => {
        onSelect(scope);
        onClose();
      },
      [onSelect, onClose],
    );

    return (
      <>
        <Popup.Header onBack={onBack}>
          {t(title, {
            context: 'title',
          })}
        </Popup.Header>
        <Popup.Content>
          <div className={styles.content}>{t(content)}</div>
          <div className={styles.hint}>{t('common.doneCardsOfSeriesAreKept')}</div>
          {Object.values(CardRecurrenceScopes).map((scope) => (
            <Button
              key={scope}
              fluid
              negative={isNegative}
              content={t(buttonContents[scope])}
              className={styles.button}
              onClick={() => handleSelect(scope)}
            />
          ))}
        </Popup.Content>
      </>
    );
  },
);

SelectRecurrenceScopeStep.propTypes = {
  title: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  buttonContents: PropTypes.objectOf(PropTypes.string).isRequired,
  isNegative: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onBack: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

SelectRecurrenceScopeStep.defaultProps = {
  isNegative: false,
  onBack: undefined,
};

export default SelectRecurrenceScopeStep;
