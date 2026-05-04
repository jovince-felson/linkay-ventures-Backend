import { DataTypes } from 'sequelize';
import 'dotenv/config';
import sequelize from '../config/database.js';

export const up = async (queryInterface) => {
  await queryInterface.addColumn('users', 'is_super_admin', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  });

  await queryInterface.addColumn('users', 'is_user', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  });

  await queryInterface.addColumn('users', 'is_museum_user', {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  });

  await queryInterface.addColumn('users', 'rejected_reason', {
    type: DataTypes.STRING(1000),
    allowNull: true,
  });
};

export const down = async (queryInterface) => {
  await queryInterface.removeColumn('users', 'is_super_admin');
  await queryInterface.removeColumn('users', 'is_user');
  await queryInterface.removeColumn('users', 'is_museum_user');
  await queryInterface.removeColumn('users', 'rejected_reason');
};

// Standalone runner
const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('Running migration: 005_add_missing_columns_to_users');
    await up(sequelize.getQueryInterface());
    console.log('✓ Done');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
};

run();
