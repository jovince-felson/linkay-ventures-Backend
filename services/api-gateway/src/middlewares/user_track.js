import { decryptId, logger, RESPONSE_CODES } from "linkay-shared-utils";
import UserTracking from "../models/user_tracking.models.js";
import { request } from "express";

export const UserTrackMiddleware = async(req, resizeBy, next) => {
    try{

        const user_id = req.body.user_id || 0;
        const session_id = req.body.session_id || 0;
        const ip = req.ip;
        const request_url = req.originalUrl;
        const user_agent = req.headers['user-agent'];

        const track_user = await UserTracking.create({
            user_id: decryptId(user_id),
            session_id : decryptId(session_id),
            ip: ip,
            request_url: request_url,
            user_agent: user_agent,
            created_at: new Date(),
        });

        next();
    }
    catch(exception)
    {
        logger.error("API Gateway User Track Middleware Error",exception);
        return res.status(500).json({
            response_code: RESPONSE_CODES.SERVER_ERROR,
            message: 'Something went wrong Please Try Again ',
            error: exception.message
        });
    }
};
