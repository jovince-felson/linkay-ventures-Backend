import { Router } from 'express';
import { verifyInternalRequest } from '../middlewares/internalVerify.middleware.js';
import { updateKycStatus } from '../controllers/internal.kyc.controller.js';

const router = Router();

router.use(verifyInternalRequest);

router.post('/kyc/status-update', updateKycStatus);

export default router;
