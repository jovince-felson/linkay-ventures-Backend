import axios                              from 'axios';
import { TokenizationJob, Asset }         from '../models/index.js';
import { INITIAL_STEPS }                  from '../models/TokenizationJob.js';
import { addTokenizationJob }             from '../config/queue.js';
import sequelize                          from '../config/database.js';
import { getFractionalToken }             from '../blockchain/contracts.js';
import { sendCreated, sendSuccess, sendError, sendNotFound, sendForbidden } from '../utils/response.js';

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

  // Create/reset the AssetTokenization record so listAssets can track status
  await sequelize.query(
    `INSERT INTO asset_tokenizations (id, asset_id, tokenization_status, blockchain_network, requested_by, created_at, updated_at)
     VALUES (UUID(), ?, 'PENDING', ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE tokenization_status = 'PENDING', updated_at = NOW()`,
    { replacements: [assetId, network, userId] },
  );

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

// ── PATCH /api/v1/tokenization/:assetId/treasury-review ──────────────────────
export async function treasuryReview(req, res) {
  const callerRole = req.user.role;
  if (callerRole !== 'SUPER_ADMIN') {
    return sendForbidden(res, 'Only SUPER_ADMIN can perform treasury review');
  }

  const { assetId } = req.params;
  const { action, reason } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return sendError(res, 'action must be "approve" or "reject"', 422);
  }
  if (action === 'reject' && !reason) {
    return sendError(res, 'reason is required when rejecting', 422);
  }

  const [[tokenization]] = await sequelize.query(
    'SELECT id, tokenization_status, asset_id FROM asset_tokenizations WHERE asset_id = ?',
    { replacements: [assetId] },
  );

  if (!tokenization) return sendNotFound(res, 'Tokenization record not found');

  if (tokenization.tokenization_status !== 'TREASURY_PENDING') {
    return sendError(res, `Cannot review: current status is ${tokenization.tokenization_status}`, 409);
  }

  if (action === 'reject') {
    await sequelize.query(
      'UPDATE asset_tokenizations SET tokenization_status = ?, error_message = ?, updated_at = NOW() WHERE asset_id = ?',
      { replacements: ['TREASURY_REJECTED', reason, assetId] },
    );
    return sendSuccess(res, { assetId, status: 'TREASURY_REJECTED' }, 'Tokenization rejected by treasury');
  }

  // approve — call approve() on-chain so AuctionHouse can transfer tokens
  const MOCK = process.env.CONTRACTS_ENABLED !== 'true';

  const asset = await Asset.findByPk(assetId);
  if (!asset) return sendNotFound(res, 'Asset not found');

  if (!asset.erc3643ContractAddress) {
    return sendError(res, 'Token contract address not found for this asset', 422);
  }

  let approveTxHash = null;

  if (!MOCK) {
    try {
      const token         = getFractionalToken(asset.erc3643ContractAddress);
      const treasuryAddr  = process.env.TREASURY_WALLET;
      const auctionHouse  = process.env.AUCTION_HOUSE_ADDRESS;
      const balance       = await token.balanceOf(treasuryAddr);

      if (balance > 0n) {
        const tx      = await token.approve(auctionHouse, balance);
        const receipt = await tx.wait(1);
        approveTxHash = receipt.hash;
        console.log(`✅ Treasury approved ${balance.toString()} tokens for AuctionHouse, tx: ${approveTxHash}`);
      } else {
        console.warn(`⚠️  Treasury balance is 0 for asset ${assetId} — skipping on-chain approve`);
      }
    } catch (err) {
      console.error('Treasury approve on-chain failed:', err.message);
      return sendError(res, `On-chain approve failed: ${err.message}`, 500);
    }
  } else {
    approveTxHash = `0x${'a'.repeat(64)}`;
  }

  await sequelize.query(
    'UPDATE asset_tokenizations SET tokenization_status = ?, updated_at = NOW() WHERE asset_id = ?',
    { replacements: ['TREASURY_APPROVED', assetId] },
  );

  return sendSuccess(res, { assetId, status: 'TREASURY_APPROVED', approveTxHash }, 'Tokenization approved by treasury');
}
