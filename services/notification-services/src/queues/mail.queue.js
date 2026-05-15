import Queue from "bull";

const redisConfig = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    ...(process.env.NODE_ENV === "production" && { tls: {} }),
};

export const mailQueue = new Queue("mailQueue", { redis: redisConfig });

export const addMailJob = async (job) => {
    await mailQueue.add(job, {
        attempts: 3,
        backoff: 5000,
    });
};
