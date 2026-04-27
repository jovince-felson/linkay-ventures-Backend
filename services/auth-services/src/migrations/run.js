/**
 * migrations/run.js
 * Manual migration runner — executes all migration files in order.
 * Usage: node src/migrations/run.js
 */
import 'dotenv/config';
import sequelize from '../config/database.js';
import { up as createUsers } from './001_create_users.js';
import { up as createAuditLogs } from './002_create_audit_logs.js';
import { up as createWalletNonces } from './003_create_wallet_nonces.js';
import logger from '../utils/logger.js';

const migrations = [
  { name: '001_create_users', fn: createUsers },
  { name: '002_create_audit_logs', fn: createAuditLogs },
  { name: '003_create_wallet_nonces', fn: createWalletNonces },
];

const runMigrations = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected. Running migrations...');

    for (const migration of migrations) {
      logger.info(`Running migration: ${migration.name}`);
      await migration.fn(sequelize.getQueryInterface(), sequelize);
      logger.info(`✓ ${migration.name} complete`);
    }

    logger.info('All migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
