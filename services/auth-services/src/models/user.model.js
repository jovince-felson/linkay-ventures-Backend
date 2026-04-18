const { DataTypes } = require('sequelize');
const { sequelize }  = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  full_name: {
    type:      DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type:      DataTypes.STRING(150),
    allowNull: false,
    unique:    true,
    validate:  { isEmail: true },
  },
  phone: {
    type:      DataTypes.STRING(20),
    allowNull: true,
    unique:    true,
  },
  password_hash: {
    type:      DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type:         DataTypes.ENUM('user', 'admin', 'superadmin'),
    defaultValue: 'user',
  },
  is_verified: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_login_at: {
    type:      DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['email'] },
    { unique: true, fields: ['phone'] },
  ],
});

module.exports = User;
