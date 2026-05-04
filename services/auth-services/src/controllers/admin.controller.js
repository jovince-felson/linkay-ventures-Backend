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

export const reviewMuseumUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, rejectedReason } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be either "accept" or "reject"',
      });
    }

    if (action === 'reject' && !rejectedReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'rejectedReason is required when rejecting a user',
      });
    }

    const user = await User.findOne({
      where: { id: userId, is_museum_user: true, status: 'PENDING_VERIFICATION' },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pending museum user not found',
      });
    }

    if (action === 'accept') {
      user.status = 'ACCEPTED';
      user.rejectedReason = null;
    } else {
      user.status = 'REJECTED';
      user.rejectedReason = rejectedReason.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Museum user ${action === 'accept' ? 'accepted' : 'rejected'} successfully`,
      data: { userId: user.id, status: user.status },
    });
  } catch (error) {
    console.error('[reviewMuseumUser]', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

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