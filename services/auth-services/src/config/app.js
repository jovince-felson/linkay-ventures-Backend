

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import authRoutes from '../routes/auth.routes.js';
import adminRoutes from '../routes/admin.routes.js';
import internalKycRoutes from '../routes/internal.kyc.routes.js';
import { errorHandler } from '../middlewares/error.middleware.js';
import { notFound } from '../middlewares/notFound.middleware.js';
import logger from '../utils/logger.js';

const app = express();

// Security headers
app.use(helmet());

// CORS


// Body parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// HTTP request logger
app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) },
}));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-services', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/internal', internalKycRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
