import { AuditLog } from "../models/index.js";
import { logger } from "linkay-shared-utils";

export const writeAuditLog = async ({
    actorId = null,
    actorRole = null,
    action,
    targetType = null,
    targetId = null,
    previousValue = null,
    newValue = null,
    txHash = null,
    ipAddress = null,
    metadata = null,
}) => {
    try {
        await AuditLog.create({
            actor_id: actorId,
            actor_role: actorRole,
            action,
            target_type: targetType,
            target_id: targetId,
            previous_value: previousValue,
            new_value: newValue,
            tx_hash: txHash,
            ip_address: ipAddress,
            metadata,
        });
    } catch (err) {
        logger.error("Audit log write failed:", err.message);
        // Never throw — audit failure must not break the main flow
    }
};
