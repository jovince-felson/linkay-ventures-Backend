import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { globalRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { errorHandler } from '../middlewares/error.middleware.js';
import { notFound } from '../middlewares/notFound.middleware.js';
import { requestLogger } from '../middlewares/requestLogger.middleware.js';
import healthRoutes from '../routes/health.routes.js';
import { services } from './services.js';
import logger from '../utils/logger.js';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Cookie parser — required to forward httpOnly refresh-token cookies to upstream
app.use(cookieParser());

// HTTP request logger
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Global rate limiter
app.use(globalRateLimiter);

// Request logger
app.use(requestLogger);

// ─── Health ──────────────────────────────────────────────────────────────────
app.use('/health', healthRoutes);

// ─── Proxy factory ───────────────────────────────────────────────────────────

/**
 * Build a proxy middleware for a downstream service.
 * - Forwards the real client IP as X-Forwarded-For
 * - Tags every proxied request with X-Gateway-Source
 * - Returns a clean 502 JSON body on upstream errors
 */
const buildProxy = (target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    cookieDomainRewrite: '',
    on: {
      error: (err, _req, res) => {
        logger.error(`Proxy error → ${target}: ${err.message}`);
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            message: 'Upstream service temporarily unavailable. Please try again.',
          });
        }
      },
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Forwarded-For', req.ip || '');
        proxyReq.setHeader('X-Gateway-Source', 'api-gateway');
      },
    },
  });

// ─── Service routes ───────────────────────────────────────────────────────────

// Auth service — /auth/* → auth-services
app.use(services.auth.prefix, buildProxy(services.auth.url));

// ─── Fallbacks ────────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
