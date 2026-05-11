import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import kycRoutes from '../routes/kyc.routes.js';
import { errorHandler } from '../middlewares/error.middleware.js';
import { notFound } from '../middlewares/notFound.middleware.js';
import logger from '../utils/logger.js';

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email', 'x-user-role'],
}));

// Raw body capture for Sumsub webhook HMAC verification (must be before express.json)
app.use('/api/v1/ekyc/handle-sumsub-webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10kb' }));

app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) },
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ekyc-service', timestamp: new Date().toISOString() });
});

app.use('/api/v1/ekyc', kycRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
