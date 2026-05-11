import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { SERVICESV1 } from "../../config/services.js";
import { verifyToken } from "../../middlewares/auth.js";

const router = express.Router();

// Shared error handler for all proxy routes
const onProxyError = (err, req, res) => {
  console.error(`[Proxy Error] ${req.method} ${req.originalUrl} →`, err.message);
  if (!res.headersSent) {
    res.status(502).json({
      success: false,
      message: "Upstream service unavailable",
      path: req.originalUrl,
    });
  }
};

// ── Auth routes — PUBLIC (no JWT) ─────────────────────────────────────────
// Auth service mounts at /auth, so pathRewrite strips /api/v1/auth → /auth
router.use(
  "/api/v1/auth",
  createProxyMiddleware({
    target: SERVICESV1.AUTH_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/auth${path}`,
    on: { error: onProxyError },
  }),
);

// ── Notification routes ────────────────────────────────────────────────────
router.use("/api/v1/notification", verifyToken);
router.use(
  "/api/v1/notification",
  createProxyMiddleware({
    target: SERVICESV1.NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/notification${path}`,
    on: { error: onProxyError },
  }),
);

// ── eKYC webhook — PUBLIC (Sumsub calls directly) ─────────────────────────
router.use(
  "/api/v1/ekyc/handle-sumsub-webhook",
  createProxyMiddleware({
    target: SERVICESV1.EKYC_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: () => `/api/v1/ekyc/handle-sumsub-webhook`,
    on: { error: onProxyError },
  }),
);

// ── eKYC routes ───────────────────────────────────────────────────────────
router.use("/api/v1/ekyc", verifyToken);
router.use(
  "/api/v1/ekyc",
  createProxyMiddleware({
    target: SERVICESV1.EKYC_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/ekyc${path}`,
    on: { error: onProxyError },
  }),
);

// ── File Service routes ───────────────────────────────────────────────────
// Gateway path /api/v1/file → service mounts at /api/v1/files (plural)
router.use("/api/v1/file", verifyToken);
router.use(
  "/api/v1/file",
  createProxyMiddleware({
    target: SERVICESV1.FILE_UPLOAD_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 60000,
    timeout: 60000,
    pathRewrite: (path) => `/api/v1/files${path}`,
    on: { error: onProxyError },
  }),
);

// ── Asset Management routes ───────────────────────────────────────────────
router.use("/api/v1/assets", verifyToken);
router.use(
  "/api/v1/assets",
  createProxyMiddleware({
    target: SERVICESV1.ASSET_MANAGEMENT_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 60000,
    timeout: 60000,
    pathRewrite: (path) => `/api/v1/assets${path}`,
    on: { error: onProxyError },
  }),
);

// ── Admin routes (proxied to auth-service) ────────────────────────────────
router.use("/api/v1/admin", verifyToken);
router.use(
  "/api/v1/admin",
  createProxyMiddleware({
    target: SERVICESV1.AUTH_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/admin${path}`,
    on: { error: onProxyError },
  }),
);

// ── 404 catch-all ─────────────────────────────────────────────────────────
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Gateway route not found",
    path: req.originalUrl,
  });
});

export default router;
