import express          from 'express';
import path             from 'path';
import { errorHandler } from '../middlewares/error.middleware.js';
import assetRoutes      from '../routes/v1/asset.routes.js';
import auctionRoutes    from '../routes/v1/auction.routes.js';
import threeDRoutes     from '../routes/v1/threeD.routes.js';

export function createApp() {
  const app = express();

  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.use((req, _res, next) => {
    req.requestTime = new Date().toISOString();
    next();
  });

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: 'asset-management-service', ts: new Date() }),
  );

  // 3D routes use multer for multipart — must NOT have global body-parser above them
  app.use('/api/v1/3d', threeDRoutes);

  // JSON body-parser only for non-multipart routes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/v1/assets', assetRoutes);
  app.use('/api/v1/auctions', auctionRoutes);

  app.use(errorHandler);

  return app;
}
