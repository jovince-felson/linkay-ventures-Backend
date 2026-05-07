import crypto from 'crypto';
import { sumsubConfig } from '../config/sumsub.js';
import logger from '../utils/logger.js';

const buildSignedHeaders = (method, path, bodyStr = '') => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const data = ts + method.toUpperCase() + path + bodyStr;
  const sig = crypto.createHmac('sha256', sumsubConfig.secretKey).update(data).digest('hex');
  return {
    'X-App-Token': sumsubConfig.appToken,
    'X-App-Access-Ts': ts,
    'X-App-Access-Sig': sig,
    Accept: 'application/json',
  };
};

const sumsubRequest = async (method, path, body = null) => {
  const bodyStr = body ? JSON.stringify(body) : '';
  const headers = buildSignedHeaders(method, path, bodyStr);
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${sumsubConfig.baseUrl}${path}`, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  const json = await res.json();
  if (!res.ok) {
    const description = json?.description || json?.message || `Sumsub API error (${res.status})`;
    logger.error(`[Sumsub] ${method} ${path} → ${res.status}: ${description}`);
    const err = new Error(description);
    err.isOperational = true;
    err.statusCode = res.status >= 500 ? 502 : 400;
    throw err;
  }
  return json;
};

export const createApplicant = async ({ externalUserId, email, country }) => {
  const path = `/resources/applicants?levelName=${encodeURIComponent(sumsubConfig.levelName)}`;
  const body = { externalUserId, email };
  if (country) body.fixedInfo = { country };
  const data = await sumsubRequest('POST', path, body);
  return data.id;
};

export const generateSDKToken = async (externalUserId) => {
  const path = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${encodeURIComponent(sumsubConfig.levelName)}&ttlInSecs=3600`;
  const data = await sumsubRequest('POST', path);
  return data.token;
};

export const verifyWebhookSignature = (rawBody, ts, receivedSig) => {
  const secret = sumsubConfig.webhookSecret || sumsubConfig.secretKey;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(ts + rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(receivedSig, 'hex'),
  );
};
