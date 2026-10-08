/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import router from './router';
import socket from './socket';
import bootstrap from './bootstrap';
import core from './core';
import modals from './modals';
import config from './config';
import storage from './storage';
import webhooks from './webhooks';
import users from './users';
import projects from './projects';
import projectManagers from './project-managers';
import backgroundImages from './background-images';
import baseCustomFieldGroups from './base-custom-field-groups';
import boards from './boards';
import boardMemberships from './board-memberships';
import labels from './labels';
import cardDependencies from './card-dependencies';
import cardRecurrences from './card-recurrences';
import lists from './lists';
import cards from './cards';
import taskLists from './task-lists';
import tasks from './tasks';
import attachments from './attachments';
import customFieldGroups from './custom-field-groups';
import customFields from './custom-fields';
import customFieldValues from './custom-field-values';
import comments from './comments';
import activities from './activities';
import notifications from './notifications';
import notificationServices from './notification-services';
import hippo from './hippo';

export default [
  router,
  socket,
  bootstrap,
  core,
  modals,
  config,
  storage,
  webhooks,
  users,
  projects,
  projectManagers,
  backgroundImages,
  baseCustomFieldGroups,
  boards,
  boardMemberships,
  labels,
  cardDependencies,
  cardRecurrences,
  lists,
  cards,
  taskLists,
  tasks,
  attachments,
  customFieldGroups,
  customFields,
  customFieldValues,
  comments,
  activities,
  notifications,
  notificationServices,
  hippo,
];
