/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import { Icon } from 'semantic-ui-react';
import { usePopup } from '../../../../lib/popup';

import ActionsStep from './ActionsStep';

import styles from './RightSide.module.scss';

const RightSide = React.memo(() => {
  const ActionsPopup = usePopup(ActionsStep);

  return (
    <div className={styles.action}>
      <ActionsPopup>
        <button type="button" className={styles.button}>
          <Icon fitted name="ellipsis vertical" />
        </button>
      </ActionsPopup>
    </div>
  );
});

export default RightSide;
