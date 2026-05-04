import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { SERVICESV1 } from "../../config/services.js";
import { verifyToken } from "../../middlewares/auth.js";
import { GetLogs } from "../../controllers/log.controller.js";

const router = express.Router();

// Auth routes — public (no JWT required at gateway level)
router.use(
  "/api/v1/auth",
  createProxyMiddleware({
    target: SERVICESV1.AUTH_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/auth${path}`,
  }),
);

// Notification routes — JWT required
router.use(
  "/api/v1/notification",
  verifyToken,
  createProxyMiddleware({
    target: SERVICESV1.NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/notification${path}`,
  }),
);

// eKYC webhook — public (Sumsub calls this directly, no JWT)
router.use(
  "/api/v1/ekyc/handle-sumsub-webhook",
  createProxyMiddleware({
    target: SERVICESV1.EKYC_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: () => `/api/v1/ekyc/handle-sumsub-webhook`,
  }),
);

// eKYC routes — JWT required
router.use(
  "/api/v1/ekyc",
  verifyToken,
  createProxyMiddleware({
    target: SERVICESV1.EKYC_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/ekyc${path}`,
  }),
);

// File upload routes — JWT required
router.use(
  "/api/v1/file",
  verifyToken,
  createProxyMiddleware({
    target: SERVICESV1.FILE_UPLOAD_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 60000,
    timeout: 60000,
    pathRewrite: (path) => `/api/v1/file${path}`,
  }),
);
router.use(
  "/api/v1/admin",
  verifyToken,
  createProxyMiddleware({
    target: SERVICESV1.AUTH_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/admin${path}`,
  }),
);
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Gateway route not found",
    path: req.originalUrl,
  });
});

export default router;
