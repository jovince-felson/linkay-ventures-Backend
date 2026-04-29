import Bull from "bull";
import { REDIS } from "../config/services.js";
import { logger } from "linkay-shared-utils";

const redisOptions = {
    host: REDIS.host,
    port: REDIS.port,
    ...(REDIS.password && { password: REDIS.password }),
};

// Main tokenization queue — processes async blockchain jobs
export const tokenizationQueue = new Bull("tokenization", {
    redis: redisOptions,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 5000, // starts at 5s, doubles each retry
        },
        removeOnComplete: false, // keep for audit
        removeOnFail: false,
    },
});

tokenizationQueue.on("error", (err) => {
    logger.error("Tokenization queue error:", err.message);
});

tokenizationQueue.on("stalled", (job) => {
    logger.warn(`Tokenization job stalled: ${job.id}`);
});

tokenizationQueue.on("failed", (job, err) => {
    logger.error(`Tokenization job failed [${job.id}]:`, err.message);
});

tokenizationQueue.on("completed", (job, result) => {
    logger.info(`Tokenization job completed [${job.id}]`);
});

export default tokenizationQueue;
