import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    errorCode: 'AUTH_004',
    message: 'Too many failed attempts. Try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const walletNonceRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many nonce requests. Please try again later.',
  },
});
