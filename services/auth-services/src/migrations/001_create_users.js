import { DataTypes } from 'sequelize';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('users', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    country_of_residence: {
      type: DataTypes.CHAR(2),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(
        'SUPER_ADMIN',
        'MUSEUM_ADMIN',
        'COMPLIANCE_OFFICER',
        'CMS_EDITOR',
        'INVESTOR'
      ),
      allowNull: false,
      defaultValue: 'INVESTOR',
    }, 
    status: {
      type: DataTypes.ENUM(
        'PENDING_VERIFICATION',
        'ACTIVE',
        'SUSPENDED',
        'DEACTIVATED'
      ),
      allowNull: false,
      defaultValue: 'PENDING_VERIFICATION',
    },
    wallet_address: {
      type: DataTypes.STRING(42),
      allowNull: true,
      unique: true,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    email_verification_token: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    kyc_status: {
      type: DataTypes.ENUM(
        'NOT_STARTED',
        'PENDING',
        'APPROVED',
        'REJECTED',
        'RESUBMIT_REQUIRED'
      ),
      defaultValue: 'NOT_STARTED',
    },
    kyc_applicant_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refresh_token_hash: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    password_reset_token: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
    },
  });

  // Indexes
  await queryInterface.addIndex('users', ['email'], { name: 'idx_users_email' });
  await queryInterface.addIndex('users', ['wallet_address'], { name: 'idx_users_wallet_address' });
  await queryInterface.addIndex('users', ['status'], { name: 'idx_users_status' });
  await queryInterface.addIndex('users', ['role'], { name: 'idx_users_role' });
};

export const down = async (queryInterface) => {
  await queryInterface.dropTable('users');
};
