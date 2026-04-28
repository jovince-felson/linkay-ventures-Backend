import crypto from "crypto";
import redis from "../config/redis.js";

const TTL = 300;

export const createChallenge = async (userId, deviceId) => {
  const challenge = crypto.randomBytes(32).toString("base64url");
  const key = `biometric:challenge:${userId}:${deviceId}`;

  await redis.set(key, challenge, "EX", TTL);
  return challenge;
};

export const getChallenge = async (userId, deviceId) => {
  return redis.get(`biometric:challenge:${userId}:${deviceId}`);
};

export const deleteChallenge = async (userId, deviceId) => {
  return redis.del(`biometric:challenge:${userId}:${deviceId}`);
};
