import { Router } from 'express';
import { authenticate }                         from '../../middlewares/auth.middleware.js';
import { requireMuseumAdmin }                   from '../../middlewares/rbac.middleware.js';
import { validate }                             from '../../middlewares/validate.middleware.js';
import { asyncWrapper }                         from '../../utils/asyncWrapper.js';
import {
  createAuction,
  listAuctions,
  getAuction,
  updateAuction,
  patchAuctionStatus,
  deleteAuction,
  placeBid,
  listBids,
  getPublicAuction,
} from '../../controllers/auction.controller.js';
import {
  createAuctionSchema,
  updateAuctionSchema,
  patchAuctionStatusSchema,
} from '../../validators/auction.validator.js';

const router = Router();

// POST   /api/v1/auctions
router.post('/',
  authenticate,
  requireMuseumAdmin,
  validate(createAuctionSchema),
  asyncWrapper(createAuction),
);

// GET    /api/v1/auctions
router.get('/',
  authenticate,
  requireMuseumAdmin,
  asyncWrapper(listAuctions),
);

// GET    /api/v1/auctions/:auctionId
router.get('/:auctionId',
  authenticate,
  requireMuseumAdmin,
  asyncWrapper(getAuction),
);

// PATCH  /api/v1/auctions/:auctionId
router.patch('/:auctionId',
  authenticate,
  requireMuseumAdmin,
  validate(updateAuctionSchema),
  asyncWrapper(updateAuction),
);

// PATCH  /api/v1/auctions/:auctionId/status
router.patch('/:auctionId/status',
  authenticate,
  requireMuseumAdmin,
  validate(patchAuctionStatusSchema),
  asyncWrapper(patchAuctionStatus),
);

// DELETE /api/v1/auctions/:auctionId
router.delete('/:auctionId',
  authenticate,
  requireMuseumAdmin,
  asyncWrapper(deleteAuction),
);

// POST /api/v1/auctions/:auctionId/bid  — investor records bid after on-chain tx
router.post('/:auctionId/bid',
  authenticate,
  asyncWrapper(placeBid),
);

// GET /api/v1/auctions/:auctionId/bids  — bid history
router.get('/:auctionId/bids',
  authenticate,
  asyncWrapper(listBids),
);

// GET /api/v1/auctions/public/:auctionId  — public auction detail + bids (no museum restriction)
router.get('/public/:auctionId',
  authenticate,
  asyncWrapper(getPublicAuction),
);

export default router;
