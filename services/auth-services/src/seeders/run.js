/**
 * seeders/run.js
 * Usage: node src/seeders/run.js
 */
import 'dotenv/config';
import { connectDB } from '../config/database.js';
import { seedSuperAdmin } from './superAdmin.seeder.js';
import logger from '../utils/logger.js';

const run = async () => {
  try {
    await connectDB();
    logger.info('Running seeders...');

    await seedSuperAdmin();

    logger.info('All seeders completed.');
    process.exit(0);
  } catch (error) {
    logger.error('Seeder failed:', error);
    process.exit(1);
  }
};

run();
