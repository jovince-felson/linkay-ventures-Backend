import { Router } from 'express';
import { authenticate }         from '../../middlewares/auth.middleware.js';
import { requireMuseumAdmin }   from '../../middlewares/rbac.middleware.js';
import { asyncWrapper }         from '../../utils/asyncWrapper.js';
import { enhanceDescription }   from '../../controllers/aiEnhance.controller.js';

const router = Router();

// POST /api/v1/ai/enhance
router.post('/enhance',
  authenticate,
  requireMuseumAdmin,
  asyncWrapper(enhanceDescription),
);

export default router;