import express from 'express';
import { getPendingMuseumUsers } from '../controllers/admin.controller.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = express.Router();

// GET /api/v1/admin/users/pending-museum?page=1&limit=20
router.get(
  '/users/pending-museum',
  requireRole('SUPER_ADMIN'),
  getPendingMuseumUsers,
);


export default router;