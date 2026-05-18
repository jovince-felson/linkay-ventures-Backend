import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  skipSuccessfulRequests: true,
  // Key by IP + email so users on a shared/proxy IP don't exhaust each other's counter.
  // Falling back to req.ip alone means one user hitting 15 failures blocks everyone
  // behind the same gateway IP.
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toLowerCase().trim();
    return `login:${req.ip}:${email}`;
  },
  skip: (req) => !req.body?.email,
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




// import rateLimit from 'express-rate-limit';

// export const loginRateLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5,
//   skipSuccessfulRequests: true,
//   message: {
//     success: false,
//     errorCode: 'AUTH_004',
//     message: 'Too many failed attempts. Try again in 15 minutes.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// export const generalRateLimiter = rateLimit({
//   windowMs: 60 * 1000, // 1 minute
//   max: 60,
//   message: {
//     success: false,
//     message: 'Too many requests. Please slow down.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// export const walletNonceRateLimiter = rateLimit({
//   windowMs: 5 * 60 * 1000, // 5 minutes
//   max: 10,
//   message: {
//     success: false,
//     message: 'Too many nonce requests. Please try again later.',
//   },
// });
