import { scheduleAuctionJobs, cancelAuctionJobs, auctionQueue } from '../config/queue.js';
import { sendSuccess, sendError } from '../utils/response.js';

// POST /api/v1/auction/schedule
export async function scheduleAuction(req, res) {
  const { auctionId, assetId, fractionsAllocated, reservePrice, minIncrement, startTs, endTs } = req.body;

  if (!auctionId || !assetId || !fractionsAllocated || reservePrice == null || !startTs || !endTs) {
    return sendError(res, 'Missing required fields: auctionId, assetId, fractionsAllocated, reservePrice, startTs, endTs', 422);
  }

  const { startJobId, settleJobId } = await scheduleAuctionJobs({
    auctionId,
    assetId,
    fractionsAllocated,
    reservePrice,
    minIncrement: minIncrement ?? 0,
    startTs,
    endTs,
  });

  return sendSuccess(res, { auctionId, startJobId, settleJobId }, 'Auction jobs scheduled');
}

// DELETE /api/v1/auction/schedule/:auctionId
export async function cancelScheduledAuction(req, res) {
  const { auctionId } = req.params;
  await cancelAuctionJobs(auctionId);
  return sendSuccess(res, { auctionId }, 'Auction jobs cancelled');
}

// POST /api/v1/auction/settle/:auctionId  — manual re-trigger
export async function retriggerSettle(req, res) {
  const { auctionId } = req.params;
  const jobId = `settle-${auctionId}`;
  const existing = await auctionQueue.getJob(jobId);
  if (existing) await existing.remove();
  await auctionQueue.add('settleAuction', { auctionId }, {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
  return sendSuccess(res, { auctionId }, 'Settle job re-queued');
}
