/**
 * nonceCleanup.handler.js
 * Periodic job to purge expired wallet nonces from the DB.
 * Runs every 10 minutes to keep the wallet_nonces table clean.
 */
import { Op } from 'sequelize';
import { WalletNonce } from '../models/index.js';
import logger from '../utils/logger.js';

let cleanupInterval = null;

export const startNonceCleanup = (intervalMs = 10 * 60 * 1000) => {
  if (cleanupInterval) return; // already running

  cleanupInterval = setInterval(async () => {
    try {
      const deleted = await WalletNonce.destroy({
        where: {
          [Op.or]: [
            { expiresAt: { [Op.lt]: new Date() } },
            { used: true },
          ],
        },
      });
      if (deleted > 0) {
        logger.info(`[NonceCleanup] Purged ${deleted} expired/used nonce(s).`);
      }
    } catch (error) {
      logger.error('[NonceCleanup] Failed to purge nonces:', error);
    }
  }, intervalMs);

  logger.info(`[NonceCleanup] Started. Interval: ${intervalMs / 1000}s`);
};

export const stopNonceCleanup = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[NonceCleanup] Stopped.');
  }
};
