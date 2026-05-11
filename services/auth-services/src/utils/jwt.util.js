import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';

export const generateAccessToken = (payload) => {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.accessExpiry });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.refreshExpiry });
};

export const generateEmailToken = (payload) => {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.emailExpiry });
};

export const generateResetToken = (payload) => {
  return jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.resetExpiry });
};

export const verifyToken = (token) => {
  return jwt.verify(token, jwtConfig.secret);
};

export const buildAccessPayload = (user) => ({
  userId: user.id,
  email: user.email,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  walletAddress: user.walletAddress || null,
});
