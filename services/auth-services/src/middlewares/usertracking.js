    import Log from "../models/log.model.js";
    import { logger } from "rhoam-shared-utils";

    export const Logger = async (req, res, next) => {
        try {

        const UserID = req.user?.id || 0;
        const Ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const sessionId = req.sessionID;
        const userAgent = req.headers["user-agent"] || "unknown";
        const requestUrl = req.originalUrl;

        await Log.create({
            userId : UserID,
            session_id: sessionId,
            ip_address: Ip,
            user_agent: userAgent,
            request_url: requestUrl,
        });

            next();
        }
        catch (exception) {
            logger.error("User Tracking Error:", exception);
            next();
        }
    }