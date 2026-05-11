import 'dotenv/config';
import { createApp }       from './src/config/app.js';
import { connectDatabase } from './src/config/database.js';
import { initFileConsumer } from './src/handlers/file.handler.js';
import { getProducer }     from 'linkay-shared-utils';
import { logger }          from 'linkay-shared-utils';

const PORT = process.env.PORT || 4007;

async function bootstrap() {
  try {
    await connectDatabase();
    logger.info('✅ Database connected');

    await getProducer();
    logger.info('✅ Kafka producer ready');

    await initFileConsumer();
    logger.info('✅ Kafka consumers initialised');

    const app = createApp();
    app.listen(PORT, () => {
      logger.info(`🚀 File Service running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('❌ Bootstrap failed:', err);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

bootstrap();
