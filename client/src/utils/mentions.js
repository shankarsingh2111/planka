/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

const USERNAME_CHAR_CLASS = 'a-zA-Z0-9._';
const USERNAME_CHAR_REGEX = new RegExp(`^[${USERNAME_CHAR_CLASS}]$`);

const MENTION_TEXT_REGEX = new RegExp(
  `(^|[^${USERNAME_CHAR_CLASS}])@([${USERNAME_CHAR_CLASS}]+)`,
  'gi',
);

const MENTION_MARKUP_REGEX = /@\[(.*?)\]\((.*?)\)/g;

export const mentionTextToMarkup = (text, userByUsername) =>
  text.replace(MENTION_TEXT_REGEX, (match, before, username) => {
    const user = userByUsername[username.toLowerCase()];
    return user ? `${before}@[${user.username}](${user.id})` : match;
  });

export const mentionMarkupToText = (markup) =>
  markup.replace(MENTION_MARKUP_REGEX, (_, username) => `@${username}`);

export const isUsernameChar = (char) => USERNAME_CHAR_REGEX.test(char);

// The input shows "@name" where the text holds "@[name](id)", so a caret position in one is not
// the same in the other. A position inside a mention snaps to its end.
export const plainToMarkupIndex = (markup, plainIndex) => {
  const matches = [...markup.matchAll(MENTION_MARKUP_REGEX)];

  let plainPosition = 0;
  let markupPosition = 0;

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const gap = match.index - markupPosition;

    if (plainIndex <= plainPosition + gap) {
      break;
    }

    plainPosition += gap;
    markupPosition = match.index;

    const plainLength = match[1].length + 1;

    if (plainIndex <= plainPosition + plainLength) {
      return markupPosition + match[0].length;
    }

    plainPosition += plainLength;
    markupPosition += match[0].length;
  }

  return markupPosition + (plainIndex - plainPosition);
};

// Only meant for positions outside mention markup, which is all the formatting toolbar produces
export const markupToPlainIndex = (markup, markupIndex) =>
  mentionMarkupToText(markup.slice(0, markupIndex)).length;
