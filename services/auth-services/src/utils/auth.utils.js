import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";
const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "60m";
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";
const REFRESH_COOKIE_MAXAGE = REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5;

export function signAccess(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXP });
}

export function genRefreshPlain() {
  return crypto.randomBytes(48).toString("hex");
}

export async function hashRefresh(plain) {
  return bcrypt.hash(plain, 10);
}

export async function compareRefresh(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function getIP(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_COOKIE_MAXAGE,
  };
}


export function RandomEmail(email) {
  const timestamp = Date.now();
  if (!email) {
    return `deleted_${timestamp}@deleted.local`;
  }

  const random = Math.floor(Math.random() * 10000);

  const [localPart, domain] = email.split("@");

  return `deleted_${timestamp}_${random}_${localPart}@${domain}`;
}

export function RandomMobile(mobile) {
  const timestamp = Date.now();

  if (!mobile) {
    return `deleted_${timestamp}`;
  }

  return `deleted_${timestamp}_${mobile}`;
}

