/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import { MarkdownFormats } from '../../../utils/markdown-format';

import styles from './FormattingToolbar.module.scss';

const BUTTONS = [
  { format: MarkdownFormats.BOLD, icon: 'bold', titleKey: 'common.formatBold' },
  { format: MarkdownFormats.ITALIC, icon: 'italic', titleKey: 'common.formatItalic' },
  {
    format: MarkdownFormats.STRIKETHROUGH,
    icon: 'strikethrough',
    titleKey: 'common.formatStrikethrough',
  },
  { format: MarkdownFormats.CODE, icon: 'code', titleKey: 'common.formatCode' },
  {
    format: MarkdownFormats.CODE_BLOCK,
    icon: 'file code outline',
    titleKey: 'common.formatCodeBlock',
  },
  { format: MarkdownFormats.BULLETED_LIST, icon: 'list ul', titleKey: 'common.formatBulletedList' },
  {
    format: MarkdownFormats.NUMBERED_LIST,
    icon: 'list ol',
    titleKey: 'common.formatNumberedList',
  },
  { format: MarkdownFormats.QUOTE, icon: 'quote left', titleKey: 'common.formatQuote' },
  { format: MarkdownFormats.LINK, icon: 'linkify', titleKey: 'common.formatLink' },
];

// Pressing a button must not take focus or the selection away from the textarea
const preventFocusLoss = (event) => {
  event.preventDefault();
};

const FormattingToolbar = React.memo(({ onFormat }) => {
  const [t] = useTranslation();

  const handleClick = useCallback(
    (event) => {
      onFormat(event.currentTarget.dataset.format);
    },
    [onFormat],
  );

  return (
    <div className={styles.wrapper}>
      {BUTTONS.map(({ format, icon, titleKey }) => (
        <button
          key={format}
          type="button"
          title={t(titleKey)}
          data-format={format}
          className={styles.button}
          onMouseDown={preventFocusLoss}
          onClick={handleClick}
        >
          <Icon fitted name={icon} size="small" />
        </button>
      ))}
    </div>
  );
});

FormattingToolbar.propTypes = {
  onFormat: PropTypes.func.isRequired,
};

export default FormattingToolbar;
