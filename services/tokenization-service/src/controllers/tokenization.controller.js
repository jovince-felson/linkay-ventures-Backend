import axios                              from 'axios';
import { TokenizationJob, Asset }         from '../models/index.js';
import { INITIAL_STEPS }                  from '../models/TokenizationJob.js';
import { addTokenizationJob }             from '../config/queue.js';
import { sendCreated, sendSuccess, sendError, sendNotFound } from '../utils/response.js';

const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://file-service:4007/api/v1';

// ── POST /api/v1/tokenization/mint ───────────────────────────────────────────
export async function initiateTokenization(req, res) {
  const { assetId, network = 'sepolia' } = req.body;
  const userId      = req.user.userId;
  const ownerWallet = req.user.walletAddress;

  if (!assetId) {
    return sendError(res, 'assetId is required', 422);
  }

  // wallet must be bound before tokenizing
  if (!ownerWallet) {
    return sendError(res, 'Wallet not bound. Please bind your wallet before tokenizing.', 422);
  }

  // validate asset exists and is LIVE
  const asset = await Asset.findByPk(assetId);
  if (!asset) return sendNotFound(res, 'Asset not found');

  if (asset.status !== 'LIVE') {
    return sendError(res, `Asset must be LIVE to tokenize. Current status: ${asset.status}`, 422);
  }

  // check for existing job on this asset
  const existing = await TokenizationJob.findOne({ where: { assetId } });

  if (existing) {
    if (existing.status === 'completed') {
      return sendError(res, 'Asset is already tokenized', 409);
    }
    if (existing.status === 'pending' || existing.status === 'processing') {
      return sendSuccess(res, {
        jobId:     existing.id,
        assetId:   existing.assetId,
        status:    existing.status,
        steps:     existing.steps,
        createdAt: existing.createdAt,
      }, 'Tokenization already in progress');
    }
    // status === 'failed' → allow retry, delete old job
    await existing.destroy();
  }

  // fetch primary image URL now while JWT is valid (worker runs async, can't use JWT)
  let imageUrl = '';
  try {
    const { data } = await axios.get(`${FILE_SERVICE_URL}/files/list-all`, {
      params:  { assetId, isPrimary: true },
      headers: { authorization: req.headers.authorization },
      timeout: 5000,
    });
    imageUrl = data?.data?.[0]?.fileUrl || '';
  } catch {
    // non-fatal — IPFS metadata will have empty image field
  }

  // create job record
  const job = await TokenizationJob.create({
    assetId,
    status:      'pending',
    steps:       INITIAL_STEPS,
    ownerWallet,
    network,
    requestedBy: userId,
    imageUrl,
  });

  // enqueue — worker picks this up and runs all 4 steps
  await addTokenizationJob({
    jobId:       job.id,
    assetId,
    ownerWallet,
    network,
    imageUrl,
  });

  const steps = typeof job.steps === 'string' ? JSON.parse(job.steps) : job.steps;

  return sendCreated(res, {
    jobId:     job.id,
    assetId:   job.assetId,
    status:    job.status,
    steps,
    createdAt: job.createdAt,
  }, 'Tokenization initiated');
}

// ── GET /api/v1/tokenization/status/:jobId ───────────────────────────────────
export async function getJobStatus(req, res) {
  const job = await TokenizationJob.findByPk(req.params.jobId);
  if (!job) return sendNotFound(res, 'Tokenization job not found');

  const steps = typeof job.steps === 'string' ? JSON.parse(job.steps) : job.steps;

  return sendSuccess(res, {
    jobId:       job.id,
    assetId:     job.assetId,
    status:      job.status,
    steps,
    error:       job.errorMessage,
    completedAt: job.completedAt,
  });
}
