import { Router } from 'express';
import { updateWallet } from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateWalletValidator } from '../validators/auth.validator.js';

const router = Router();

router.patch('/wallet', authenticate, updateWalletValidator, validate, updateWallet);

export default router;
