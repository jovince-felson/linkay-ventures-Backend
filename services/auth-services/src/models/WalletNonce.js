import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const WalletNonce = sequelize.define('WalletNonce', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
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
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'wallet_nonces',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

export default WalletNonce;
