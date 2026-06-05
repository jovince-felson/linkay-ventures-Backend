import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'assets');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

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
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 30 },
}).fields([
  { name: 'mediaFiles',       maxCount: 10 },
  { name: 'dynamicFieldFiles', maxCount: 20 },
]);
