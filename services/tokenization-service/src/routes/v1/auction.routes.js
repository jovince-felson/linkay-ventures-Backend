import { Router }       from 'express';
import { asyncWrapper }  from '../../utils/asyncWrapper.js';
import { scheduleAuction, cancelScheduledAuction } from '../../controllers/auction.controller.js';

const router = Router();

router.post('/schedule',                asyncWrapper(scheduleAuction));
router.delete('/schedule/:auctionId',   asyncWrapper(cancelScheduledAuction));

export default router;
