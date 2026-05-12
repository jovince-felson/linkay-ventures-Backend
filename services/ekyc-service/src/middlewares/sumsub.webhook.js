import { verifyWebhookSignature } from '../services/sumsub.service.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

export const verifySumsubWebhook = (req, _res, next) => {
  const sig = req.headers['x-payload-digest'];

  if (!sig) {
    logger.warn('[eKYC Webhook] Missing Sumsub signature header');
    return next(new AppError('Webhook signature missing.', 401));
  }

  try {
    const valid = verifyWebhookSignature(req.rawBody, sig);
    if (!valid) {
      logger.warn('[eKYC Webhook] Signature mismatch — possible spoofed request');
      return next(new AppError('Invalid webhook signature.', 401));
    }
    next();
  } catch {
    return next(new AppError('Webhook verification failed.', 401));
  }
};
