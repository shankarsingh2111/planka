/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { truncateCardName } from './undo-stack';

import styles from './UndoStack.module.scss';

/**
 * Bottom-right stack of the timeline's recent drags, one entry per drag, newest at the bottom.
 * Every entry stays until undone or closed, so the list scrolls once it outgrows the screen.
 */
const UndoStack = React.memo(({ entries, onUndo, onClose, onClearAll }) => {
  const [t] = useTranslation();
  const listRef = useRef(null);

  // Keep the newest entry, next to the corner, in view as entries are added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      {entries.length > 1 && (
        <button type="button" className={styles.clearAll} onClick={onClearAll}>
          {t('action.clearAll')} ({entries.length})
        </button>
      )}
      <div ref={listRef} className={styles.list}>
        {entries.map((entry) => (
          <div key={entry.id} className={styles.entry}>
            <Icon name="calendar alternate outline" className={styles.icon} />
            <span className={styles.text}>
              {t(entry.messageKey, { name: truncateCardName(entry.cardName) })}
            </span>
            <button type="button" className={styles.undo} onClick={() => onUndo(entry.id)}>
              <Icon name="undo" />
              {t('action.undo')}
            </button>
            <button
              type="button"
              title={t('action.close')}
              className={styles.close}
              onClick={() => onClose(entry.id)}
            >
              <Icon fitted name="close" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

UndoStack.propTypes = {
  entries: PropTypes.arrayOf(PropTypes.object).isRequired, // eslint-disable-line react/forbid-prop-types
  onUndo: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
};

export default UndoStack;
