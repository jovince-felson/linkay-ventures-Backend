import 'dotenv/config';
import { createApp }        from './src/config/app.js';
import { connectDatabase }  from './src/config/database.js';
import { initAssetConsumer } from './src/handlers/asset.handler.js';
import { getProducer }      from 'linkay-shared-utils';
import { logger }           from 'linkay-shared-utils';

const PORT = process.env.PORT || 4006;

async function bootstrap() {
  try {
    await connectDatabase();
    logger.info('✅ Database connected');

    await getProducer();
    logger.info('✅ Kafka producer ready');

    await initAssetConsumer();
    logger.info('✅ Kafka consumers initialised');

    const app = createApp();
    app.listen(PORT, () => {
      logger.info(`🚀 Asset Management Service running on port ${PORT}`);
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
