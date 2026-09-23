/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Menu } from 'semantic-ui-react';
import { Popup } from '../../../../lib/custom-ui';

import styles from './LanesFilterStep.module.scss';

const LanesFilterStep = React.memo(({ lanes, hiddenLaneKeys, title, onToggle, onShowAll }) => {
  const [t] = useTranslation();

  const handleToggleClick = useCallback(
    (_, { value: laneKey }) => {
      onToggle(laneKey);
    },
    [onToggle],
  );

  return (
    <>
      <Popup.Header>{t(title, { context: 'title' })}</Popup.Header>
      <Popup.Content>
        <Menu secondary vertical className={styles.menu}>
          {lanes.map((lane) => (
            <Menu.Item
              key={lane.key}
              value={lane.key}
              className={styles.menuItem}
              onClick={handleToggleClick}
            >
              <Checkbox
                checked={!hiddenLaneKeys.includes(lane.key)}
                className={styles.checkbox}
                onChange={() => onToggle(lane.key)}
              />
              <span className={styles.laneName} title={lane.label}>
                {lane.label}
              </span>
            </Menu.Item>
          ))}
        </Menu>
        {hiddenLaneKeys.length > 0 && (
          <Button
            fluid
            content={t('action.showAll')}
            className={styles.showAllButton}
            onClick={onShowAll}
          />
        )}
      </Popup.Content>
    </>
  );
});

LanesFilterStep.propTypes = {
  lanes: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  hiddenLaneKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  title: PropTypes.string.isRequired,
  onToggle: PropTypes.func.isRequired,
  onShowAll: PropTypes.func.isRequired,
};

export default LanesFilterStep;
