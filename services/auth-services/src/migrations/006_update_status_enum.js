import { DataTypes } from 'sequelize';
import 'dotenv/config';
import sequelize from '../config/database.js';

export const up = async (queryInterface) => {
  await queryInterface.changeColumn('users', 'status', {
    type: DataTypes.ENUM(
      'PENDING_VERIFICATION',
      'ACTIVE',
      'SUSPENDED',
      'DEACTIVATED',
      'ACCEPTED',
      'REJECTED'
    ),
    allowNull: false,
    defaultValue: 'PENDING_VERIFICATION',
  });
};

export const down = async (queryInterface) => {
  await queryInterface.changeColumn('users', 'status', {
    type: DataTypes.ENUM(
      'PENDING_VERIFICATION',
      'ACTIVE',
      'SUSPENDED',
      'DEACTIVATED'
    ),
    allowNull: false,
    defaultValue: 'PENDING_VERIFICATION',
  });
};

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('Running migration: 006_update_status_enum');
    await up(sequelize.getQueryInterface());
    console.log('✓ Done');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
};

run();
