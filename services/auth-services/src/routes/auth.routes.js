import { Router } from 'express';
import {
  register,
  verifyEmail,
  login,
  logout,
  refreshToken,
  getMe,
  getPendingMuseumUsers,
} from '../controllers/auth.controller.js';
import { getWalletNonce, bindWallet } from '../controllers/wallet.controller.js';
import { forgotPassword, resetPassword } from '../controllers/password.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  loginRateLimiter,
  generalRateLimiter,
  walletNonceRateLimiter,
} from '../middlewares/rateLimiter.middleware.js';
import {
  registerValidator,
  loginValidator,
  walletNonceValidator,
  walletBindValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from '../validators/auth.validator.js';

const router = Router();

// Apply general rate limiter to all auth routes
router.use(generalRateLimiter);

// --- Public routes ---
router.post('/register', registerValidator, validate, register);
router.get('/verify-email', verifyEmail);
router.post('/login', loginRateLimiter, loginValidator, validate, login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, resetPassword);

// --- Protected routes ---
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.get('/pending-museum-users', authenticate, authorize('SUPER_ADMIN'), getPendingMuseumUsers);

// --- Wallet routes (protected) ---
router.get('/walletnonce', authenticate, walletNonceRateLimiter, walletNonceValidator, validate, getWalletNonce);
router.post('/wallet-bind', authenticate, walletBindValidator, validate, bindWallet);

export default router;
