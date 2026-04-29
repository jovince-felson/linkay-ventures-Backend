import 'dotenv/config';
import app from './config/app.js';
import { connectDB } from './config/database.js';
import { startNonceCleanup, stopNonceCleanup } from './handlers/nonceCleanup.handler.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();
    logger.info('MySQL database connected successfully');

    // Start background job: purge expired wallet nonces every 10 minutes
    startNonceCleanup();

    const server = app.listen(PORT, () => {
      logger.info(`Auth service running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      stopNonceCleanup();
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start auth service:', error);
    process.exit(1);
  }
};

startServer();
