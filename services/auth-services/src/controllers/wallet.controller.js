import { ethers } from 'ethers';
import { User, WalletNonce } from '../models/index.js';
import { generateNonce } from '../utils/crypto.util.js';
import authEventHandler from '../handlers/auth.handler.js';
import { AUTH_EVENTS } from '../events/auth.events.js';
import { writeAuditLog, AuditEvents } from '../utils/auditLog.util.js';
import { AppError } from '../utils/AppError.js';
import { Op } from 'sequelize';

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

    await WalletNonce.create({ address: checksumAddress, nonce, expiresAt });

    return res.json({
      success: true,
      nonce,
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
    const message = `Sign to verify wallet ownership. Nonce: ${nonce}. Time: ${walletNonce.createdAt.toISOString()}`;
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

    authEventHandler.emit(AUTH_EVENTS.WALLET_BOUND, { userId, walletAddress: checksumAddress });
    await writeAuditLog({
      userId,
      event: AuditEvents.WALLET_BOUND,
      req,
      metadata: { walletAddress: checksumAddress },
    });

    return res.json({
      success: true,
      walletAddress: checksumAddress,
    });
  } catch (error) {
    next(error);
  }
};
