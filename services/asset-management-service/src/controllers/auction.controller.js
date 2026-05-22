import Auction           from '../models/Auction.js';
import Asset             from '../models/Asset.js';
import AssetTokenization from '../models/AssetTokenization.js';
import { sendSuccess, sendNotFound, sendError } from '../utils/response.js';

// ── POST /api/v1/auctions ─────────────────────────────────────────────────────
export async function createAuction(req, res) {
  const userId   = req.user.userId;
  const museumId = req.user.museumId || req.user.userId;

  const { assetId } = req.body;

  const asset = await Asset.findOne({ where: { id: assetId, museumId } });
  if (!asset) return sendNotFound(res, 'Asset not found');

  if (asset.status !== 'LIVE') {
    return sendError(res, 'Asset must be LIVE to create an auction', 422);
  }

  const tokenization = await AssetTokenization.findOne({ where: { assetId } });
  if (!tokenization || tokenization.tokenizationStatus !== 'COMPLETED') {
    return sendError(res, 'Asset must be fully tokenized before creating an auction', 422);
  }

  const auction = await Auction.create({
    ...req.body,
    museumId,
    createdBy: userId,
    updatedBy: userId,
  });

  return sendSuccess(res, auction, 'Auction created successfully', 201);
}

// ── GET /api/v1/auctions ──────────────────────────────────────────────────────
export async function listAuctions(req, res) {
  const museumId = req.user.museumId || req.user.userId;
  const { assetId, status } = req.query;

  const where = { museumId };
  if (assetId) where.assetId = assetId;
  if (status)  where.status  = status;

  const auctions = await Auction.findAll({
    where,
    include: [{ model: Asset, as: 'asset', attributes: ['id', 'title', 'assetType', 'valuation', 'mediaFiles'] }],
    order: [['createdAt', 'DESC']],
  });

  return sendSuccess(res, auctions);
}

// ── GET /api/v1/auctions/:auctionId ──────────────────────────────────────────
export async function getAuction(req, res) {
  const museumId = req.user.museumId || req.user.userId;

  const auction = await Auction.findOne({
    where: { id: req.params.auctionId, museumId },
    include: [{ model: Asset, as: 'asset' }],
  });

  if (!auction) return sendNotFound(res, 'Auction not found');
  return sendSuccess(res, auction);
}

// ── PATCH /api/v1/auctions/:auctionId ────────────────────────────────────────
export async function updateAuction(req, res) {
  const museumId = req.user.museumId || req.user.userId;

  const auction = await Auction.findOne({ where: { id: req.params.auctionId, museumId } });
  if (!auction) return sendNotFound(res, 'Auction not found');
  if (!['DRAFT', 'SCHEDULED'].includes(auction.status)) {
    return sendError(res, 'Cannot edit a LIVE or ENDED auction', 409);
  }

  await auction.update({ ...req.body, updatedBy: req.user.userId });
  return sendSuccess(res, auction, 'Auction updated successfully');
}

// ── PATCH /api/v1/auctions/:auctionId/status ─────────────────────────────────
export async function patchAuctionStatus(req, res) {
  const museumId = req.user.museumId || req.user.userId;

  const auction = await Auction.findOne({ where: { id: req.params.auctionId, museumId } });
  if (!auction) return sendNotFound(res, 'Auction not found');

  const { status } = req.body;
  const allowed = {
    DRAFT:      ['SCHEDULED', 'CANCELLED'],
    SCHEDULED:  ['LIVE', 'CANCELLED'],
    LIVE:       ['ENDED', 'CANCELLED'],
    ENDED:      [],
    CANCELLED:  [],
  };

  if (!allowed[auction.status]?.includes(status)) {
    return sendError(res, `Cannot transition from ${auction.status} to ${status}`, 422);
  }

  await auction.update({ status, updatedBy: req.user.userId });
  return sendSuccess(res, auction, `Auction status updated to ${status}`);
}

// ── DELETE /api/v1/auctions/:auctionId ───────────────────────────────────────
export async function deleteAuction(req, res) {
  const museumId = req.user.museumId || req.user.userId;

  const auction = await Auction.findOne({ where: { id: req.params.auctionId, museumId } });
  if (!auction) return sendNotFound(res, 'Auction not found');
  if (auction.status === 'LIVE') {
    return sendError(res, 'Cannot delete a LIVE auction', 409);
  }

  await auction.destroy();
  return sendSuccess(res, null, 'Auction deleted successfully');
}
