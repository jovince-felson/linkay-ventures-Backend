// import express from "express";
// import { createProxyMiddleware } from "http-proxy-middleware";
// import { SERVICESV1 } from "../../config/services.js";
// import { verifyToken } from "../../middlewares/auth.js";
// import { GetLogs } from "../../controllers/log.controller.js";

// const router = express.Router();

// // Auth routes — public (no JWT required at gateway level)
// router.use(
//   "/api/v1/auth",
//   createProxyMiddleware({
//     target: SERVICESV1.AUTH_SERVICE_URL,
//     changeOrigin: true,
//     logLevel: "debug",
//     proxyTimeout: 30000,
//     timeout: 30000,
//     pathRewrite: (path) => `/auth${path}`,
//   }),
// );

// // Notification routes — JWT required
// router.use(
//   "/api/v1/notification",
//   verifyToken,
//   createProxyMiddleware({
//     target: SERVICESV1.NOTIFICATION_SERVICE_URL,
//     changeOrigin: true,
//     logLevel: "debug",
//     proxyTimeout: 30000,
//     timeout: 30000,
//     pathRewrite: (path) => `/api/v1/notification${path}`,
//   }),
// );

// // eKYC webhook — public (Sumsub calls this directly, no JWT)
// router.use(
//   "/api/v1/ekyc/handle-sumsub-webhook",
//   createProxyMiddleware({
//     target: SERVICESV1.EKYC_SERVICE_URL,
//     changeOrigin: true,
//     logLevel: "debug",
//     proxyTimeout: 30000,
//     timeout: 30000,
//     pathRewrite: () => `/api/v1/ekyc/handle-sumsub-webhook`,
//   }),
// );

// // eKYC routes — JWT required
// router.use(
//   "/api/v1/ekyc",
//   verifyToken,
//   createProxyMiddleware({
//     target: SERVICESV1.EKYC_SERVICE_URL,
//     changeOrigin: true,
//     logLevel: "debug",
//     proxyTimeout: 30000,
//     timeout: 30000,
//     pathRewrite: (path) => `/api/v1/ekyc${path}`,
//   }),
// );

// // File upload routes — JWT required
// router.use(
//   "/api/v1/file",
//   verifyToken,
//   createProxyMiddleware({
//     target: SERVICESV1.FILE_UPLOAD_SERVICE_URL,
//     changeOrigin: true,
//     logLevel: "debug",
//     proxyTimeout: 60000,
//     timeout: 60000,
//     pathRewrite: (path) => `/api/v1/file${path}`,
//   }),
// );
// router.use(
//   "/api/v1/admin",
//   verifyToken,
//   createProxyMiddleware({
//     target: SERVICESV1.AUTH_SERVICE_URL,
//     changeOrigin: true,
//     logLevel: "debug",
//     proxyTimeout: 30000,
//     timeout: 30000,
//     pathRewrite: (path) => `/api/v1/admin${path}`,
//   }),
// );
// router.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "Gateway route not found",
//     path: req.originalUrl,
//   });
// });

// export default router;


import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { SERVICESV1 } from "../../config/services.js";
import { verifyToken } from "../../middlewares/auth.js";

const router = express.Router();

const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

const injectCors = (proxyRes, req) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    proxyRes.headers['access-control-allow-origin'] = origin;
    proxyRes.headers['access-control-allow-credentials'] = 'true';
  }
};

// Auth routes — public
router.use(
  "/api/v1/auth",
  createProxyMiddleware({
    target: SERVICESV1.AUTH_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/auth${path}`,
    on: { proxyRes: injectCors },
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
    on: { proxyRes: injectCors },
  }),
);

// eKYC webhook — public (Sumsub calls this, no JWT)
router.use(
  "/api/v1/ekyc/handle-sumsub-webhook",
  createProxyMiddleware({
    target: SERVICESV1.EKYC_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: () => `/api/v1/ekyc/handle-sumsub-webhook`,
    on: { proxyRes: injectCors },
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
    on: { proxyRes: injectCors },
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
    on: { proxyRes: injectCors },
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
