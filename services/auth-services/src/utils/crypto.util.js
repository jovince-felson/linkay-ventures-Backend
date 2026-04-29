import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const BCRYPT_COST = 12;

export const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_COST);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

export const hashToken = async (token) => {
  return bcrypt.hash(token, 10);
};

export const compareToken = async (token, hash) => {
  return bcrypt.compare(token, hash);
};

export const generateNonce = () => {
  return randomBytes(32).toString('hex');
};
