import { AuditLog } from '../models/index.js';
import logger from './logger.js';

export const writeAuditLog = async ({ userId = null, event, req, metadata = {}, status = 'SUCCESS' }) => {
  try {
    await AuditLog.create({
      userId,
      event,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      userAgent: req?.headers?.['user-agent'] || null,
      metadata,
      status,
    });
  } catch (error) {
    // Audit log failure should never break the main flow
    logger.error('Failed to write audit log:', error);
  }
};

export const AuditEvents = {
  REGISTER: 'USER_REGISTER',
  LOGIN: 'USER_LOGIN',
  LOGOUT: 'USER_LOGOUT',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  WALLET_BOUND: 'WALLET_BOUND',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  LOGIN_FAILED: 'LOGIN_FAILED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
};
