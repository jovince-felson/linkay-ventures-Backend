import { ethers } from 'ethers';
import { User, WalletNonce } from '../models/index.js';
import { generateNonce } from '../utils/crypto.util.js';
import authEventHandler from '../handlers/auth.handler.js';
import { AUTH_EVENTS } from '../events/auth.events.js';
import { writeAuditLog, AuditEvents } from '../utils/auditLog.util.js';
import { AppError } from '../utils/AppError.js';
import { Op } from 'sequelize';
import { generateAccessToken, buildAccessPayload } from '../utils/jwt.util.js';
import logger from '../utils/logger.js';

const EKYC_URL      = process.env.EKYC_SERVICE_URL    || 'http://localhost:4004';
const INTERNAL_KEY  = process.env.INTERNAL_SERVICE_KEY || '';

const triggerOnChainKyc = async (userId, walletAddress) => {
  try {
    const res = await fetch(`${EKYC_URL}/internal/kyc/register-onchain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': INTERNAL_KEY,
      },
      body: JSON.stringify({ userId, walletAddress }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error(`[WalletBind] On-chain KYC trigger failed: ${res.status} ${text}`);
    }
  } catch (err) {
    logger.error(`[WalletBind] On-chain KYC trigger error: ${err.message}`);
  }
};

// GET /auth/walletnonce?address=<eth_address>
export const getWalletNonce = async (req, res, next) => {
  try {
    const { address } = req.query;

    // Normalise to EIP-55 checksum format
    let checksumAddress;
    try {
      checksumAddress = ethers.getAddress(address);
    } catch {
      throw new AppError('Invalid wallet address format.', 400);
    }

    // Invalidate any prior unused nonces for this address
    await WalletNonce.destroy({ where: { address: checksumAddress, used: false } });

    const nonce = generateNonce();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const record = await WalletNonce.create({ address: checksumAddress, nonce, expiresAt });

    return res.json({
      success: true,
      nonce,
      createdAt: record.createdAt,
      expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

// POST /auth/wallet-bind
export const bindWallet = async (req, res, next) => {
  try {
    const { address, signature, nonce } = req.body;
    const userId = req.user.userId;

    // Normalise address
    let checksumAddress;
    try {
      checksumAddress = ethers.getAddress(address);
    } catch {
      throw new AppError('Invalid wallet address format.', 400);
    }

    // Check nonce validity — must exist, be unused, and not expired
    const walletNonce = await WalletNonce.findOne({
      where: {
        address: checksumAddress,
        nonce,
        used: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!walletNonce) {
      throw new AppError('Invalid or expired nonce. Please request a new one.', 400);
    }

    // Verify signature using ethers.js
    const message = `Sign to verify wallet ownership. Nonce: ${nonce}`;
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      throw new AppError('Signature verification failed.', 400);
    }

    if (ethers.getAddress(recoveredAddress) !== checksumAddress) {
      throw new AppError('Signature does not match wallet address.', 400);
    }

    // Mark nonce as used immediately (single-use, delete to prevent replay)
    await WalletNonce.destroy({ where: { id: walletNonce.id } });

    // Check if wallet already bound to another user
    const existingBinding = await User.findOne({
      where: { walletAddress: checksumAddress },
    });

    if (existingBinding && existingBinding.id !== userId) {
      throw new AppError(
        'This wallet is already connected to a different account.',
        409,
        'AUTH_005'
      );
    }

    // Check if user already has a wallet bound (MVP: one wallet per user)
    const currentUser = await User.findByPk(userId);
    if (!currentUser) throw new AppError('User not found.', 404);

    await currentUser.update({ walletAddress: checksumAddress });

    // If user is already KYC approved, trigger on-chain registration now
    if (currentUser.kycStatus === 'APPROVED') {
      triggerOnChainKyc(userId, checksumAddress);
    }

    authEventHandler.emit(AUTH_EVENTS.WALLET_BOUND, { userId, walletAddress: checksumAddress });
    await writeAuditLog({
      userId,
      event: AuditEvents.WALLET_BOUND,
      req,
      metadata: { walletAddress: checksumAddress },
    });

    const updatedUser = await User.findByPk(userId);
    const newAccessToken = generateAccessToken(buildAccessPayload(updatedUser));

    return res.json({
      success: true,
      walletAddress: checksumAddress,
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};
