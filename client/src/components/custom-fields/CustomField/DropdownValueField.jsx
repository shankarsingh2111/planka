/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Dropdown } from 'semantic-ui-react';

import { joinMultiselectContent, splitMultiselectContent } from '../../../utils/custom-fields';

import styles from './DropdownValueField.module.scss';

// A value whose option was removed from the field stays until someone picks another. A
// multi-select keeps its picks as one text, the way the server stores them.
const DropdownValueField = React.memo(
  ({ defaultValue, options, multiple, clearable, onUpdate, ...props }) => {
    const [t] = useTranslation();

    const picks = useMemo(() => {
      if (multiple) {
        return splitMultiselectContent(defaultValue);
      }

      return defaultValue ? [defaultValue] : [];
    }, [defaultValue, multiple]);

    const dropdownOptions = useMemo(() => {
      const result = options.map((option) => ({
        key: option,
        text: option,
        value: option,
      }));

      picks.forEach((pick) => {
        if (!options.includes(pick)) {
          result.push({
            key: pick,
            text: t('common.removedOption', {
              value: pick,
            }),
            value: pick,
          });
        }
      });

      return result;
    }, [picks, options, t]);

    const handleChange = useCallback(
      (_, { value }) => {
        const nextValue = multiple ? joinMultiselectContent(value) : value || null;

        if (nextValue !== (defaultValue || null)) {
          onUpdate(nextValue);
        }
      },
      [defaultValue, multiple, onUpdate],
    );

    return (
      <Dropdown
        {...props} // eslint-disable-line react/jsx-props-no-spreading
        fluid
        selection
        multiple={multiple}
        clearable={clearable && !multiple}
        options={dropdownOptions}
        value={multiple ? picks : defaultValue || ''}
        placeholder={t('common.selectOption')}
        className={styles.field}
        onChange={handleChange}
      />
    );
  },
);

DropdownValueField.propTypes = {
  defaultValue: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  clearable: PropTypes.bool,
  onUpdate: PropTypes.func.isRequired,
};

DropdownValueField.defaultProps = {
  defaultValue: undefined,
  multiple: false,
  clearable: true,
};

export default DropdownValueField;
