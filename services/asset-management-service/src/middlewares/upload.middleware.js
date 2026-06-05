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

const fileFilter = (_req, file, cb) => {
  const allowed = /image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime|x-msvideo)/;
  cb(null, allowed.test(file.mimetype));
};

export const uploadMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 30 },
}).fields([
  { name: 'mediaFiles',       maxCount: 10 },
  { name: 'dynamicFieldFiles', maxCount: 20 },
]);
