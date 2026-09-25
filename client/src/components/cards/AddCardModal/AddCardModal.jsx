/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React from 'react';
import PropTypes from 'prop-types';

import { useClosableModal } from '../../../hooks';
import Content from './Content';

import styles from '../CardModal/CardModal.module.scss';

/**
 * A card that does not exist yet, laid out like the card view so creating one looks the same as
 * editing one. Nothing is saved until the card is added.
 */
const AddCardModal = React.memo(({ defaultData, onCreate, onClose }) => {
  const [ClosableModal] = useClosableModal();

  return (
    <ClosableModal closeIcon centered={false} className={styles.wrapper} onClose={onClose}>
      <Content defaultData={defaultData} onCreate={onCreate} onClose={onClose} />
    </ClosableModal>
  );
});

AddCardModal.propTypes = {
  defaultData: PropTypes.shape({
    listId: PropTypes.string.isRequired,
    startDate: PropTypes.instanceOf(Date),
    dueDate: PropTypes.instanceOf(Date),
    userIds: PropTypes.arrayOf(PropTypes.string),
    labelIds: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onCreate: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AddCardModal;
