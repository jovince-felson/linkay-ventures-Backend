import { KycApplicant } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { createApplicant, generateSDKToken } from '../services/sumsub.service.js';
import { sumsubConfig } from '../config/sumsub.js';
import logger from '../utils/logger.js';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4002';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

const callInternal = async (baseUrl, path, body) => {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': INTERNAL_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error(`[eKYC] Internal call failed [${path}]: ${res.status} ${text}`);
    }
  } catch (err) {
    logger.error(`[eKYC] Internal call error [${path}]:`, err.message);
  }
};

// POST /api/v1/ekyc/init
// Gateway injects x-user-id, x-user-email from the verified JWT.
export const initKyc = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const userEmail = req.headers['x-user-email'];

    if (!userId) throw new AppError('User identity missing from request headers.', 401);

    let record = await KycApplicant.findOne({ where: { userId } });

    if (record?.status === 'APPROVED') {
      return res.json({ success: true, message: 'KYC already approved.', kycStatus: 'APPROVED' });
    }

    if (!record) {
      const applicantId = await createApplicant({
        externalUserId: userId,
        email: userEmail,
        country: req.headers['x-user-country'] ,
      });

      record = await KycApplicant.create({
        userId,
        userEmail,
        applicantId,
        levelName: sumsubConfig.levelName,
        status: 'PENDING',
      });

      // Sync initial PENDING status to auth-service
      await callInternal(AUTH_URL, '/internal/kyc/status-update', {
        userId,
        kycStatus: 'PENDING',
        kycApplicantId: applicantId,
      });

      logger.info(`[eKYC] Applicant created — userId: ${userId}, applicantId: ${applicantId}`);
    }

    // Always issue a fresh SDK token (1-hour TTL)
    const sdkToken = await generateSDKToken(userId);

    return res.json({ success: true, sdkToken, applicantId: record.applicantId });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/ekyc/status
export const getKycStatus = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) throw new AppError('User identity missing from request headers.', 401);

    const record = await KycApplicant.findOne({
      where: { userId },
      attributes: ['status', 'applicantId', 'levelName', 'createdAt', 'updatedAt'],
    });

    if (!record) {
      return res.json({ success: true, kycStatus: 'NOT_STARTED' });
    }

    return res.json({
      success: true,
      kycStatus: record.status,
      applicantId: record.applicantId,
      levelName: record.levelName,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/ekyc/handle-sumsub-webhook
// No JWT — Sumsub calls this directly, protected by HMAC signature verification.
export const kycWebhook = async (req, res, next) => {
  try {
    const { type, externalUserId, reviewResult } = req.body;

    logger.info(`[eKYC Webhook] type=${type} externalUserId=${externalUserId}`);

    if (type !== 'applicantReviewed') {
      return res.status(200).json({ received: true });
    }

    const record = await KycApplicant.findOne({ where: { userId: externalUserId } });
    if (!record) {
      logger.warn(`[eKYC Webhook] No applicant record for userId: ${externalUserId}`);
      return res.status(200).json({ received: true });
    }

    const { reviewAnswer, reviewRejectType } = reviewResult || {};

    let newStatus;
    if (reviewAnswer === 'GREEN') {
      newStatus = 'APPROVED';
    } else if (reviewAnswer === 'RED' && reviewRejectType === 'RETRY') {
      newStatus = 'RESUBMIT_REQUIRED';
    } else {
      newStatus = 'REJECTED';
    }

    await record.update({ status: newStatus, reviewAnswer, rejectType: reviewRejectType });

    logger.info(`[eKYC Webhook] userId=${externalUserId} → ${newStatus}`);

    // Sync to auth-service (updates User.kycStatus for login response)
    await callInternal(AUTH_URL, '/internal/kyc/status-update', {
      userId: externalUserId,
      kycStatus: newStatus,
      kycApplicantId: record.applicantId,
    });

    // Notify user via email
    const emailPath =
      newStatus === 'APPROVED' ? '/email/kyc-approved' :
      newStatus === 'REJECTED' ? '/email/kyc-rejected' :
      '/email/kyc-resubmit';

    await callInternal(NOTIFICATION_URL, `/internal${emailPath}`, {
      email: record.userEmail,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};
