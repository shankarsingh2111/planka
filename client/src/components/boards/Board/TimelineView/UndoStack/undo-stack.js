/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

export const MAX_UNDO_ENTRIES = 50;

const CARD_NAME_LENGTH = 20;

export const truncateCardName = (name) =>
  name.length > CARD_NAME_LENGTH ? `${name.slice(0, CARD_NAME_LENGTH).trimEnd()}…` : name;

// Oldest first; past the cap the oldest entry makes way for the new one
export const pushEntry = (entries, entry) => [...entries, entry].slice(-MAX_UNDO_ENTRIES);

export const removeEntry = (entries, id) => entries.filter((entry) => entry.id !== id);

/**
 * Undoing a drag takes its card back to how it was before that drag, which makes every later
 * entry for the same card stale — applying one would bring back a state that no longer follows.
 * Those entries go along with it; other cards' entries are left alone.
 */
export const removeEntryWithLater = (entries, id) => {
  const index = entries.findIndex((entry) => entry.id === id);

  if (index === -1) {
    return entries;
  }

  const { cardId } = entries[index];

  return entries.filter((entry, entryIndex) => entryIndex < index || entry.cardId !== cardId);
};
