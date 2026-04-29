import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    set(value) {
      this.setDataValue('email', value.toLowerCase().trim());
    },
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  countryOfResidence: {
    type: DataTypes.CHAR(2),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('SUPER_ADMIN', 'MUSEUM_ADMIN', 'COMPLIANCE_OFFICER', 'CMS_EDITOR', 'INVESTOR'),
    allowNull: false,
    defaultValue: 'INVESTOR',
  },
  status: {
    type: DataTypes.ENUM('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'),
    allowNull: false,
    defaultValue: 'PENDING_VERIFICATION',
  },
  walletAddress: {
    type: DataTypes.STRING(42),
    allowNull: true,
    unique: true,
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  emailVerificationToken: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  kycStatus: {
    type: DataTypes.ENUM('NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED'),
    defaultValue: 'NOT_STARTED',
  },
  kycApplicantId: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refreshTokenHash: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  passwordResetToken: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

export default User;
