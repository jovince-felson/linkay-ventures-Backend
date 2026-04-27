import { User } from '../models/index.js';
import {
  generateAccessToken,
  generateRefreshToken,
  generateEmailToken,
  verifyToken,
  buildAccessPayload,
} from '../utils/jwt.util.js';
import { hashPassword, comparePassword, hashToken, compareToken } from '../utils/crypto.util.js';
import { sendVerificationEmail } from '../utils/email.util.js';
import { writeAuditLog, AuditEvents } from '../utils/auditLog.util.js';
import { AppError } from '../utils/AppError.js';
import { cookieOptions } from '../config/jwt.js';
import logger from '../utils/logger.js';
import authEventHandler from '../handlers/auth.handler.js';
import { AUTH_EVENTS } from '../events/auth.events.js';

// POST /auth/register
export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, countryOfResidence } = req.body;

    // Check email uniqueness — never reveal if email exists (anti-enumeration)
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      // Return 409 as per spec but keep message generic enough
      throw new AppError(
        'An account with this email already exists. Please log in or reset your password.',
        409,
        'AUTH_001'
      );
    }

    const passwordHash = await hashPassword(password);
    const emailVerificationPayload = { email: email.toLowerCase(), action: 'email_verify' };
    const emailToken = generateEmailToken(emailVerificationPayload);

    const user = await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      countryOfResidence: countryOfResidence.toUpperCase(),
      role: 'INVESTOR',
      status: 'PENDING_VERIFICATION',
      emailVerified: false,
      emailVerificationToken: emailToken,
    });

    // Send verification email (idempotent job — fire and don't block response)
    sendVerificationEmail(user.email, emailToken).catch((err) =>
      logger.error('Email send failed after registration:', err)
    );

    await writeAuditLog({ userId: user.id, event: AuditEvents.REGISTER, req });
    authEventHandler.emit(AUTH_EVENTS.USER_REGISTERED, { userId: user.id, email: user.email });

    return res.status(201).json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    next(error);
  }
};

// GET /auth/verifyemail?token=<jwt>
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) throw new AppError('Verification token is required.', 400);

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Verification link has expired. Please request a new one.', 410, 'AUTH_003');
      }
      throw new AppError('Invalid verification token.', 400);
    }

    if (decoded.action !== 'email_verify') {
      throw new AppError('Invalid token type.', 400);
    }

    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) throw new AppError('User not found.', 404);
    if (user.emailVerified) {
      return res.json({ success: true, message: 'Email already verified' });
    }

    // Validate stored token matches
    if (user.emailVerificationToken !== token) {
      throw new AppError('Invalid or already used verification token.', 400);
    }

    await user.update({
      emailVerified: true,
      status: 'ACTIVE',
      emailVerificationToken: null,
    });

    await writeAuditLog({ userId: user.id, event: AuditEvents.EMAIL_VERIFIED, req });
    authEventHandler.emit(AUTH_EVENTS.EMAIL_VERIFIED, { userId: user.id });

    return res.json({ success: true, message: 'Email verified' });
  } catch (error) {
    next(error);
  }
};

// POST /auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    // Anti-enumeration: same error for invalid email or invalid password
    if (!user) {
      await writeAuditLog({ event: AuditEvents.LOGIN_FAILED, req, metadata: { email }, status: 'FAILURE' });
      throw new AppError('Invalid credentials. Please check your email and password.', 401, 'AUTH_002');
    }

    // Check lockout
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutesLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      throw new AppError(`Account temporarily locked. Please try again in ${minutesLeft} minutes.`, 423, 'AUTH_004');
    }

    // Check account status
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw new AppError('Your account has been suspended. Please contact support.', 403, 'AUTH_007');
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError('Your account is not active. Contact support.', 403, 'AUTH_007');
    }

    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const updates = { failedLoginAttempts: newFailedAttempts };

      if (newFailedAttempts >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await writeAuditLog({ userId: user.id, event: AuditEvents.ACCOUNT_LOCKED, req, status: 'FAILURE' });
      }

      await user.update(updates);
      await writeAuditLog({ userId: user.id, event: AuditEvents.LOGIN_FAILED, req, status: 'FAILURE' });
      throw new AppError('Invalid credentials. Please check your email and password.', 401, 'AUTH_002');
    }

    // Successful login — reset lockout counters
    const accessPayload = buildAccessPayload(user);
    const accessToken = generateAccessToken(accessPayload);
    const refreshToken = generateRefreshToken({ userId: user.id });
    const refreshTokenHash = await hashToken(refreshToken);

    await user.update({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      refreshTokenHash,
    });

    await writeAuditLog({ userId: user.id, event: AuditEvents.LOGIN, req });
    authEventHandler.emit(AUTH_EVENTS.USER_LOGGED_IN, { userId: user.id });

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, cookieOptions);

    return res.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
        kycStatus: user.kycStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /auth/logout
export const logout = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId);
    if (user) {
      await user.update({ refreshTokenHash: null });
    }

    await writeAuditLog({ userId: req.user?.userId, event: AuditEvents.LOGOUT, req });
    authEventHandler.emit(AUTH_EVENTS.USER_LOGGED_OUT, { userId: req.user?.userId });

    res.clearCookie('refreshToken');
    return res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

// POST /auth/refresh
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new AppError('Session expired. Please log in again.', 401, 'AUTH_006');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      throw new AppError('Session expired. Please log in again.', 401, 'AUTH_006');
    }

    const user = await User.findByPk(decoded.userId);
    if (!user || !user.refreshTokenHash) {
      throw new AppError('Session expired. Please log in again.', 401, 'AUTH_006');
    }

    const tokenValid = await compareToken(token, user.refreshTokenHash);
    if (!tokenValid) throw new AppError('Session expired. Please log in again.', 401, 'AUTH_006');

    const accessPayload = buildAccessPayload(user);
    const newAccessToken = generateAccessToken(accessPayload);

    await writeAuditLog({ userId: user.id, event: AuditEvents.TOKEN_REFRESH, req });

    return res.json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
};

// GET /auth/me
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'email', 'role', 'walletAddress', 'kycStatus', 'status', 'firstName', 'lastName'],
    });
    if (!user) throw new AppError('User not found.', 404);
    return res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};
