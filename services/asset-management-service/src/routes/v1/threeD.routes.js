import { Router }       from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { asyncWrapper } from '../../utils/asyncWrapper.js';
import {
  upload3DImages,
  generate3DTask,
  get3DTaskStatus,
  saveGenerated3D,
  download3DModel,
  proxyGlb,
  proxyVideo,
} from '../../controllers/threeD.controller.js';

const router = Router();

// ── Authenticated routes ───────────────────────────────────────────────────────

// POST /api/v1/3d/generate  — upload images → Meshy task → DB record
router.post('/generate',  authenticate, upload3DImages, asyncWrapper(generate3DTask));

// GET  /api/v1/3d/status/:taskId  — poll Meshy + update DB
router.get('/status/:taskId',  authenticate, asyncWrapper(get3DTaskStatus));

// POST /api/v1/3d/save/:taskId  — store Meshy URLs in DB (no file download)
router.post('/save/:taskId',   authenticate, asyncWrapper(saveGenerated3D));

// GET  /api/v1/3d/download/:taskId  — authenticated GLB download (for "Download" button)
router.get('/download/:taskId', authenticate, asyncWrapper(download3DModel));

// ── Public proxy routes (no auth — needed for <video> and useGLTF) ─────────────

// GET /api/v1/3d/public/glb/:taskId   — 3D viewer (useGLTF cannot send Bearer)
router.get('/public/glb/:taskId',   asyncWrapper(proxyGlb));

// GET /api/v1/3d/public/video/:taskId — <video> tag cannot send Bearer
router.get('/public/video/:taskId', asyncWrapper(proxyVideo));

export default router;
