import { AUTH_EVENTS } from '../events/auth.events.js';
import logger from '../utils/logger.js';

const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4002';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

const notifyService = async (path, body) => {
  try {
    const res = await fetch(`${NOTIFICATION_URL}/internal${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': INTERNAL_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error(`Notification service error [${path}]: ${res.status} ${text}`);
    }
  } catch (err) {
    // Never block the auth flow if notification service is down
    logger.error(`Failed to reach notification service [${path}]:`, err.message);
  }
};

class AuthEventHandler {
  constructor() {
    this.listeners = new Map();
    this._registerDefaults();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  async emit(event, payload) {
    const handlers = this.listeners.get(event) || [];
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (error) {
        logger.error(`Event handler error for event "${event}":`, error);
      }
    }
  }

  _registerDefaults() {
    this.on(AUTH_EVENTS.USER_REGISTERED, async ({ userId, email, firstName, emailToken }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.USER_REGISTERED} — userId: ${userId}`);
      const verificationLink = `${process.env.FRONTEND_URL}/auth/verify-email?token=${emailToken}`;
      await notifyService('/email/verification', { email, firstName, verificationLink });
    });

    this.on(AUTH_EVENTS.EMAIL_VERIFIED, async ({ userId }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.EMAIL_VERIFIED} — userId: ${userId}`);
    });

    this.on(AUTH_EVENTS.PASSWORD_RESET_REQUEST, async ({ email, firstName, resetToken }) => {
      const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
      await notifyService('/email/password-reset', { email, firstName, resetLink });
    });

    this.on(AUTH_EVENTS.WALLET_BOUND, async ({ userId, walletAddress }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.WALLET_BOUND} — userId: ${userId}, wallet: ${walletAddress}`);
    });

    this.on(AUTH_EVENTS.USER_LOGGED_IN, async ({ userId }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.USER_LOGGED_IN} — userId: ${userId}`);
    });

    this.on(AUTH_EVENTS.USER_LOGGED_OUT, async ({ userId }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.USER_LOGGED_OUT} — userId: ${userId}`);
    });

    this.on(AUTH_EVENTS.PASSWORD_RESET, async ({ userId }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.PASSWORD_RESET} — userId: ${userId}`);
    });
  }
}

const authEventHandler = new AuthEventHandler();

export default authEventHandler;
