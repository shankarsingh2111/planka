/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Dropdown, Radio } from 'semantic-ui-react';
import { Input } from '../../../lib/custom-ui';

import { useNestedRef } from '../../../hooks';
import { CustomFieldTypes } from '../../../constants/Enums';
import OptionsEditor from './OptionsEditor';

import styles from './CustomFieldEditor.module.scss';

// Shared by the board/card group and base group popups, which used to carry identical copies
const CustomFieldEditor = React.forwardRef(({ data, onFieldChange }, ref) => {
  const [t] = useTranslation();

  const [nameFieldRef, handleNameFieldRef] = useNestedRef('inputRef');

  const selectNameField = useCallback(() => {
    nameFieldRef.current.select();
  }, [nameFieldRef]);

  useImperativeHandle(
    ref,
    () => ({
      selectNameField,
    }),
    [selectNameField],
  );

  const handleOptionsChange = useCallback(
    (options) => {
      onFieldChange(null, {
        name: 'options',
        value: options,
      });
    },
    [onFieldChange],
  );

  useEffect(() => {
    nameFieldRef.current.focus();
  }, [nameFieldRef]);

  return (
    <>
      <div className={styles.text}>{t('common.title')}</div>
      <Input
        fluid
        ref={handleNameFieldRef}
        name="name"
        value={data.name}
        maxLength={128}
        className={styles.fieldName}
        onChange={onFieldChange}
      />
      <div className={styles.text}>{t('common.type')}</div>
      <Dropdown
        fluid
        selection
        name="type"
        options={[
          {
            text: t('common.text'),
            value: CustomFieldTypes.TEXT,
          },
          {
            text: t('common.dropdown'),
            value: CustomFieldTypes.DROPDOWN,
          },
        ]}
        value={data.type}
        className={styles.field}
        onChange={onFieldChange}
      />
      {data.type === CustomFieldTypes.DROPDOWN && (
        <>
          <div className={styles.text}>{t('common.options')}</div>
          <OptionsEditor value={data.options} onChange={handleOptionsChange} />
        </>
      )}
      <Radio
        toggle
        name="showOnFrontOfCard"
        checked={data.showOnFrontOfCard}
        label={t('common.showOnFrontOfCard')}
        className={classNames(styles.field, styles.fieldRadio)}
        onChange={onFieldChange}
      />
    </>
  );
});

CustomFieldEditor.propTypes = {
  data: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  onFieldChange: PropTypes.func.isRequired,
};

export default React.memo(CustomFieldEditor);
