const { Op }        = require('sequelize');
const { User, RefreshToken } = require('../models');
const { hashPassword, comparePassword } = require('../utils/hash');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');

// ─── Register ────────────────────────────────────────────────────────────────
const register = async ({ full_name, email, phone, password }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw { status: 409, message: 'Email already registered' };

  const password_hash = await hashPassword(password);
  const user = await User.create({ full_name, email, phone, password_hash });

  return sanitize(user);
};

// ─── Login ───────────────────────────────────────────────────────────────────
const login = async ({ email, password }, meta = {}) => {
  const user = await User.findOne({ where: { email } });
  if (!user)                   throw { status: 401, message: 'Invalid credentials' };
  if (!user.is_active)         throw { status: 403, message: 'Account is deactivated' };

  const valid = await comparePassword(password, user.password_hash);
  if (!valid)                  throw { status: 401, message: 'Invalid credentials' };

  await user.update({ last_login_at: new Date() });

  const payload       = { id: user.id, email: user.email, role: user.role };
  const accessToken   = generateAccessToken(payload);
  const refreshToken  = generateRefreshToken(payload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    user_id:    user.id,
    token:      refreshToken,
    expires_at: expiresAt,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

  return { accessToken, refreshToken, user: sanitize(user) };
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
const refresh = async (token) => {
  const decoded = verifyRefreshToken(token);

  const stored = await RefreshToken.findOne({
    where: { token, is_revoked: false, expires_at: { [Op.gt]: new Date() } },
  });
  if (!stored) throw { status: 401, message: 'Invalid or expired refresh token' };

  await stored.update({ is_revoked: true });

  const user = await User.findByPk(decoded.id);
  if (!user || !user.is_active) throw { status: 403, message: 'User not found or deactivated' };

  const payload      = { id: user.id, email: user.email, role: user.role };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({ user_id: user.id, token: refreshToken, expires_at: expiresAt });

  return { accessToken, refreshToken };
};

// ─── Logout ───────────────────────────────────────────────────────────────────
const logout = async (token) => {
  await RefreshToken.update({ is_revoked: true }, { where: { token } });
};

// ─── Get Profile ──────────────────────────────────────────────────────────────
const getProfile = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  return sanitize(user);
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const sanitize = ({ id, full_name, email, phone, role, is_verified, is_active, last_login_at, createdAt }) =>
  ({ id, full_name, email, phone, role, is_verified, is_active, last_login_at, createdAt });

module.exports = { register, login, refresh, logout, getProfile };
