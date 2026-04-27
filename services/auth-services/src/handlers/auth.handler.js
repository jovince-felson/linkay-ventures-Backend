/**
 * auth.handler.js
 * Internal event handler for auth domain events.
 * Extend this to publish to an event bus (RabbitMQ, Kafka, etc.) in later phases.
 */
import { AUTH_EVENTS } from '../events/auth.events.js';
import logger from '../utils/logger.js';

class AuthEventHandler {
  constructor() {
    this.listeners = new Map();
    this._registerDefaults();
  }

  /**
   * Register a listener for an event
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  /**
   * Emit an event with a payload
   * @param {string} event
   * @param {object} payload
   */
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

  /**
   * Register default internal handlers
   */
  _registerDefaults() {
    this.on(AUTH_EVENTS.USER_REGISTERED, async ({ userId, email }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.USER_REGISTERED} — userId: ${userId}, email: ${email}`);
      // TODO: Publish to message broker for notification-service, ekyc-service, etc.
    });

    this.on(AUTH_EVENTS.EMAIL_VERIFIED, async ({ userId }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.EMAIL_VERIFIED} — userId: ${userId}`);
      // TODO: Notify ekyc-service to initiate KYC flow
    });

    this.on(AUTH_EVENTS.WALLET_BOUND, async ({ userId, walletAddress }) => {
      logger.info(`[EVENT] ${AUTH_EVENTS.WALLET_BOUND} — userId: ${userId}, wallet: ${walletAddress}`);
      // TODO: Publish WALLET_BOUND to compliance-service / identity-registry
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

// Singleton instance
const authEventHandler = new AuthEventHandler();

export default authEventHandler;
