import { Router } from 'express';
import { authenticate }       from '../../middlewares/auth.middleware.js';
import { requireMuseumAdmin } from '../../middlewares/rbac.middleware.js';
import { validate }           from '../../middlewares/validate.middleware.js';
import { asyncWrapper }       from '../../utils/asyncWrapper.js';
import {
  getUploadUrl,
  registerMedia,
  listFiles,
  getFile,
  deleteFile,
  reorderFile,
} from '../../controllers/file.controller.js';
import {
  uploadUrlSchema,
  registerMediaSchema,
  reorderSchema,
  fileQuerySchema,
} from '../../validators/file.validator.js';

const router = Router();

// GET    /api/v1/files/get-upload-url
router.get('/get-upload-url',
  authenticate,
  requireMuseumAdmin,
  validate(uploadUrlSchema, 'query'),
  asyncWrapper(getUploadUrl),
);

// POST   /api/v1/files/register-media
router.post('/register-media',
  authenticate,
  requireMuseumAdmin,
  validate(registerMediaSchema),
  asyncWrapper(registerMedia),
);

// GET    /api/v1/files/list-all
router.get('/list-all',
  authenticate,
  validate(fileQuerySchema, 'query'),
  asyncWrapper(listFiles),
);

// GET    /api/v1/files/get/:fileId
router.get('/get/:fileId',
  authenticate,
  asyncWrapper(getFile),
);

// DELETE /api/v1/files/delete/:fileId
router.delete('/delete/:fileId',
  authenticate,
  requireMuseumAdmin,
  asyncWrapper(deleteFile),
);

// PATCH  /api/v1/files/reorder/:fileId
router.patch('/reorder/:fileId',
  authenticate,
  requireMuseumAdmin,
  validate(reorderSchema),
  asyncWrapper(reorderFile),
);

export default router;
