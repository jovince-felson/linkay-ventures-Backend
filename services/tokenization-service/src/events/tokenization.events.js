import { listenToEvent, Topics, Keys, logger } from "linkay-shared-utils";
import { TokenizationJob } from "../models/index.js";

/**
 * Listens to Kafka topics relevant to the tokenization service.
 * Currently monitors ekyc-events (KYC approval) and asset lifecycle events.
 */
export const startTokenizationEventListeners = async () => {
    try {
        // Listen for KYC approval events — for cross-service awareness (logging/audit)
        await listenToEvent(
            "tokenization-service-ekyc-group",
            Topics.EKYC_EVENTS,
            async (key, data) => {
                if (key === Keys.EKYC_VERIFICATION_COMPLETED) {
                    logger.info(`KYC approved for user: ${data.userId} — wallet eligible for token purchase`);
                }
            }
        );

        // Listen for tokenization-events — for internal job state awareness
        await listenToEvent(
            "tokenization-service-internal-group",
            "tokenization-events",
            async (key, data) => {
                if (key === "tokenization-complete") {
                    logger.info(`Tokenization event received — asset ${data.assetId} completed`);
                }
                if (key === "tokenization-failed") {
                    logger.error(`Tokenization failed event — job ${data.jobId}: ${data.error}`);
                }
            }
        );

        logger.info("Tokenization Kafka event listeners started");
    } catch (err) {
        logger.error("Failed to start Kafka listeners:", err.message);
        // Non-fatal — service continues without Kafka if unavailable in dev
    }
};
