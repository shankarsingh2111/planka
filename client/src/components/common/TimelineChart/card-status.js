/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { ListTypes } from '../../../constants/Enums';

export const isCardDone = (card, list) =>
  !!card.isClosed || (!!list && list.type === ListTypes.CLOSED);

export const isCardOverdue = (card, isDone, now = new Date()) =>
  !isDone && !card.isDueCompleted && !!card.dueDate && card.dueDate < now;
