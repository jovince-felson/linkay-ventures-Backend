import { User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

// GET /internal/user/:userId
export const getInternalUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId, { attributes: ['id', 'walletAddress'] });
    if (!user) throw new AppError('User not found.', 404);
    return res.json({ success: true, walletAddress: user.walletAddress || null });
  } catch (error) {
    next(error);
  }
};

// POST /internal/kyc/status-update
// Called by eKYC service after Sumsub webhook is processed.
export const updateKycStatus = async (req, res, next) => {
  try {
    const { userId, kycStatus, kycApplicantId } = req.body;

    if (!userId || !kycStatus) {
      throw new AppError('userId and kycStatus are required.', 400);
    }

    const VALID_STATUSES = ['NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUIRED'];
    if (!VALID_STATUSES.includes(kycStatus)) {
      throw new AppError(`Invalid kycStatus: ${kycStatus}`, 400);
    }

    const user = await User.findByPk(userId);
    if (!user) throw new AppError('User not found.', 404);

    const updates = { kycStatus };
    if (kycApplicantId) updates.kycApplicantId = kycApplicantId;

    await user.update(updates);

    logger.info(`[Internal KYC] userId=${userId} kycStatus updated → ${kycStatus}`);

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
