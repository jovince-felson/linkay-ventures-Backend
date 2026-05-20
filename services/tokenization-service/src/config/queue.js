import Bull from 'bull';

export const tokenizationQueue = new Bull('tokenizationQueue', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  defaultJobOptions: {
    attempts:       1,
    removeOnComplete: true,
    removeOnFail:   false,
  },
});

export const addTokenizationJob = async (payload) => {
  const job = await tokenizationQueue.add(payload);
  return job.id;
};
