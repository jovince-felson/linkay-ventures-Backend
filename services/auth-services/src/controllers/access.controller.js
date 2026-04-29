import dotenv from "dotenv";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import RefreshToken from "../models/refresh_token.model.js";
import { logger, RESPONSE_CODES, ROLES, encryptId, decryptId } from "rhoam-shared-utils";
import {
    cookieOptions,
    compareRefresh,
    hashRefresh,
    genRefreshPlain,
    signAccess,
} from '../utils/auth.utils.js';

dotenv.config();

const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "15m";
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";
const REFRESH_COOKIE_MAXAGE = REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

export const RefreshAccessToken = async (req, res) => {
    try {
        const refresh_plain = req.cookies[REFRESH_COOKIE_NAME];
        const { session_id } = req.body;

        const decrypted_session_id = decryptId(session_id);

        if (!refresh_plain) {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please log in again.",
                response_code: RESPONSE_CODES.INVALID_TOKEN,
                data: {}
            });
        }

        const refreshRecord = await RefreshToken.findOne({
            where: { revoked: false, session_id: decrypted_session_id }
        });

        if (!refreshRecord) {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please log in again.",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                data: {}
            });
        }

        const isMatch = await compareRefresh(refresh_plain, refreshRecord.token_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please log in again.",
                response_code: RESPONSE_CODES.INVALID_TOKEN,
                data: {}
            });
        }

        const session = await Session.findOne({
            where: { id: refreshRecord.session_id, revoked: false }
        });

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please log in again.",
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
                data: {}
            });
        }

        const user = await User.findOne({ where: { id: session.user_id } });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                error_code: "USER_NOT_FOUND",
            });
        }

        // Rotate refresh token
        refreshRecord.revoked = true;
        await refreshRecord.save();

        const new_refresh_plain = genRefreshPlain();
        const new_refresh_hashed = await hashRefresh(new_refresh_plain);
        const new_refresh_expiry = new Date(Date.now() + REFRESH_COOKIE_MAXAGE);

        await RefreshToken.create({
            user_id: session.user_id,
            session_id: session.id,
            token_hash: new_refresh_hashed,
            expires_at: new_refresh_expiry,
            replaced_by_token_id: refreshRecord.id,
        });

        res.cookie(REFRESH_COOKIE_NAME, new_refresh_plain, cookieOptions());

        const access_token = signAccess({
            user_id: encryptId(user.id),
            session_id: encryptId(session.id),
            email: user.email,
            role: user.role,
            wallet_address: user.wallet_address || null,
        });

        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: {
                access_token,
                access_token_expires_in: ACCESS_TOKEN_EXP
            }
        });

    } catch (exception) {
        logger.error("Refresh Token Error:", exception);
        return res.status(500).json({
            success: false,
            message: "Server error.",
            error: exception.message
        });
    }
};

export const SessionValidation = async (req, res) => {
    try {
        const { session_id, user_id } = req.body;

        const decrypted_session_id = decryptId(session_id);
        const decrypted_user_id = decryptId(user_id);

        const session = await Session.findOne({
            where: {
                id: decrypted_session_id,
                user_id: decrypted_user_id,
                revoked: false,
            }
        });

        if (!session) {
            return res.status(401).json({ valid: false, reason: "INVALID_SESSION" });
        }

        const user = await User.findOne({ where: { id: decrypted_user_id } });

        if (!user) {
            return res.status(401).json({ valid: false, reason: "USER_NOT_FOUND" });
        }

        if (user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
            return res.status(403).json({ valid: false, reason: "ACCOUNT_INACTIVE" });
        }

        if (user.is_locked) {
            return res.status(403).json({ valid: false, reason: "LOCKED_ACCOUNT" });
        }

        if (!session.is_ip_verified || !session.is_device_verified) {
            return res.status(403).json({ valid: false, reason: "SESSION_NOT_VERIFIED" });
        }

        return res.status(200).json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                wallet_address: user.wallet_address || null,
                kyc_status: user.kyc_status,
            },
            session: {
                id: session.id,
                device_id: session.device_id,
                ip: session.ip
            }
        });

    } catch (exception) {
        logger.error("Session Validation Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Server error.',
            error: exception.message,
        });
    }
};











// import dotenv from "dotenv";
// import User from "../models/users.model.js";
// import Session from "../models/session.model.js";
// import RefreshToken from "../models/refresh_token.model.js";
// import { logger, RESPONSE_CODES, ROLES, encryptId, decryptId } from "rhoam-shared-utils";
// import {
//     cookieOptions,
//     compareRefresh,
//     hashRefresh,
//     genRefreshPlain,
//     signAccess,
// } from '../utils/auth.utils.js';

// import { GetRoleName, GetPermission } from "../utils/access.utils.js";

// dotenv.config();

// const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "60m";
// const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
// const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";
// const REFRESH_COOKIE_MAXAGE = REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

// export const SessionValidation = async (req, res) => {
//     try {
//         const { session_id, user_id } = req.body;
//         const request_ip = req.headers["x-real-ip"] || req.ip;
//         const user_agent = req.headers["user-agent"] || "";

//         const decrypted_session_id = decryptId(session_id);
//         const decrypted_user_id = decryptId(user_id);

//         const session = await Session.findOne({
//             where: {
//                 id: decrypted_session_id,
//                 user_id: decrypted_user_id,
//                 revoked: false,
//             }
//         });

//         if (!session) {
//             return res.status(401).json({
//                 valid: false,
//                 reason: "INVALID_SESSION"
//             });
//         }

//         const user = await User.findOne({
//             where: {
//                 id: decrypted_user_id
//             }
//         });

//         if (!user) {
//             return res.status(401).json({
//                 valid: false,
//                 reason: "USER_NOT_FOUND",
//             });
//         }

//         if (user.status == 0) {
//             return res.status(403).json({
//                 valid: false,
//                 reason: "DEACTIVATED_USER",
//             });
//         }

//         if (user.is_locked) {
//             return res.status(403).json({
//                 valid: false,
//                 reason: "LOCKED_ACCOUNT",
//             });
//         }

//         if (!session.is_ip_verified || !session.is_device_verified) {
//             return res.status(403).json({
//                 valid: false,
//                 reason: "SESSION_NOT_VERIFIED"
//             });
//         }

 

//         return res.status(200).json({
//             valid: true,
//             user: {
//                 id: user.id,
//                 email: user.email,
//                 phone_number: user.phone_number,
//                 is_admin: user.role === ROLES[2],
//             },
//             session: {
//                 id: session.id,
//                 device_id: session.device_id,
//                 ip: session.ip
//             }
//         });


//     }
//     catch (exception) {
//         logger.error("Session Validation Error", exception);
//         return res.status(500).json({
//             success: false,
//             message: 'Server Error',
//             error: exception.message,
//         });
//     }
// };

// export const RefreshAccessToken = async (req, res) => {
//     try {
//         const refresh_plain = req.cookies[REFRESH_COOKIE_NAME];
//         const { session_id, user_id } = req.body;

//         const decrypted_session_id = decryptId(session_id);
//         const decrypted_user_id = decryptId(user_id);

//         if (!refresh_plain) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Refresh token missing",
//                 response_code: RESPONSE_CODES.INVALID_TOKEN,
//                 data: {}
//             });
//         }

//         const hashedIncoming = await hashRefresh(refresh_plain);

//         const refreshRecord = await RefreshToken.findOne({
//             where: { revoked: false, session_id: decrypted_session_id }
//         });

//         if (!refreshRecord) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid Session Please Login Again",
//                 response_code: RESPONSE_CODES.INVALID_SESSION,
//                 data: {}
//             });
//         }

//         const isMatch = await compareRefresh(refresh_plain, refreshRecord.token_hash);
//         if (!isMatch) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid refresh token",
//                 response_code: RESPONSE_CODES.INVALID_TOKEN,
//                 data: {}
//             });
//         }

//         const session = await Session.findOne({
//             where: {
//                 id: refreshRecord.session_id,
//                 revoked: false
//             }
//         });

//         if (!session) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Session expired. Please login again.",
//                 response_code: RESPONSE_CODES.SESSION_EXPIRED,
//                 data: {}
//             });
//         }

//         if (!session.is_device_verified) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Session not verified. Please login again.",
//                 response_code: RESPONSE_CODES.SESSION_NOT_VERIFIED,
//                 data: {}
//             });
//         }

//         // if (session.ip !== getIP(req)) {
//         //     session.revoked = true;
//         //     await session.save();
//         //     return res.status(401).json({
//         //         success: false,
//         //         message: "IP changed. Please login again."
//         //     });
//         // }

//         const user = await User.findOne({
//             where: {
//                 id: session.user_id
//             }
//         });

//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User Not Found",
//                 error_code: "USER_NOT_FOUND",
//             });
//         }

//         refreshRecord.revoked = true;
//         await refreshRecord.save();

//         const new_refresh_plain = genRefreshPlain();
//         const new_refresh_hashed = await hashRefresh(new_refresh_plain);
//         const new_refresh_expiry = new Date(Date.now() + REFRESH_COOKIE_MAXAGE);



//         await RefreshToken.create({
//             user_id: session.user_id,
//             session_id: session.id,
//             token_hash: new_refresh_hashed,
//             expires_at: new_refresh_expiry,
//             replaced_by_token_id: refreshRecord.id,
//         });

//         res.cookie(REFRESH_COOKIE_NAME, new_refresh_plain, cookieOptions());

//         let admin = false;

//         if (user.role == 2) {
//             admin = true;
//         }

//         const role_details = await GetRoleName(user.role);
//         const permissions = await GetPermission(user.role);

//         const access_token = signAccess({ user_id: encryptId(user.id), session_id: encryptId(session.id), admin: admin, verified: true, ekyc_passed: user.ekyc_passed, role_name: role_details.role_name, permissions: permissions, role_id: user.role, role_scope: role_details.data_scope  });
//         return res.status(200).json({
//             success: true,
//             message: "Token refreshed successfully",
//             data: {
//                 access_token,
//                 access_token_expires_in: ACCESS_TOKEN_EXP
//             }
//         });

//     } catch (exception) {
//         logger.error("Refresh Token Error:", exception);
//         return res.status(500).json({
//             success: false,
//             message: "Server Error",
//             error: exception.message
//         });
//     }
// };
