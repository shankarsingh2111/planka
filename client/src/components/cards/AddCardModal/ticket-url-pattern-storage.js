/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

// Ticket links follow one pattern per project. The last one pasted is remembered in this browser,
// so a bare number can become a link too. Private windows may refuse storage, which only means no
// link.

const buildStorageKey = (projectId) => `hippoTicketUrlPattern:${projectId}`;

export const readTicketUrlPattern = (projectId) => {
  try {
    return window.localStorage.getItem(buildStorageKey(projectId));
  } catch {
    return null;
  }
};

export const writeTicketUrlPattern = (projectId, pattern) => {
  try {
    window.localStorage.setItem(buildStorageKey(projectId), pattern);
  } catch {
    /* empty */
  }
};
