/**
 * db_init.js — run once to create the database and seed roles
 * Usage: node scripts/db_init.js
 */
import 'dotenv/config';
import { connectDB } from '../src/config/database.js';
import { User, AuditLog, WalletNonce } from '../src/models/index.js';
import logger from '../src/utils/logger.js';

const init = async () => {
  try {
    logger.info('Initialising database...');
    await connectDB();
    logger.info('Tables synced successfully');

    // Check if super admin already seeded
    const adminExists = await User.findOne({ where: { role: 'SUPER_ADMIN' } });
    if (!adminExists) {
      logger.info('No SUPER_ADMIN found. Please create one via the API or add a seeder.');
    }

    logger.info('Database initialisation complete.');
    process.exit(0);
  } catch (error) {
    logger.error('Database initialisation failed:', error);
    process.exit(1);
  }
};

init();
