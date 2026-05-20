import { Router }        from 'express';
import { authenticate }  from '../../middlewares/auth.middleware.js';
import { asyncWrapper }  from '../../utils/asyncWrapper.js';
import { initiateTokenization, getJobStatus } from '../../controllers/tokenization.controller.js';

const router = Router();

// POST /api/v1/tokenization/mint
// Body: { assetId, network? }
router.post('/mint',
  authenticate,
  asyncWrapper(initiateTokenization),
);

// GET /api/v1/tokenization/status/:jobId
router.get('/status/:jobId',
  authenticate,
  asyncWrapper(getJobStatus),
);

export default router;
