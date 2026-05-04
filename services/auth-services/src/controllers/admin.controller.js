import { Op } from 'sequelize';
import User from '../models/User.js';

const EXCLUDED_FIELDS = [
  'passwordHash',
  'refreshTokenHash',
  'emailVerificationToken',
  'passwordResetToken',
  'passwordResetExpires',
  'failedLoginAttempts',
  'lockedUntil',
];

export const getPendingMuseumUsers = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      where: {
        is_museum_user: true,
        status: 'PENDING_VERIFICATION',
      },
      attributes: { exclude: EXCLUDED_FIELDS },
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      message: 'Pending museum users fetched successfully',
      data: {
        users: rows,
        pagination: {
          total:      count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error('[getPendingMuseumUsers]', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};