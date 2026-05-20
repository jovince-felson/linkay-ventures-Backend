import axios                              from 'axios';
import { sendSuccess, sendNotFound, sendError } from '../utils/response.js';
import { logger }                          from 'linkay-shared-utils';

const TOKENIZATION_SERVICE_URL = process.env.TOKENIZATION_SERVICE_URL || 'http://tokenization-service:4005';

// ── POST /assets/tokenize/:assetId ────────────────────────────────────────────
// Proxies to tokenization-service. Kept for backwards compatibility.
export async function tokenizeAsset(req, res) {
  try {
    const { data } = await axios.post(
      `${TOKENIZATION_SERVICE_URL}/api/v1/tokenization/mint`,
      { assetId: req.params.assetId, network: req.body.network },
      {
        headers: { authorization: req.headers.authorization },
        timeout: 15000,
      },
    );
    return res.status(data.success ? 201 : 400).json(data);
  } catch (err) {
    const status  = err.response?.status  || 502;
    const message = err.response?.data?.message || 'Tokenization service unavailable';
    logger.error('Tokenization proxy error:', err.message);
    return sendError(res, message, status);
  }
}

// ── GET /assets/tokenization-status/:assetId ─────────────────────────────────
export async function getTokenizationStatus(req, res) {
  try {
    const { data } = await axios.get(
      `${TOKENIZATION_SERVICE_URL}/api/v1/tokenization/status/${req.params.assetId}`,
      {
        headers: { authorization: req.headers.authorization },
        timeout: 10000,
      },
    );
    return res.status(200).json(data);
  } catch (err) {
    if (err.response?.status === 404) return sendNotFound(res, 'Tokenization job not found');
    logger.error('Tokenization status proxy error:', err.message);
    return sendError(res, 'Tokenization service unavailable', 502);
  }
}
