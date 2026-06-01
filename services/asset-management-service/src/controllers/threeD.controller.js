import fs from 'fs';
import path from 'path';
import axios from 'axios';
import multer from 'multer';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import { logger } from 'linkay-shared-utils';

const MESHY_API_KEY = process.env.MESHY_API_KEY;
const MESHY_BASE    = 'https://api.meshy.ai/openapi/v1';

// ── Multer config for 3D image uploads ────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', '3d-images');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const imageFilter = (_req, file, cb) => {
  cb(null, /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype));
};

export const upload3DImages = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
}).array('images', 10);

// ── Helper: file path → base64 data URL ───────────────────────────────────────
function toBase64DataUrl(filePath, mimetype) {
  const buf = fs.readFileSync(filePath);
  return `data:${mimetype};base64,${buf.toString('base64')}`;
}

// ── Helper: cleanup temp files after reading ───────────────────────────────────
function cleanupFiles(files = []) {
  for (const f of files) {
    try { fs.unlinkSync(f.path); } catch (_) { /* ignore */ }
  }
}

// ── POST /api/v1/assets/3d/generate ───────────────────────────────────────────
// Accepts: multipart form with field "images" (up to 10 image files)
// Returns: { taskId }
export async function generate3DTask(req, res) {
  if (!MESHY_API_KEY) {
    return sendError(res, 'MESHY_API_KEY is not configured on the server', 503);
  }

  const files = req.files;
  if (!files || files.length === 0) {
    return sendError(res, 'At least one image file is required', 400);
  }

  let imageUrls;
  try {
    imageUrls = files.map(f => toBase64DataUrl(f.path, f.mimetype));
  } finally {
    cleanupFiles(files);
  }

  try {
    const response = await axios.post(
      `${MESHY_BASE}/multi-image-to-3d`,
      {
        image_urls:     imageUrls,
        should_texture: true,
        enable_pbr:     true,
        target_formats: ['glb'],
      },
      {
        headers: {
          Authorization:  `Bearer ${MESHY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      },
    );

    const taskId = response.data.result;
    logger.info(`[3D] Meshy task created: ${taskId}`);
    return sendCreated(res, { taskId }, '3D generation task created');
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Meshy API error';
    logger.error(`[3D] Failed to create Meshy task: ${msg}`);
    return sendError(res, msg, err.response?.status || 502);
  }
}

// ── GET /api/v1/3d/status/:taskId ────────────────────────────────────────────
// Returns: { status, progress, glbUrl, videoUrl }  (urls only when SUCCEEDED)
export async function get3DTaskStatus(req, res) {
  if (!MESHY_API_KEY) {
    return sendError(res, 'MESHY_API_KEY is not configured on the server', 503);
  }

  const { taskId } = req.params;

  try {
    const response = await axios.get(
      `${MESHY_BASE}/multi-image-to-3d/${taskId}`,
      {
        headers: { Authorization: `Bearer ${MESHY_API_KEY}` },
        timeout: 15_000,
      },
    );

    const task = response.data;

    const payload = {
      taskId,
      status:   task.status,
      progress: task.progress ?? null,
    };

    if (task.status === 'SUCCEEDED') {
      payload.glbUrl   = task.model_urls?.glb ?? null;
      payload.videoUrl = task.video_url       ?? null;
    }

    return sendSuccess(res, payload);
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Meshy API error';
    logger.error(`[3D] Failed to fetch task ${taskId}: ${msg}`);
    return sendError(res, msg, err.response?.status || 502);
  }
}

// ── POST /api/v1/3d/save/:taskId ─────────────────────────────────────────────
// Downloads the Meshy video + GLB, saves to uploads/3d-generated/, returns URLs.
// Idempotent — if already saved, returns cached paths immediately.
export async function saveGenerated3D(req, res) {
  if (!MESHY_API_KEY) {
    return sendError(res, 'MESHY_API_KEY is not configured on the server', 503);
  }

  const { taskId } = req.params;
  const SAVE_DIR   = path.join(process.cwd(), 'uploads', '3d-generated');
  if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

  const videoLocal = path.join(SAVE_DIR, `${taskId}.mp4`);
  const glbLocal   = path.join(SAVE_DIR, `${taskId}.glb`);

  // Return cached files if already downloaded
  if (fs.existsSync(videoLocal) && fs.existsSync(glbLocal)) {
    return sendSuccess(res, {
      videoUrl: `/uploads/3d-generated/${taskId}.mp4`,
      glbUrl:   `/uploads/3d-generated/${taskId}.glb`,
    }, '3D files already saved');
  }

  // Fetch task from Meshy
  let task;
  try {
    const taskRes = await axios.get(
      `${MESHY_BASE}/multi-image-to-3d/${taskId}`,
      { headers: { Authorization: `Bearer ${MESHY_API_KEY}` }, timeout: 15_000 },
    );
    task = taskRes.data;
  } catch (err) {
    return sendError(res, err.response?.data?.message || err.message, 502);
  }

  if (task.status !== 'SUCCEEDED') {
    return sendError(res, `Task not completed (status: ${task.status})`, 400);
  }

  const meshyVideoUrl = task.video_url;
  const meshyGlbUrl   = task.model_urls?.glb;

  if (!meshyVideoUrl && !meshyGlbUrl) {
    return sendError(res, 'No generated files found in Meshy task', 404);
  }

  // Helper: download a URL and save to disk
  async function downloadFile(url, filePath) {
    const response = await axios.get(url, { responseType: 'stream', timeout: 120_000 });
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  try {
    const downloads = [];
    if (meshyVideoUrl && !fs.existsSync(videoLocal)) {
      downloads.push(downloadFile(meshyVideoUrl, videoLocal));
    }
    if (meshyGlbUrl && !fs.existsSync(glbLocal)) {
      downloads.push(downloadFile(meshyGlbUrl, glbLocal));
    }
    await Promise.all(downloads);
  } catch (err) {
    logger.error(`[3D] Failed to download files for task ${taskId}: ${err.message}`);
    return sendError(res, 'Failed to download generated 3D files from Meshy', 502);
  }

  logger.info(`[3D] Saved files for task ${taskId} — video:${!!meshyVideoUrl} glb:${!!meshyGlbUrl}`);
  return sendSuccess(res, {
    videoUrl: (meshyVideoUrl && fs.existsSync(videoLocal)) ? `/uploads/3d-generated/${taskId}.mp4` : null,
    glbUrl:   (meshyGlbUrl   && fs.existsSync(glbLocal))   ? `/uploads/3d-generated/${taskId}.glb`  : null,
  }, '3D files saved successfully');
}

// ── GET /api/v1/3d/video/:taskId ─────────────────────────────────────────────
// Proxies the Meshy preview video through the backend — avoids browser CORS.
export async function stream3DVideo(req, res) {
  if (!MESHY_API_KEY) {
    return sendError(res, 'MESHY_API_KEY is not configured on the server', 503);
  }

  const { taskId } = req.params;

  // 1. Get video URL from task
  let videoUrl;
  try {
    const taskRes = await axios.get(
      `${MESHY_BASE}/multi-image-to-3d/${taskId}`,
      {
        headers: { Authorization: `Bearer ${MESHY_API_KEY}` },
        timeout: 15_000,
      },
    );

    const task = taskRes.data;
    if (task.status !== 'SUCCEEDED') {
      return sendError(res, `Task not completed yet (status: ${task.status})`, 400);
    }

    videoUrl = task.video_url;
    if (!videoUrl) {
      return sendError(res, 'No preview video available for this task', 404);
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return sendError(res, msg, err.response?.status || 502);
  }

  // 2. Stream video from Meshy → client
  try {
    const videoRes = await axios.get(videoUrl, {
      responseType: 'stream',
      timeout: 60_000,
    });

    res.setHeader('Content-Type', videoRes.headers['content-type'] || 'video/mp4');
    res.setHeader('Content-Disposition', `inline; filename="preview-${taskId}.mp4"`);
    res.setHeader('Accept-Ranges', 'bytes');

    if (videoRes.headers['content-length']) {
      res.setHeader('Content-Length', videoRes.headers['content-length']);
    }

    videoRes.data.pipe(res);
  } catch (err) {
    logger.error(`[3D] Failed to stream video for task ${taskId}: ${err.message}`);
    return sendError(res, 'Failed to stream 3D preview video from Meshy', 502);
  }
}

// ── GET /api/v1/assets/3d/download/:taskId ────────────────────────────────────
// Proxies the GLB file from Meshy to the browser — avoids browser CORS block.
export async function download3DModel(req, res) {
  if (!MESHY_API_KEY) {
    return sendError(res, 'MESHY_API_KEY is not configured on the server', 503);
  }

  const { taskId } = req.params;

  // 1. Fetch task to get the GLB URL
  let glbUrl;
  try {
    const taskRes = await axios.get(
      `${MESHY_BASE}/multi-image-to-3d/${taskId}`,
      {
        headers: { Authorization: `Bearer ${MESHY_API_KEY}` },
        timeout: 15_000,
      },
    );

    const task = taskRes.data;
    if (task.status !== 'SUCCEEDED') {
      return sendError(res, `Task is not completed yet (status: ${task.status})`, 400);
    }

    glbUrl = task.model_urls?.glb;
    if (!glbUrl) {
      return sendError(res, 'GLB URL not found in task result', 404);
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return sendError(res, msg, err.response?.status || 502);
  }

  // 2. Stream the GLB file through this server to the client
  try {
    const glbRes = await axios.get(glbUrl, { responseType: 'stream', timeout: 60_000 });

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `attachment; filename="model-${taskId}.glb"`);

    if (glbRes.headers['content-length']) {
      res.setHeader('Content-Length', glbRes.headers['content-length']);
    }

    glbRes.data.pipe(res);
  } catch (err) {
    logger.error(`[3D] Failed to download GLB for task ${taskId}: ${err.message}`);
    return sendError(res, 'Failed to download 3D model from Meshy', 502);
  }
}
