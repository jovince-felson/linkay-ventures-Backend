import { User } from '../models/index.js';
import { generateResetToken, verifyToken } from '../utils/jwt.util.js';
import { hashPassword } from '../utils/crypto.util.js';
import { writeAuditLog, AuditEvents } from '../utils/auditLog.util.js';
import { AppError } from '../utils/AppError.js';
import authEventHandler from '../handlers/auth.handler.js';
import { AUTH_EVENTS } from '../events/auth.events.js';
import logger from '../utils/logger.js';

// POST /auth/forgot-password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Anti-enumeration: always return the same message
    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (user && user.status === 'ACTIVE') {
      const resetPayload = { userId: user.id, email: user.email, action: 'password_reset' };
      const resetToken = generateResetToken(resetPayload);

      await user.update({ passwordResetToken: resetToken, passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) });

      await writeAuditLog({ userId: user.id, event: AuditEvents.PASSWORD_RESET_REQUEST, req });
      // Emit event — handler publishes to Kafka → notification service sends the reset email
      authEventHandler.emit(AUTH_EVENTS.PASSWORD_RESET_REQUEST, {
        email: user.email,
        firstName: user.firstName,
        resetToken,
      });
    }

    return res.json({
      success: true,
      message: 'Reset email sent if account exists',
    });
  } catch (error) {
    next(error);
  }
};

// POST /auth/reset-password
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Password reset link has expired. Please request a new one.', 410);
      }
      throw new AppError('Invalid reset token.', 400);
    }

    if (decoded.action !== 'password_reset') {
      throw new AppError('Invalid token type.', 400);
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) throw new AppError('User not found.', 404);

    // Validate stored token matches (single-use)
    if (user.passwordResetToken !== token) {
      throw new AppError('Invalid or already used reset token.', 400);
    }

    if (!user.passwordResetExpires || new Date() > new Date(user.passwordResetExpires)) {
      throw new AppError('Password reset link has expired. Please request a new one.', 410);
    }

    const passwordHash = await hashPassword(newPassword);

    // Invalidate all sessions on password reset
    await user.update({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshTokenHash: null, // invalidate all refresh tokens
    });

    await writeAuditLog({ userId: user.id, event: AuditEvents.PASSWORD_RESET_SUCCESS, req });
    authEventHandler.emit(AUTH_EVENTS.PASSWORD_RESET, { userId: user.id });

    return res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};
