import { Router } from 'express';
import { authenticate }                       from '../../middlewares/auth.middleware.js';
import { requireMuseumAdmin, requireAnyAdmin } from '../../middlewares/rbac.middleware.js';
import { validate }                           from '../../middlewares/validate.middleware.js';
import { asyncWrapper }                       from '../../utils/asyncWrapper.js';
import {
  listAssets,
  createAsset,
  getAsset,
  updateAsset,
  deleteAsset,
  patchAssetStatus,
  publishAsset,
  previewAsset,
  upsertOwnership,
} from '../../controllers/asset.controller.js';
import { tokenizeAsset, getTokenizationStatus } from '../../controllers/tokenization.controller.js';
import {
  createAssetSchema,
  updateAssetSchema,
  patchStatusSchema,
  assetQuerySchema,
} from '../../validators/asset.validator.js';
import { ownershipSplitSchema, tokenizeSchema } from '../../validators/ownership.validator.js';

const router = Router();

// GET    /api/v1/assets/list-all
router.get('/list-all',
  authenticate,
  validate(assetQuerySchema, 'query'),
  asyncWrapper(listAssets),
);

// POST   /api/v1/assets/create
router.post('/create',
  authenticate,
  requireMuseumAdmin,
  validate(createAssetSchema),
  asyncWrapper(createAsset),
);

// GET    /api/v1/assets/get/:assetId
router.get('/get/:assetId',
  authenticate,
  asyncWrapper(getAsset),
);

// PATCH  /api/v1/assets/update/:assetId
router.patch('/update/:assetId',
  authenticate,
  requireMuseumAdmin,
  validate(updateAssetSchema),
  asyncWrapper(updateAsset),
);

// DELETE /api/v1/assets/delete/:assetId
router.delete('/delete/:assetId',
  authenticate,
  requireMuseumAdmin,
  asyncWrapper(deleteAsset),
);

// PATCH  /api/v1/assets/change-status/:assetId
router.patch('/change-status/:assetId',
  authenticate,
  requireAnyAdmin,
  validate(patchStatusSchema),
  asyncWrapper(patchAssetStatus),
);

// PATCH  /api/v1/assets/publish/:assetId
router.patch('/publish/:assetId',
  authenticate,
  requireMuseumAdmin,
  asyncWrapper(publishAsset),
);

// GET    /api/v1/assets/preview/:assetId
router.get('/preview/:assetId',
  authenticate,
  asyncWrapper(previewAsset),
);

// PUT    /api/v1/assets/set-ownership/:assetId
router.put('/set-ownership/:assetId',
  authenticate,
  requireMuseumAdmin,
  validate(ownershipSplitSchema),
  asyncWrapper(upsertOwnership),
);

// POST   /api/v1/assets/tokenize/:assetId
router.post('/tokenize/:assetId',
  authenticate,
  requireMuseumAdmin,
  validate(tokenizeSchema),
  asyncWrapper(tokenizeAsset),
);

// GET    /api/v1/assets/tokenization-status/:assetId
router.get('/tokenization-status/:assetId',
  authenticate,
  asyncWrapper(getTokenizationStatus),
);

export default router;
