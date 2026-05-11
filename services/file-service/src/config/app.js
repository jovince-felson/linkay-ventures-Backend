import express          from 'express';
import { errorHandler } from '../middlewares/error.middleware.js';
import fileRoutes       from '../routes/v1/file.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req, _res, next) => {
    req.requestTime = new Date().toISOString();
    next();
  });

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: 'file-service', ts: new Date() }),
  );

  app.use('/api/v1/files', fileRoutes);

  app.use(errorHandler);

  return app;
}
