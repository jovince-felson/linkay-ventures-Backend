import { Router } from 'express';
import { authenticate }        from '../../middlewares/auth.middleware.js';
import { requireMuseumAdmin }  from '../../middlewares/rbac.middleware.js';
import { asyncWrapper }        from '../../utils/asyncWrapper.js';
import { suggestDescription }  from '../../controllers/aiSuggest.controller.js';

const router = Router();

// POST /api/v1/ai/suggest-description
router.post('/suggest-description',
  authenticate,
  requireMuseumAdmin,
  asyncWrapper(suggestDescription),
);

export default router;
