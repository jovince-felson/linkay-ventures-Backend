import 'dotenv/config';
import app from './config/app.js';
import { connectDB } from './config/database.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 4004;

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      logger.info(`eKYC service running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('eKYC HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start eKYC service:', error);
    process.exit(1);
  }
};

startServer();
