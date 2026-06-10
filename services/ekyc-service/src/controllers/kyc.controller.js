import { ethers }          from 'ethers';
import { KycApplicant }    from '../models/index.js';
import { AppError }        from '../utils/AppError.js';
import { createApplicant, generateSDKToken } from '../services/sumsub.service.js';
import { sumsubConfig }    from '../config/sumsub.js';
import logger              from '../utils/logger.js';
import { getIdentityRegistry } from '../blockchain/contracts.js';

const AUTH_URL         = process.env.AUTH_SERVICE_URL         || 'http://localhost:3001';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4002';
const INTERNAL_KEY     = process.env.INTERNAL_SERVICE_KEY     || '';
const CONTRACTS_ENABLED = process.env.CONTRACTS_ENABLED === 'true';

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

const fetchInternalUser = async (userId) => {
  try {
    const res = await fetch(`${AUTH_URL}/internal/user/${userId}`, {
      headers: { 'x-internal-service': INTERNAL_KEY },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.walletAddress || null;
  } catch (err) {
    logger.error(`[eKYC] fetchInternalUser error: ${err.message}`);
    return null;
  }
};

// Register wallet on-chain: addIdentity + addClaim(topic 1) + addClaim(topic 3)
const registerOnChain = async ({ walletAddress, applicantId, countryCode }) => {
  if (!CONTRACTS_ENABLED) {
    logger.info('[eKYC] CONTRACTS_ENABLED=false — skipping on-chain KYC registration (mock)');
    return;
  }

  const registry     = getIdentityRegistry();
  const identityHash = ethers.keccak256(ethers.toUtf8Bytes(applicantId));

  // Check if already registered to allow idempotent retries
  const alreadyRegistered = await registry.isRegistered(walletAddress);

  if (!alreadyRegistered) {
    const tx1 = await registry.addIdentity(walletAddress, identityHash);
    await tx1.wait(1);
    logger.info(`[eKYC] addIdentity tx=${tx1.hash} wallet=${walletAddress}`);
  } else {
    logger.warn(`[eKYC] wallet ${walletAddress} already registered — skipping addIdentity`);
  }

  // topic 1 — KYC_VERIFIED: data = applicantId as utf8 bytes, uri = empty
  const kycData = ethers.toUtf8Bytes(applicantId);
  const tx2     = await registry.addClaim(walletAddress, 1n, kycData, '');
  await tx2.wait(1);
  logger.info(`[eKYC] addClaim(topic=1) tx=${tx2.hash}`);

  // topic 3 — JURISDICTION_ELIGIBLE: data = country code as bytes2
  const country  = (countryCode || 'US').slice(0, 2).toUpperCase();
  const jData    = ethers.toBeHex(ethers.toBigInt(ethers.toUtf8Bytes(country)), 2);
  const tx3      = await registry.addClaim(walletAddress, 3n, jData, '');
  await tx3.wait(1);
  logger.info(`[eKYC] addClaim(topic=3) tx=${tx3.hash}`);
};

// POST /internal/kyc/register-onchain
// Called by auth-service after wallet is bound, if user is already KYC APPROVED
export const registerOnChainForWallet = async (req, res, next) => {
  try {
    const { userId, walletAddress } = req.body;
    if (!userId || !walletAddress) {
      return res.status(400).json({ success: false, message: 'userId and walletAddress are required' });
    }

    const record = await KycApplicant.findOne({ where: { userId } });
    if (!record || record.status !== 'APPROVED') {
      return res.json({ success: true, message: 'KYC not approved — skipping on-chain registration' });
    }

    try {
      await registerOnChain({
        walletAddress,
        applicantId: record.applicantId,
        countryCode: record.countryCode || 'US',
      });
      logger.info(`[eKYC] On-chain registration complete for wallet=${walletAddress} userId=${userId}`);
      return res.json({ success: true, message: 'On-chain registration complete' });
    } catch (err) {
      logger.error(`[eKYC] On-chain registration failed for wallet=${walletAddress}: ${err.message}`);
      return res.status(500).json({ success: false, message: err.message });
    }
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/ekyc/init
// Gateway injects x-user-id, x-user-email from the verified JWT.
export const initKyc = async (req, res, next) => {
  try {
   const userId = req.headers['x-user-id'];
   const userEmail = req.headers['x-user-email'];
   const firstName = req.headers['x-user-first-name'];
   const lastName = req.headers['x-user-last-name'];


    if (!userId) throw new AppError('User identity missing from request headers.', 401);

    let record = await KycApplicant.findOne({ where: { userId } });

    if (record?.status === 'APPROVED') {
      return res.json({ success: true, message: 'KYC already approved.', kycStatus: 'APPROVED' });
    }

    if (!record) {
      const applicantId = await createApplicant({
        externalUserId: userId,
        email: userEmail,
        firstName,
        lastName,
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
    } else if (reviewAnswer === 'YELLOW') {
      newStatus = 'PENDING';
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

    // Notify user via push notification
    await callInternal(NOTIFICATION_URL, '/internal/push/kyc-status', {
      userId: externalUserId,
      kycStatus: newStatus,
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};
