import Queue from "bull";

export const mailQueue = new Queue("mailQueue", {
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT || 6379,
    },
});

export const addMailJob = async (job) => {
    await mailQueue.add(job, {
        attempts: 3,
        backoff: 5000,
    });
};
