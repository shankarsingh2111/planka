/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';

import LabelColors from '../../../constants/LabelColors';

import globalStyles from '../../../styles.module.scss';

export const ColorByOptions = {
  STATUS: 'status',
  LABEL: 'label',
  LIST: 'list',
  MEMBER: 'member',
  PROJECT: 'project',
};

const StatusColors = {
  DONE: 'fresh-salad',
  OVERDUE: 'berry-red',
  DUE_SOON: 'pumpkin-orange',
  IN_PROGRESS: 'lagoon-blue',
  NOT_STARTED: 'morning-sky',
};

const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000;

export const getColorClassName = (color) =>
  color ? globalStyles[`background${upperFirst(camelCase(color))}`] : undefined;

export const getHashedColor = (key) => {
  let hash = 0;

  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 1000003;
  }

  return LabelColors[hash % LabelColors.length];
};

export const getStatusColor = (card, isDone, isOverdue) => {
  if (isDone || card.isDueCompleted) {
    return StatusColors.DONE;
  }

  if (isOverdue) {
    return StatusColors.OVERDUE;
  }

  const now = new Date();

  if (card.dueDate && card.dueDate.getTime() - now.getTime() < DUE_SOON_MS) {
    return StatusColors.DUE_SOON;
  }

  if (card.startDate && card.startDate > now) {
    return StatusColors.NOT_STARTED;
  }

  return StatusColors.IN_PROGRESS;
};
