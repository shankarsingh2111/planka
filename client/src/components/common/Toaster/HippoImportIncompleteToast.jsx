/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, Message } from 'semantic-ui-react';

const HippoImportIncompleteToast = React.memo(() => {
  const [t] = useTranslation();

  return (
    <Message visible warning size="tiny">
      <Icon name="ticket alternate" />
      {t('common.hippoImportIncomplete')}
    </Message>
  );
});

export default HippoImportIncompleteToast;
