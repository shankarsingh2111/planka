/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';
import { Input } from '../../../lib/custom-ui';

import styles from './CustomFieldEditor.module.scss';

// The options a dropdown offers, in the order it offers them
const OptionsEditor = React.memo(({ value, onChange }) => {
  const [t] = useTranslation();

  const updateOption = (index, option) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? option : item)));
  };

  const removeOption = (index) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const moveOption = (index, offset) => {
    const nextValue = [...value];
    const [option] = nextValue.splice(index, 1);

    nextValue.splice(index + offset, 0, option);
    onChange(nextValue);
  };

  const handleAddClick = useCallback(() => {
    onChange([...value, '']);
  }, [value, onChange]);

  return (
    <div className={styles.field}>
      {value.length === 0 && <div className={styles.hint}>{t('common.addAtLeastOneOption')}</div>}
      {value.map((option, index) => (
        // Options are edited in place, so their position is all that identifies them
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className={styles.option}>
          <Input
            fluid
            value={option}
            maxLength={128}
            className={styles.optionField}
            onChange={(_, { value: nextOption }) => updateOption(index, nextOption)}
          />
          <Button
            type="button"
            icon="arrow up"
            disabled={index === 0}
            className={styles.optionButton}
            onClick={() => moveOption(index, -1)}
          />
          <Button
            type="button"
            icon="arrow down"
            disabled={index === value.length - 1}
            className={styles.optionButton}
            onClick={() => moveOption(index, 1)}
          />
          <Button
            type="button"
            icon="trash alternate outline"
            className={styles.optionButton}
            onClick={() => removeOption(index)}
          />
        </div>
      ))}
      <Button type="button" content={t('action.addOption')} onClick={handleAddClick} />
    </div>
  );
});

OptionsEditor.propTypes = {
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default OptionsEditor;
