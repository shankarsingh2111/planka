/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useCallback } from 'react';

import { applyFormat } from '../../../utils/markdown-format';
import { markupToPlainIndex, plainToMarkupIndex } from '../../../utils/mentions';

// The textarea's selection is in shown text ("@name"); the format applies to the stored text
// ("@[name](id)"), and the new selection is mapped back
export default (inputRef, text, onTextChange) =>
  useCallback(
    (format) => {
      const input = inputRef.current;

      if (!input) {
        return;
      }

      const start = plainToMarkupIndex(text, input.selectionStart);
      const end = plainToMarkupIndex(text, input.selectionEnd);
      const result = applyFormat(text, start, end, format);

      onTextChange(result.text);

      const nextStart = markupToPlainIndex(result.text, result.selectionStart);
      const nextEnd = markupToPlainIndex(result.text, result.selectionEnd);

      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(nextStart, nextEnd);
      });
    },
    [inputRef, text, onTextChange],
  );
