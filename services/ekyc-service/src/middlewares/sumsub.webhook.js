import { verifyWebhookSignature } from '../services/sumsub.service.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

export const verifySumsubWebhook = (req, _res, next) => {
  const sig = req.headers['x-app-access-sig'];
  const ts = req.headers['x-app-access-ts'];

  if (!sig || !ts) {
    logger.warn('[eKYC Webhook] Missing Sumsub signature headers');
    return next(new AppError('Webhook signature missing.', 401));
  }

  try {
    const valid = verifyWebhookSignature(req.rawBody, ts, sig);
    if (!valid) {
      logger.warn('[eKYC Webhook] Signature mismatch — possible spoofed request');
      return next(new AppError('Invalid webhook signature.', 401));
    }
    next();
  } catch {
    return next(new AppError('Webhook verification failed.', 401));
  }
};
