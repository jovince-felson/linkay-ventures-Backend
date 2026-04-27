import { DataTypes } from 'sequelize';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('wallet_nonces', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING(42),
      allowNull: false,
    },
    nonce: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('wallet_nonces', ['address'], { name: 'idx_wallet_nonces_address' });
  await queryInterface.addIndex('wallet_nonces', ['nonce'], { name: 'idx_wallet_nonces_nonce' });
  await queryInterface.addIndex('wallet_nonces', ['expires_at'], { name: 'idx_wallet_nonces_expires_at' });
};

export const down = async (queryInterface) => {
  await queryInterface.dropTable('wallet_nonces');
};
