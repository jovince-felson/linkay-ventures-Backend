import multer from 'multer';

// Allowed MIME types — images, videos, PDFs, Office docs, ZIP, plain text / CSV
const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
]);

const fileFilter = (_req, file, cb) => {
  cb(null, ALLOWED_MIMES.has(file.mimetype));
};

// Use .fields() so both mediaFiles and dynamicFieldFiles arrive in req.files
export const uploadMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 30 },
}).fields([
  { name: 'mediaFiles',        maxCount: 10 },
  { name: 'dynamicFieldFiles', maxCount: 20 },
]);
