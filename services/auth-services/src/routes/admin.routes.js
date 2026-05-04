import express from 'express';
import { getPendingMuseumUsers, reviewMuseumUser } from '../controllers/admin.controller.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = express.Router();

// GET /api/v1/admin/users/pending-museum?page=1&limit=20
router.get(
  '/users/pending-museum',
  requireRole('SUPER_ADMIN'),
  getPendingMuseumUsers,
);


// PATCH /api/v1/admin/users/:userId/review
router.patch(
  '/users/:userId/review',
  requireRole('SUPER_ADMIN'),
  reviewMuseumUser,
);

export default router;