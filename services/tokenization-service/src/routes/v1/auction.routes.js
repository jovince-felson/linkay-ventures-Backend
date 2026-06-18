import { Router }       from 'express';
import { asyncWrapper }  from '../../utils/asyncWrapper.js';
import { scheduleAuction, cancelScheduledAuction, retriggerSettle } from '../../controllers/auction.controller.js';

const router = Router();

router.post('/schedule',                asyncWrapper(scheduleAuction));
router.delete('/schedule/:auctionId',   asyncWrapper(cancelScheduledAuction));
router.post('/settle/:auctionId',       asyncWrapper(retriggerSettle));

export default router;
