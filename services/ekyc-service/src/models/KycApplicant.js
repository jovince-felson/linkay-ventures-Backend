import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const KycApplicant = sequelize.define('KycApplicant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    comment: 'User ID from auth-service',
  },
  userEmail: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  applicantId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Sumsub applicant ID',
  },
  levelName: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  reviewAnswer: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'GREEN or RED from Sumsub',
  },
  rejectType: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'FINAL or RETRY from Sumsub',
  },
  reviewComment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'kyc_applicants',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['applicant_id'] },
    { fields: ['status'] },
  ],
});

export default KycApplicant;
