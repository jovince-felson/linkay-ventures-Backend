import { Router } from 'express';
import express from 'express';
import { verifySumsubWebhook } from '../middlewares/sumsub.webhook.js';
import { initKyc, getKycStatus, kycWebhook } from '../controllers/kyc.controller.js';

const router = Router();

/**
 * POST /api/v1/ekyc/handle-sumsub-webhook
 * No JWT — gateway allows this through without auth.
 * express.raw() captures the raw body before express.json() can parse it,
 * which is required for HMAC-SHA256 signature verification.
 */
router.post(
  '/handle-sumsub-webhook',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    req.rawBody = req.body.toString('utf8');
    req.body = JSON.parse(req.rawBody);
    next();
  },
  verifySumsubWebhook,
  kycWebhook,
);

// Protected routes — gateway validates JWT and injects x-user-* headers
router.post('/init', initKyc);
router.get('/status', getKycStatus);

export default router;
