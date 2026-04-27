import { DataTypes } from 'sequelize';

export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('audit_logs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      // Soft reference — no FK constraint so logs survive user deletion
    },
    event: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ip_address: {
      type: DataTypes.STRING(45), // supports IPv6
      allowNull: true,
    },
    user_agent: {
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
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('audit_logs', ['user_id'], { name: 'idx_audit_logs_user_id' });
  await queryInterface.addIndex('audit_logs', ['event'], { name: 'idx_audit_logs_event' });
  await queryInterface.addIndex('audit_logs', ['created_at'], { name: 'idx_audit_logs_created_at' });
};

export const down = async (queryInterface) => {
  await queryInterface.dropTable('audit_logs');
};
