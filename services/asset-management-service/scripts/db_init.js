import 'dotenv/config';
import { connectDatabase } from '../src/config/database.js';
import { sequelize }       from '../src/models/index.js';
import { logger }          from 'linkay-shared-utils';

(async () => {
  try {
    await connectDatabase();
    logger.info('Database connected');

    await sequelize.sync({ alter: true });
    logger.info('Database synced (alter mode)');

    await sequelize.close();
    logger.info('Done');
    process.exit(0);
  } catch (err) {
    logger.error('DB init failed:', err);
    process.exit(1);
  }
})();
