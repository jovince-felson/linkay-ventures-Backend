import { DataTypes } from 'sequelize';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import sequelize from '../config/database.js';

export const up = async (queryInterface) => {
  await queryInterface.addColumn('users', 'museum_id', {
    type: DataTypes.UUID,
    allowNull: true,
  });
};

export const down = async (queryInterface) => {
  await queryInterface.removeColumn('users', 'museum_id');
};

// Standalone runner
const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('Running migration: 004_add_museum_id_to_users');
    await up(sequelize.getQueryInterface());
    console.log('✓ Done');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
}
