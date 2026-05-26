import express          from 'express';
import { errorHandler } from '../middlewares/error.middleware.js';
import tokenizationRoutes from '../routes/v1/tokenization.routes.js';
import auctionRoutes      from '../routes/v1/auction.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: 'tokenization-service', ts: new Date() }),
  );

  app.use('/api/v1/tokenization', tokenizationRoutes);
  app.use('/api/v1/auction',      auctionRoutes);

  app.use(errorHandler);

  return app;
}
