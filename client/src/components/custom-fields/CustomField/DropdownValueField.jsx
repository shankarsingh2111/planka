/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Dropdown } from 'semantic-ui-react';

import styles from './DropdownValueField.module.scss';

// A value whose option was removed from the field stays until someone picks another
const DropdownValueField = React.memo(({ defaultValue, options, onUpdate, ...props }) => {
  const [t] = useTranslation();

  const dropdownOptions = useMemo(() => {
    const result = options.map((option) => ({
      key: option,
      text: option,
      value: option,
    }));

    if (defaultValue && !options.includes(defaultValue)) {
      result.push({
        key: defaultValue,
        text: t('common.removedOption', {
          value: defaultValue,
        }),
        value: defaultValue,
      });
    }

    return result;
  }, [defaultValue, options, t]);

  const handleChange = useCallback(
    (_, { value }) => {
      const nextValue = value || null;

      if (nextValue !== (defaultValue || null)) {
        onUpdate(nextValue);
      }
    },
    [defaultValue, onUpdate],
  );

  return (
    <Dropdown
      {...props} // eslint-disable-line react/jsx-props-no-spreading
      fluid
      selection
      clearable
      options={dropdownOptions}
      value={defaultValue || ''}
      placeholder={t('common.selectOption')}
      className={styles.field}
      onChange={handleChange}
    />
  );
});

DropdownValueField.propTypes = {
  defaultValue: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onUpdate: PropTypes.func.isRequired,
};

DropdownValueField.defaultProps = {
  defaultValue: undefined,
};

export default DropdownValueField;
