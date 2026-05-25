import { Router }        from 'express';
import { authenticate }  from '../../middlewares/auth.middleware.js';
import { asyncWrapper }  from '../../utils/asyncWrapper.js';
import { initiateTokenization, getJobStatus, treasuryReview } from '../../controllers/tokenization.controller.js';

const router = Router();

// POST /api/v1/tokenization/mint
router.post('/mint',
  authenticate,
  asyncWrapper(initiateTokenization),
);

// GET /api/v1/tokenization/status/:jobId
router.get('/status/:jobId',
  authenticate,
  asyncWrapper(getJobStatus),
);

// PATCH /api/v1/tokenization/:assetId/treasury-review
// Body: { action: 'approve' | 'reject', reason?: string }
router.patch('/:assetId/treasury-review',
  authenticate,
  asyncWrapper(treasuryReview),
);

export default router;
