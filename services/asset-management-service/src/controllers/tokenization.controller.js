import axios from 'axios';
import { Asset, AssetOwnership, AssetTokenization } from '../models/index.js';
import { assetEvents }        from '../events/asset.events.js';
import { uploadMetadataToIPFS, buildAssetMetadata } from '../utils/ipfs.js';
import { buildMintPayload, sendMintRequest }        from '../utils/blockchain.js';
import { sendSuccess, sendNotFound, sendError }     from '../utils/response.js';
import { logger } from 'linkay-shared-utils';

const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://file-service:4007/api/v1';

// ── POST /assets/:id/tokenize ─────────────────────────────────────────────────
export async function tokenizeAsset(req, res) {
  const asset = await Asset.findByPk(req.params.assetId, {
    include: [{ model: AssetOwnership, as: 'ownershipSplit', paranoid: false }],
  });
  if (!asset) return sendNotFound(res, 'Asset not found');

  if (asset.status !== 'LIVE') {
    return sendError(res, 'Only LIVE assets can be tokenized', 422);
  }

  const existing = await AssetTokenization.findOne({ where: { assetId: asset.id } });
  if (existing && existing.tokenizationStatus === 'COMPLETED') {
    return sendError(res, 'Asset already tokenized', 409);
  }

  // Get primary image URL from file service
  let primaryImageUrl = '';
  try {
    const { data } = await axios.get(`${FILE_SERVICE_URL}/files`, {
      params: { assetId: asset.id, isPrimary: true },
      headers: { authorization: req.headers.authorization },
      timeout: 5000,
    });
    primaryImageUrl = data?.data?.[0]?.fileUrl || '';
  } catch (err) {
    logger.warn(`Could not fetch primary image for asset ${asset.id}:`, err.message);
  }

  const ownershipSplit = {
    museum:    0,
    investors: 0,
  };
  for (const o of asset.ownershipSplit || []) {
    if (o.ownerType === 'MUSEUM')    ownershipSplit.museum    += parseFloat(o.percentage);
    if (o.ownerType === 'INVESTOR')  ownershipSplit.investors += parseFloat(o.percentage);
  }

  const metadata = buildAssetMetadata(asset, ownershipSplit, primaryImageUrl);

  let ipfsCid, metadataUrl;
  try {
    ({ ipfsCid, metadataUrl } = await uploadMetadataToIPFS(metadata));
  } catch (err) {
    logger.error('IPFS upload failed:', err.message);
    return sendError(res, 'IPFS metadata upload failed', 502);
  }

  const tokenizationRecord = existing
    ? await existing.update({
        ipfsCid,
        metadataUrl,
        metadataJson:       metadata,
        tokenizationStatus: 'PROCESSING',
        blockchainNetwork:  req.body.blockchainNetwork || 'ethereum',
        requestedBy:        req.user.userId,
        errorMessage:       null,
      })
    : await AssetTokenization.create({
        assetId:            asset.id,
        ipfsCid,
        metadataUrl,
        metadataJson:       metadata,
        tokenizationStatus: 'PROCESSING',
        blockchainNetwork:  req.body.blockchainNetwork || 'ethereum',
        requestedBy:        req.user.userId,
      });

  const mintPayload = buildMintPayload(asset, tokenizationRecord);
  await tokenizationRecord.update({ mintPayload });

  assetEvents.tokenizationRequested(asset, tokenizationRecord).catch(() => {});

  // Fire-and-forget to tokenization service
  sendMintRequest(mintPayload).catch((err) => {
    logger.error(`Mint request failed for asset ${asset.id}:`, err.message);
  });

  return sendSuccess(res, {
    tokenizationId:     tokenizationRecord.id,
    ipfsCid,
    metadataUrl,
    tokenizationStatus: tokenizationRecord.tokenizationStatus,
    mintPayload,
  }, 'Tokenization initiated. Metadata uploaded to IPFS.');
}

// ── GET /assets/:id/tokenization ──────────────────────────────────────────────
export async function getTokenizationStatus(req, res) {
  const tokenization = await AssetTokenization.findOne({
    where: { assetId: req.params.assetId },
  });
  if (!tokenization) return sendNotFound(res, 'Tokenization record not found');
  return sendSuccess(res, tokenization);
}
