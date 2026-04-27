import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  event: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('SUCCESS', 'FAILURE'),
    allowNull: false,
    defaultValue: 'SUCCESS',
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

export default AuditLog;
