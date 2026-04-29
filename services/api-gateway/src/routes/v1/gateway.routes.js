import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { SERVICESV1 } from "../../config/services.js";
import { verifyToken, ValidateSession } from "../../middlewares/auth.js";
//import { VerifyAdmin } from "rhoam-shared-utils";
import { GetLogs } from "../../controllers/log.controller.js";

const router = express.Router();

//router.post("/api/v1/logs", VerifyAdmin, GetLogs);

router.use(
  "/api/v1/auth",
  createProxyMiddleware({
    target: SERVICESV1.AUTH_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/auth${path}`,
  }),
);




router.use(
  "/api/v1/notification",
  verifyToken,
  ValidateSession,
  createProxyMiddleware({
    target: SERVICESV1.NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/notification${path}`,
  }),
);

router.use(
  "/api/v1/ekyc/handle-sumsub-webhook",
  createProxyMiddleware({
    target: SERVICESV1.EKYC_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/ekyc/handle-sumsub-webhook`,
  }),
);

router.use(
  "/api/v1/ekyc",
  verifyToken,
  ValidateSession,
  createProxyMiddleware({
    target: SERVICESV1.EKYC_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite: (path) => `/api/v1/ekyc${path}`,
  }),
);

router.use(
  "/api/v1/file",
  verifyToken,
  ValidateSession,
  createProxyMiddleware({
    target: SERVICESV1.FILE_UPLOAD_SERVICE_URL,
    changeOrigin: true,
    logLevel: "debug",
    proxyTimeout: 60000,
    timeout: 60000,
    pathRewrite: (path) => `/api/v1/file${path}`,
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
