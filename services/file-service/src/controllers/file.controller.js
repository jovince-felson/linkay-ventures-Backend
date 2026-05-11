import { Op }           from 'sequelize';
import { Media }         from '../models/index.js';
import { fileEvents }    from '../events/file.events.js';
import {
  generatePresignedUploadUrl,
  buildFileKey,
  deleteS3Object,
} from '../utils/s3.js';
import {
  sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError,
} from '../utils/response.js';
import { logger } from 'linkay-shared-utils';

// ── GET /files/upload-url ─────────────────────────────────────────────────────
export async function getUploadUrl(req, res) {
  const { assetId, fileName, mimeType, fileSize, mediaType } = req.query;

  const fileKey = buildFileKey(assetId, mediaType, fileName);
  const { uploadUrl, fileUrl } = await generatePresignedUploadUrl(fileKey, mimeType);

  return sendSuccess(res, {
    uploadUrl,
    fileUrl,
    fileKey,
    expiresIn: Number(process.env.S3_PRESIGN_EXPIRES || 900),
  }, 'Presigned upload URL generated');
}

// ── POST /files/register ──────────────────────────────────────────────────────
export async function registerMedia(req, res) {
  const userId = req.user?.id || req.user?.user_id;
  const {
    assetId, fileKey, fileUrl, originalName,
    mimeType, fileSize, mediaType, isPrimary, displayOrder,
  } = req.body;

  // If this media is primary, unset existing primary for the asset
  if (isPrimary) {
    await Media.update({ isPrimary: false }, { where: { assetId, isPrimary: true } });
  }

  const media = await Media.create({
    assetId,
    fileKey,
    fileUrl,
    originalName,
    mimeType,
    fileSize,
    mediaType,
    isPrimary:    isPrimary || false,
    displayOrder: displayOrder ?? 0,
    uploadedBy:   userId,
  });

  fileEvents.mediaRegistered(media).catch(() => {});
  return sendCreated(res, media, 'Media registered successfully');
}

// ── GET /files ────────────────────────────────────────────────────────────────
export async function listFiles(req, res) {
  const { assetId, mediaType, isPrimary, page = 1, limit = 20 } = req.query;

  const where = { deletedAt: null };
  if (assetId)   where.assetId   = assetId;
  if (mediaType) where.mediaType = mediaType;
  if (isPrimary !== undefined) where.isPrimary = isPrimary === 'true' || isPrimary === true;

  const offset = (page - 1) * limit;
  const { count, rows } = await Media.findAndCountAll({
    where,
    limit:  parseInt(limit),
    offset: parseInt(offset),
    order:  [['displayOrder', 'ASC'], ['createdAt', 'ASC']],
  });

  return sendPaginated(
    res,
    rows,
    { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / limit) },
  );
}

// ── GET /files/:id ────────────────────────────────────────────────────────────
export async function getFile(req, res) {
  const media = await Media.findByPk(req.params.fileId);
  if (!media) return sendNotFound(res, 'Media not found');
  return sendSuccess(res, media);
}

// ── DELETE /files/:id ─────────────────────────────────────────────────────────
export async function deleteFile(req, res) {
  const media = await Media.findByPk(req.params.fileId);
  if (!media) return sendNotFound(res, 'Media not found');

  try {
    await deleteS3Object(media.fileKey);
  } catch (err) {
    logger.warn(`S3 delete failed for ${media.fileKey}:`, err.message);
  }

  const userId = req.user?.id || req.user?.user_id;
  await media.destroy();

  fileEvents.mediaDeleted(media, userId).catch(() => {});
  return sendSuccess(res, null, 'Media deleted successfully');
}

// ── PATCH /files/:id/reorder ──────────────────────────────────────────────────
export async function reorderFile(req, res) {
  const media = await Media.findByPk(req.params.fileId);
  if (!media) return sendNotFound(res, 'Media not found');

  const { displayOrder, isPrimary } = req.body;

  if (isPrimary === true) {
    await Media.update({ isPrimary: false }, { where: { assetId: media.assetId, isPrimary: true } });
  }

  await media.update({
    displayOrder: displayOrder ?? media.displayOrder,
    isPrimary:    isPrimary !== undefined ? isPrimary : media.isPrimary,
  });

  // Emit reorder event
  const allMedia = await Media.findAll({
    where: { assetId: media.assetId, deletedAt: null },
    order: [['displayOrder', 'ASC']],
    attributes: ['id', 'displayOrder'],
  });
  fileEvents.mediaReordered(media.assetId, allMedia).catch(() => {});

  return sendSuccess(res, media, 'Media reordered successfully');
}
