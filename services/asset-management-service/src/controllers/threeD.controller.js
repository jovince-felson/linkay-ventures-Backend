import fs    from 'fs';
import path  from 'path';
import axios from 'axios';
import multer from 'multer';
import { sendSuccess, sendCreated, sendError } from '../utils/response.js';
import { logger }                               from 'linkay-shared-utils';

const MESHY_API_KEY = process.env.MESHY_API_KEY;
const MESHY_BASE    = 'https://api.meshy.ai/openapi/v1';

// Local storage directory for generated 3D files
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', '3d-generated');

// Ensure directory exists at startup
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer — memory storage (images only used for base64, not persisted) ──────
const storage = multer.memoryStorage();

const imageFilter = (_req, file, cb) => {
  cb(null, /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype));
};

export const upload3DImages = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
}).array('images', 10);

// ── Helper ─────────────────────────────────────────────────────────────────────
function toBase64DataUrl(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

function glbPath(taskId)   { return path.join(UPLOAD_DIR, `${taskId}.glb`); }
function videoPath(taskId) { return path.join(UPLOAD_DIR, `${taskId}.mp4`); }

// Download a URL to a local file path
async function downloadToFile(url, destPath) {
  const response = await axios.get(url, { responseType: 'stream', timeout: 120_000 });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// ── POST /api/v1/3d/generate ──────────────────────────────────────────────────
export async function generate3DTask(req, res) {
  if (!MESHY_API_KEY) return sendError(res, 'MESHY_API_KEY not configured', 503);

  const files = req.files;
  if (!files || files.length === 0)
    return sendError(res, 'At least one image file is required', 400);

  const imageUrls = files.map(f => toBase64DataUrl(f.buffer, f.mimetype));

  try {
    const response = await axios.post(
      `${MESHY_BASE}/multi-image-to-3d`,
      { image_urls: imageUrls, should_texture: true, enable_pbr: true, target_formats: ['glb'] },
      { headers: { Authorization: `Bearer ${MESHY_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 60_000 },
    );

    const meshyTaskId = response.data.result;
    logger.info(`[3D] Meshy task created: ${meshyTaskId}`);

    return sendCreated(res, { taskId: meshyTaskId }, '3D generation task created');
  } catch (err) {
    const httpStatus = err.response?.status;
    const rawMsg     = err.response?.data?.message || err.response?.data?.error || err.message || '';

    let userMsg;
    if (httpStatus === 402 || /insufficient|credit|fund|payment/i.test(rawMsg)) {
      userMsg = 'MESHY_CREDITS_EXHAUSTED';
    } else if (err.code === 'ECONNABORTED' || /timeout/i.test(rawMsg)) {
      userMsg = 'MESHY_TIMEOUT';
    } else if (httpStatus === 401 || /unauthorized|invalid.*key/i.test(rawMsg)) {
      userMsg = 'MESHY_INVALID_KEY';
    } else {
      userMsg = rawMsg || 'Meshy API error';
    }

    logger.error(`[3D] Failed to create task (${httpStatus ?? 'timeout'}): ${rawMsg}`);
    return sendError(res, userMsg, httpStatus || 502);
  }
}

// ── GET /api/v1/3d/status/:taskId ─────────────────────────────────────────────
export async function get3DTaskStatus(req, res) {
  if (!MESHY_API_KEY) return sendError(res, 'MESHY_API_KEY not configured', 503);

  const { taskId } = req.params;

  try {
    const response = await axios.get(
      `${MESHY_BASE}/multi-image-to-3d/${taskId}`,
      { headers: { Authorization: `Bearer ${MESHY_API_KEY}` }, timeout: 15_000 },
    );
    const task = response.data;

    const payload = {
      taskId,
      status:   task.status,
      progress: task.progress ?? null,
    };

    if (task.status === 'SUCCEEDED') {
      // If already saved locally, return local proxy URLs; otherwise return Meshy URLs
      const hasGlb   = fs.existsSync(glbPath(taskId));
      const hasVideo = fs.existsSync(videoPath(taskId));

      payload.glbUrl   = hasGlb   ? `/api/v1/3d/public/glb/${taskId}`   : (task.model_urls?.glb || null);
      payload.videoUrl = hasVideo ? `/api/v1/3d/public/video/${taskId}` : (task.video_url || null);
    }

    return sendSuccess(res, payload);
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Meshy API error';
    logger.error(`[3D] Status fetch failed for ${taskId}: ${msg}`);
    return sendError(res, msg, err.response?.status || 502);
  }
}

// ── POST /api/v1/3d/save/:taskId ──────────────────────────────────────────────
// Downloads GLB + video from Meshy and saves to local filesystem.
export async function saveGenerated3D(req, res) {
  if (!MESHY_API_KEY) return sendError(res, 'MESHY_API_KEY not configured', 503);
  const { taskId } = req.params;

  // If already downloaded, return local proxy URLs immediately
  const localGlb   = glbPath(taskId);
  const localVideo = videoPath(taskId);

  if (fs.existsSync(localGlb)) {
    logger.info(`[3D] Returning cached local files for: ${taskId}`);
    return sendSuccess(res, {
      glbUrl:   `/api/v1/3d/public/glb/${taskId}`,
      videoUrl: fs.existsSync(localVideo) ? `/api/v1/3d/public/video/${taskId}` : null,
    }, 'Cached');
  }

  // Fetch URLs from Meshy
  let glbUrl, videoUrl;
  try {
    const response = await axios.get(
      `${MESHY_BASE}/multi-image-to-3d/${taskId}`,
      { headers: { Authorization: `Bearer ${MESHY_API_KEY}` }, timeout: 15_000 },
    );
    const task = response.data;
    if (task.status !== 'SUCCEEDED')
      return sendError(res, `Task not completed (status: ${task.status})`, 400);
    glbUrl   = task.model_urls?.glb || null;
    videoUrl = task.video_url       || null;
  } catch (err) {
    return sendError(res, err.response?.data?.message || err.message, 502);
  }

  if (!glbUrl) return sendError(res, 'No GLB URL returned by Meshy', 404);

  // Download GLB to local disk
  try {
    await downloadToFile(glbUrl, localGlb);
    logger.info(`[3D] GLB saved locally: ${taskId}`);
  } catch (err) {
    logger.error(`[3D] Failed to download GLB for ${taskId}: ${err.message}`);
    return sendError(res, 'Failed to download GLB file', 502);
  }

  // Download video to local disk (best-effort)
  if (videoUrl) {
    try {
      await downloadToFile(videoUrl, localVideo);
      logger.info(`[3D] Video saved locally: ${taskId}`);
    } catch (err) {
      logger.warn(`[3D] Video download failed for ${taskId}: ${err.message}`);
    }
  }

  return sendSuccess(res, {
    glbUrl:   `/api/v1/3d/public/glb/${taskId}`,
    videoUrl: fs.existsSync(localVideo) ? `/api/v1/3d/public/video/${taskId}` : null,
  }, '3D files saved locally');
}

// ── GET /api/v1/3d/public/glb/:taskId ─────────────────────────────────────────
export async function proxyGlb(req, res) {
  const { taskId } = req.params;
  const filePath = glbPath(taskId);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath, {
      headers: {
        'Content-Type':        'model/gltf-binary',
        'Content-Disposition': `inline; filename="model-${taskId}.glb"`,
        'Cache-Control':       'public, max-age=86400',
      },
    }, (err) => {
      if (err && !res.headersSent) sendError(res, 'Failed to send GLB file', 500);
    });
  }

  // Fallback: proxy from Meshy if file not downloaded yet
  if (!MESHY_API_KEY) return sendError(res, 'GLB not available for this task', 404);

  try {
    const response = await axios.get(
      `${MESHY_BASE}/multi-image-to-3d/${taskId}`,
      { headers: { Authorization: `Bearer ${MESHY_API_KEY}` }, timeout: 15_000 },
    );
    const glbUrl = response.data.model_urls?.glb;
    if (!glbUrl) return sendError(res, 'GLB not available for this task', 404);

    const glbRes = await axios.get(glbUrl, { responseType: 'stream', timeout: 60_000 });
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `inline; filename="model-${taskId}.glb"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (glbRes.headers['content-length']) res.setHeader('Content-Length', glbRes.headers['content-length']);
    glbRes.data.pipe(res);
  } catch (err) {
    return sendError(res, 'Failed to proxy GLB', 502);
  }
}

// ── GET /api/v1/3d/public/video/:taskId ───────────────────────────────────────
export async function proxyVideo(req, res) {
  const { taskId } = req.params;
  const filePath = videoPath(taskId);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath, {
      headers: {
        'Content-Type':        'video/mp4',
        'Content-Disposition': `inline; filename="preview-${taskId}.mp4"`,
        'Accept-Ranges':       'bytes',
        'Cache-Control':       'public, max-age=86400',
      },
    }, (err) => {
      if (err && !res.headersSent) sendError(res, 'Failed to send video file', 500);
    });
  }

  // Fallback: proxy from Meshy if file not downloaded yet
  if (!MESHY_API_KEY) return sendError(res, 'Video not available for this task', 404);

  try {
    const response = await axios.get(
      `${MESHY_BASE}/multi-image-to-3d/${taskId}`,
      { headers: { Authorization: `Bearer ${MESHY_API_KEY}` }, timeout: 15_000 },
    );
    const videoUrl = response.data.video_url;
    if (!videoUrl) return sendError(res, 'Video not available for this task', 404);

    const videoRes = await axios.get(videoUrl, { responseType: 'stream', timeout: 60_000 });
    res.setHeader('Content-Type', videoRes.headers['content-type'] || 'video/mp4');
    res.setHeader('Content-Disposition', `inline; filename="preview-${taskId}.mp4"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (videoRes.headers['content-length']) res.setHeader('Content-Length', videoRes.headers['content-length']);
    videoRes.data.pipe(res);
  } catch (err) {
    return sendError(res, 'Failed to proxy video', 502);
  }
}

// ── GET /api/v1/3d/download/:taskId ──────────────────────────────────────────
export async function download3DModel(req, res) {
  const { taskId } = req.params;
  const filePath = glbPath(taskId);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath, {
      headers: {
        'Content-Type':        'model/gltf-binary',
        'Content-Disposition': `attachment; filename="model-${taskId}.glb"`,
      },
    }, (err) => {
      if (err && !res.headersSent) sendError(res, 'Failed to send GLB file', 500);
    });
  }

  return sendError(res, 'GLB file not found. Please save the model first.', 404);
}
