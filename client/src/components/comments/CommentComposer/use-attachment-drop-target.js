/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { useContext, useEffect } from 'react';

import { AttachmentDropContext } from '../../../contexts';

export default (elementRef, onFiles) => {
  const registerDropTarget = useContext(AttachmentDropContext);

  useEffect(
    () => (registerDropTarget ? registerDropTarget(elementRef, onFiles) : undefined),
    [registerDropTarget, elementRef, onFiles],
  );
};
