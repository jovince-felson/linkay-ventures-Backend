import { Router } from 'express';
import { authenticate }                                     from '../../middlewares/auth.middleware.js';
import { requireMuseumAdmin, requireAnyAdmin, requireInvestor } from '../../middlewares/rbac.middleware.js';
import { validate }                                         from '../../middlewares/validate.middleware.js';
import { asyncWrapper }                                     from '../../utils/asyncWrapper.js';
import {
  listAssets,
  listLiveAssets,
  createAsset,
  getAsset,
  updateAsset,
  deleteAsset,
  patchAssetStatus,
  publishAsset,
  previewAsset,
  upsertOwnership,
  adminStats,
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

/**
 * When the request is multipart/form-data (file upload), multer puts every
 * text field into req.body as a plain string.  This middleware re-parses any
 * JSON-encoded string fields so Joi validation and the controller receive the
 * correct JS types (array / number / etc.).
 */
function parseFormDataJsonFields(req, _res, next) {
  const JSON_FIELDS = ['dynamicFields', 'dynamicFieldMeta'];
  for (const key of JSON_FIELDS) {
    if (req.body[key] && typeof req.body[key] === 'string') {
      try { req.body[key] = JSON.parse(req.body[key]); } catch { /* leave as string */ }
    }
  }
  next();
}

// GET  /api/v1/assets/admin-stats  — SUPER_ADMIN only
router.get('/admin-stats',
  authenticate,
  asyncWrapper(adminStats),
);

// GET  /api/v1/assets/list-all  — Museum Admin sees own assets, SUPER_ADMIN sees all
router.get('/list-all',
  authenticate,
  validate(assetQuerySchema, 'query'),
  asyncWrapper(listAssets),
);

// GET  /api/v1/assets/marketplace  — Investor sees all LIVE assets across all museums
router.get('/marketplace',
  authenticate,
  requireInvestor,
  validate(assetQuerySchema, 'query'),
  asyncWrapper(listLiveAssets),
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
