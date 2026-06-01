import Bull from 'bull';

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const tokenizationQueue = new Bull('tokenizationQueue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts:       1,
    removeOnComplete: true,
    removeOnFail:   false,
  },
});

export const auctionQueue = new Bull('auctionQueue', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts:       3,
    backoff:        { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail:   false,
  },
});

export const addTokenizationJob = async (payload) => {
  const job = await tokenizationQueue.add(payload);
  return job.id;
};

export const scheduleAuctionJobs = async ({ auctionId, startTs, endTs, ...data }) => {
  const now      = Date.now();
  const startMs  = startTs * 1000;
  const endMs    = endTs   * 1000;
  const startDelay = Math.max(0, startMs - now);
  const endDelay   = Math.max(0, endMs   - now);

  const startJob  = await auctionQueue.add('startAuction',  { auctionId, startTs, endTs, ...data }, { delay: startDelay, jobId: `start-${auctionId}` });
  const settleJob = await auctionQueue.add('settleAuction', { auctionId },          { delay: endDelay,   jobId: `settle-${auctionId}` });
  return { startJobId: startJob.id, settleJobId: settleJob.id };
};

export const cancelAuctionJobs = async (auctionId) => {
  const startJob  = await auctionQueue.getJob(`start-${auctionId}`);
  const settleJob = await auctionQueue.getJob(`settle-${auctionId}`);
  if (startJob)  await startJob.remove();
  if (settleJob) await settleJob.remove();
};
