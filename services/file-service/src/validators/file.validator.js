import Joi from 'joi';

const ALLOWED_MIME_TYPES = [
  // images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  // video
  'video/mp4', 'video/quicktime', 'video/webm',
  // 3D models
  'model/gltf-binary', 'model/gltf+json', 'application/octet-stream',
  // documents
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export const uploadUrlSchema = Joi.object({
  assetId:      Joi.string().uuid().required(),
  fileName:     Joi.string().max(300).required(),
  mimeType:     Joi.string().valid(...ALLOWED_MIME_TYPES).required(),
  fileSize:     Joi.number().integer().min(1).max(MAX_FILE_SIZE).required(),
  mediaType:    Joi.string().valid('IMAGE', 'VIDEO', '3D_MODEL', 'DOCUMENT').required(),
});

export const registerMediaSchema = Joi.object({
  assetId:      Joi.string().uuid().required(),
  fileKey:      Joi.string().max(500).required(),
  fileUrl:      Joi.string().uri().max(1000).required(),
  originalName: Joi.string().max(300).allow('', null).optional(),
  mimeType:     Joi.string().max(100).required(),
  fileSize:     Joi.number().integer().min(1).required(),
  mediaType:    Joi.string().valid('IMAGE', 'VIDEO', '3D_MODEL', 'DOCUMENT').required(),
  isPrimary:    Joi.boolean().default(false),
  displayOrder: Joi.number().integer().min(0).default(0),
});

export const reorderSchema = Joi.object({
  displayOrder: Joi.number().integer().min(0).required(),
  isPrimary:    Joi.boolean().optional(),
});

export const fileQuerySchema = Joi.object({
  assetId:   Joi.string().uuid().optional(),
  mediaType: Joi.string().valid('IMAGE', 'VIDEO', '3D_MODEL', 'DOCUMENT').optional(),
  isPrimary: Joi.boolean().optional(),
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(20),
});
