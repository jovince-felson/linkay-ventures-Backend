import { Router } from 'express';
import { authenticate }     from '../../middlewares/auth.middleware.js';
import { asyncWrapper }     from '../../utils/asyncWrapper.js';
import {
  upload3DImages,
  generate3DTask,
  get3DTaskStatus,
  download3DModel,
  stream3DVideo,
  saveGenerated3D,
} from '../../controllers/threeD.controller.js';

const router = Router();

// POST  /api/v1/3d/generate
// Museum admin uploads images → backend calls Meshy → returns { taskId }
router.post(
  '/generate',
  authenticate,
  upload3DImages,
  asyncWrapper(generate3DTask),
);

// GET   /api/v1/3d/status/:taskId
// Poll Meshy task status from backend (no CORS, no key exposure)
router.get(
  '/status/:taskId',
  authenticate,
  asyncWrapper(get3DTaskStatus),
);

// GET   /api/v1/3d/download/:taskId
// Backend proxies the GLB binary to the browser (solves Meshy CORS block)
router.get(
  '/download/:taskId',
  authenticate,
  asyncWrapper(download3DModel),
);

// POST  /api/v1/3d/save/:taskId
// Downloads video + GLB from Meshy → saves to uploads/3d-generated/ → returns local URLs
router.post(
  '/save/:taskId',
  authenticate,
  asyncWrapper(saveGenerated3D),
);

// GET   /api/v1/3d/video/:taskId
// Backend streams the Meshy preview video to the browser (solves Meshy CORS block)
router.get(
  '/video/:taskId',
  authenticate,
  asyncWrapper(stream3DVideo),
);

export default router;
