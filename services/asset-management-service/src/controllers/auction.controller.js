import axios            from 'axios';
import Auction           from '../models/Auction.js';
import Asset             from '../models/Asset.js';
import AssetTokenization from '../models/AssetTokenization.js';
import Bid               from '../models/Bid.js';
import { sendSuccess, sendNotFound, sendError } from '../utils/response.js';

const TOKENIZATION_SERVICE_URL = process.env.TOKENIZATION_SERVICE_URL || 'http://tokenization-service:4005';

// Parse "UTC", "UTC+5:30", "UTC-4", "Asia/Kolkata" etc. → offset in minutes.
function tzOffsetMinutes(tz) {
  if (!tz || tz === 'UTC') return 0;
  // Named offset form: UTC+H, UTC+H:MM, UTC-H, UTC-H:MM
  const m = tz.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/i);
  if (m) {
    const sign  = m[1] === '+' ? 1 : -1;
    const hours = parseInt(m[2], 10);
    const mins  = parseInt(m[3] ?? '0', 10);
    return sign * (hours * 60 + mins);
  }
  // IANA name: use Date to derive offset at epoch (good enough for scheduling)
  try {
    const d = new Date();
    const utcStr   = d.toLocaleString('en-US', { timeZone: 'UTC',    hour12: false });
    const localStr = d.toLocaleString('en-US', { timeZone: tz,       hour12: false });
    return (new Date(localStr) - new Date(utcStr)) / 60000;
  } catch {
    return 0;
  }
}

function toUnixTs(dateStr, timeStr, timezone) {
  // Build a UTC timestamp by subtracting the timezone offset from the stored local time.
  const offsetMs = tzOffsetMinutes(timezone) * 60 * 1000;
  const localMs  = new Date(`${dateStr}T${timeStr}:00.000Z`).getTime();
  return Math.floor((localMs - offsetMs) / 1000);
}

async function scheduleOnChain(auction) {
  try {
    await axios.post(`${TOKENIZATION_SERVICE_URL}/api/v1/auction/schedule`, {
      auctionId:          auction.id,
      assetId:            auction.assetId,
      fractionsAllocated: auction.fractionsAllocated,
      reservePrice:       auction.reservePrice,
      minIncrement:       auction.minIncrement,
      startTs:            toUnixTs(auction.startDate, auction.startTime, auction.timezone),
      endTs:              toUnixTs(auction.endDate,   auction.endTime,   auction.timezone),
    }, { timeout: 5000 });
  } catch (err) {
    console.error(`Failed to schedule auction jobs for ${auction.id}:`, err.message);
  }
}

async function cancelOnChain(auctionId) {
  try {
    await axios.delete(`${TOKENIZATION_SERVICE_URL}/api/v1/auction/schedule/${auctionId}`, { timeout: 5000 });
  } catch (err) {
    console.error(`Failed to cancel auction jobs for ${auctionId}:`, err.message);
  }
}

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
  if (!tokenization || tokenization.tokenizationStatus !== 'TREASURY_APPROVED') {
    return sendError(res, 'Asset must be treasury approved before creating an auction', 422);
  }

  const auction = await Auction.create({
    ...req.body,
    museumId,
    createdBy: userId,
    updatedBy: userId,
  });

  if (auction.status === 'SCHEDULED') {
    await scheduleOnChain(auction);
  }

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
    order: [['created_at', 'DESC']],
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

  const scheduleFields = ['startDate', 'startTime', 'endDate', 'endTime', 'fractionsAllocated', 'reservePrice', 'minIncrement'];
  const rescheduling   = auction.status === 'SCHEDULED' && scheduleFields.some((f) => req.body[f] !== undefined);

  if (rescheduling) {
    await cancelOnChain(auction.id);
  }

  await auction.update({ ...req.body, updatedBy: req.user.userId });

  if (rescheduling) {
    await scheduleOnChain(auction);
  }

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

  if (status === 'CANCELLED' && auction.status === 'SCHEDULED') {
    await cancelOnChain(auction.id);
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

  if (auction.status === 'SCHEDULED') {
    await cancelOnChain(auction.id);
  }

  await auction.destroy();
  return sendSuccess(res, null, 'Auction deleted successfully');
}

// ── POST /api/v1/auctions/:auctionId/bid ─────────────────────────────────────
// Called by investor frontend AFTER on-chain placeBid tx is confirmed
export async function placeBid(req, res) {
  const { auctionId } = req.params;
  const { bidderAddress, amount, txHash } = req.body;

  if (!bidderAddress || !amount) {
    return sendError(res, 'bidderAddress and amount are required', 400);
  }

  const auction = await Auction.findByPk(auctionId);
  if (!auction) return sendNotFound(res, 'Auction not found');
  if (auction.status !== 'LIVE') {
    return sendError(res, 'Auction is not live', 422);
  }

  const bid = await Bid.create({ auctionId, bidderAddress, amount, txHash });
  return sendSuccess(res, bid, 'Bid recorded', 201);
}

// ── GET /api/v1/auctions/:auctionId/bids ─────────────────────────────────────
export async function listBids(req, res) {
  const { auctionId } = req.params;

  const auction = await Auction.findByPk(auctionId);
  if (!auction) return sendNotFound(res, 'Auction not found');

  const bids = await Bid.findAll({
    where: { auctionId },
    order: [['created_at', 'DESC']],
  });

  return sendSuccess(res, bids);
}

// ── GET /api/v1/auctions/public/:auctionId ───────────────────────────────────
export async function getPublicAuction(req, res) {
  const auction = await Auction.findOne({
    where: { id: req.params.auctionId },
    include: [
      { model: Asset, as: 'asset', attributes: ['id', 'title', 'assetType', 'valuation', 'mediaFiles'] },
    ],
  });
  if (!auction) return sendNotFound(res, 'Auction not found');

  const bids = await Bid.findAll({
    where: { auctionId: auction.id },
    order: [['created_at', 'DESC']],
    limit: 20,
  });

  return sendSuccess(res, { ...auction.toJSON(), bids });
}
