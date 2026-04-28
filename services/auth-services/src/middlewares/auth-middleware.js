import RefreshToken from "../models/refresh_token.model.js";
import Session from "../models/session.model.js";
import User from "../models/users.model.js";
import { decryptId, logger, RESPONSE_CODES } from "rhoam-shared-utils";


export const CheckSession = async (req, res, next) => {
    try {

        let { session_id, user_id, device_id } = req.body;

        session_id = decryptId(session_id);
        user_id = decryptId(user_id);

        if (!session_id || !user_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid Session ID / User ID",
                error: 'Invalid Session / User',
                response_code: RESPONSE_CODES.INVALID_INPUT
            });
        }

        const session = await Session.findOne({
            where: {
                id: session_id,
                user_id: user_id,
            }
        });

        if (!session) {
            logger.info("Invalid Session Attempt", user_id, session_id);
            return res.status(401).json({
                success: false,
                message: 'Invalid Session , Please Login in Again',
                error: 'Invalid Session',
                response_code: RESPONSE_CODES.INVALID_SESSION
            });
        }

        const refresh_token = await RefreshToken.findOne({
            where: {
                user_id: user_id,
                session_id: session_id,
                revoked: false,
            }
        });

        if (!refresh_token) {
            logger.info("Invalid Session Attempt", user_id, session_id);
            return res.status(401).json({
                success: false,
                message: 'Invalid Session , Please Login in Again',
                error: 'Invalid Session',
                response_code: RESPONSE_CODES.INVALID_SESSION
            });
        }

        if (session.revoked || refresh_token.revoked) {

            session.revoked = true;
            await session.save();

            refresh_token.revoked = true;
            await refresh_token.save();

            logger.info("Revoked Session Usage", user_id);
            return res.status(401).json({
                success: false,
                message: 'Invalid Session / Expired Session Please Login Again',
                error: 'Session Expired',
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
            });
        }

        if (!session.is_device_verified) {
            logger.info("Unrecognized Device", user_id);
            return res.status(403).json({
                success: false,
                message: 'Please Verify With Your Account With The Device',
                error: 'Device Not Verified Yet',
                response_code: RESPONSE_CODES.UNAUTHORIZED
            });
        }

        if (!session.is_ip_verified) {
            logger.info("Unrecognized IP", user_id);
            return res.status(403).json({
                success: false,
                message: 'Please Verify With Your Account With The IP',
                error: 'IP Not Verified Yet',
                response_code: RESPONSE_CODES.UNAUTHORIZED
            });
        }

        if (session.device_id !== device_id) {

            session.revoked = true;
            await session.save();

            refresh_token.revoked = true;
            await refresh_token.save();

            logger.info("Session Hijacking", user_id);
            return res.status(403).json({
                success: false,
                message: "Device Mismatch — Please Login Again",
                response_code: RESPONSE_CODES.UNAUTHORIZED
            });
        }

        if (new Date(refresh_token.expires_at) < new Date()) {
            return res.status(401).json({
                success: false,
                message: 'Invalid Session / Expired Session Please Login Again',
                error: 'Session Expired',
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
            });
        }

        req.user.session = session;

        next();

    }
    catch (exception) {
        logger.error("Session Check Error", exception);
        return res.status(500).json({
            success: false,
            response_code: RESPONSE_CODES.SERVER_ERROR,
            message: 'Something went wrong , Please Try Again Later..!',
            error: exception.message
        });
    }
};

export const CheckUser = async (req, res, next) => {
    try {

        let { user_id } = req.body;

        user_id = decryptId(user_id);

        if (!user_id) {
            logger.info("Invalid User ID", user_id);
            return res.status(401).json({
                success: false,
                message: 'Invalid User ID',
                response_code: RESPONSE_CODES.MISSING_FIELDS,
                error: 'No User Id Found',
            });
        }

        const user = await User.findOne({
            where: {
                id: user_id
            }
        });

        if (!user) {
            logger.info("Invalid User ID", user_id);
            return res.status(401).json({
                success: false,
                message: 'Invalid User ID',
                response_code: RESPONSE_CODES.MISSING_FIELDS,
                error: 'No User Found',
            });
        }

        if (user.status == 0) {
            logger.info("Deactivated Account Login Attempt", user.id);
            return res.status(403).json({
                success: false,
                message: 'Deactivated Account, Please Activate The Account',
                error: 'Deactivated Account',
                response_code: RESPONSE_CODES.ACCOUNT_DEACTIVATED,
            });
        }

        if (
            user.is_locked == 1 &&
            user.locked_until &&
            new Date(user.locked_until) > new Date()
        ) {
            logger.info("Locked Account Login Attempt", user.id);
            return res.status(423).json({
                success: false,
                message: 'Account Locked, Please Wait Till The Cool Down Period Is Down',
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
                error: 'Locked Account',
            });
        }


        if (
            user.is_locked == 1 &&
            user.locked_until &&
            new Date(user.locked_until) <= new Date()
        ) {
            user.is_locked = 0;
            user.failed_attempts = 0;
            user.locked_until = null;
            await user.save();

            logger.info("Account Unlocked !", user.id);
        }

        req.user = user;

        next();

    }
    catch (exception) {
        logger.error("Check User Middleware Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: 'Server Error',
        });
    }
};
