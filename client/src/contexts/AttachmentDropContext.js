/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { createContext } from 'react';

// registerDropTarget(elementRef, onFiles) -> unregister. Files dropped over a registered element go
// to it instead of becoming card attachments.
export default createContext(null);
