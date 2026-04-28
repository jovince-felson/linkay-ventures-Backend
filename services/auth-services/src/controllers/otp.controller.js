import dotenv from "dotenv";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import RefreshToken from "../models/refresh_token.model.js";
import PassKeys from "../models/passkeys.js";
import { publish, Topics, Keys, logger, RESPONSE_CODES, ROLES, encryptId, decryptId } from "rhoam-shared-utils";
import {
    cookieOptions,
    hashRefresh,
    genRefreshPlain,
    signAccess
} from '../utils/auth.utils.js';

import { GetRoleName, GetPermission } from "../utils/access.utils.js";

dotenv.config();

const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "60m";
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5;

export const GeneralOTPVerification = async (req, res) => {
    try {
        const { otp } = req.body;

        const session = await Session.findOne({
            where: {
                id: req.user.session.id,
                user_id: req.user.id,
                device_id: req.user.session.device_id,
                revoked: false,
            }
        });

        const user = await User.findOne({
            where: {
                id: req.user.id,
            }
        });

        if (!session) {
            logger.info("Invalid Session on OTP Verification", decrypted_user_id);
            return res.status(400).json({
                success: false,
                message: "Invalid Session , Please Login Again!",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                error: 'Invalid Session',
            });
        }

        if (session.otp_attempts >= MAX_FAILED_ATTEMPTS) {
            session.revoked = true;
            await session.save();

            user.is_locked = 1;
            user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();

            logger.warn("GeneralOTPVerification User Session revoked due to max failed attempts user_id:", req.user.id);
            return res.status(403).json({
                success: false,
                message: "Too Many Attempts, Please Try Again After Sometime",
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
                data: {},
                error: "Session Expired",
            });
        }

        if (session.otp !== otp) {
            logger.warn("GeneralOTPVerification Attempt with invalid OTP for user_id:", req.user.id);

            session.otp_attempts += 1;
            await session.save();

            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
                response_code: RESPONSE_CODES.OTP_INVALID,
                error: "Invalid OTP"
            });
        }



        // OTP Expiration Check
        if (new Date() > session.otp_expiry) {
            logger.warn("VerifyOTP Attempt with expired OTP ");
            return res.status(400).json({
                success: false,
                message: "OTP Expired",
                response_code: RESPONSE_CODES.OTP_EXPIRED,
                data: {},
                error: "OTP Expired",
            });
        }



        if (otp === session.otp) {
            session.otp_attempts = 0;
            session.otp = null;
            session.otp_expiry = null;
            session.otp_request_count = 0;
            await session.save();
        }

        const previous_key = await PassKeys.findOne({
            where: {
                user_id: req.user.id,
                device_id: req.user.session.device_id,
                is_active: 1,
            }
        });

        if (previous_key) {
            previous_key.is_active = 0;
            await previous_key.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Otp Verification Successfull',
            response_code: RESPONSE_CODES.OTP_VERIFIED,
        });
    }
    catch (exception) {
        logger.info("General OTP Verification Error", req.user.id);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const VerifyOTP = async (req, res) => {
    try {
        const { session_id, otp, device_id, device_name, user_id } = req.body;

        const decrypted_session_id = decryptId(session_id);
        const decrypted_user_id = decryptId(user_id);

        const session = await Session.findOne({
            where: {
                id: decrypted_session_id,
                user_id: decrypted_user_id,
                device_id: device_id,
                revoked: false,
            }
        });

        if (!session) {
            logger.info("Invalid Session on OTP Verification", decrypted_user_id);
            return res.status(400).json({
                success: false,
                message: "Invalid Session , Please Login Again!",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                error: 'Invalid Session',
            });
        }

        const user = await User.findOne({
            where: {
                id: decrypted_user_id,
            }
        });

        if (session.otp_attempts >= MAX_FAILED_ATTEMPTS) {
            session.revoked = true;
            await session.save();

            user.is_locked = 1;
            user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();

            logger.warn("VerifyOTP User account locked due to max failed attempts user_id:", user.id);
            return res.status(403).json({
                success: false,
                message: "Please Login In Again !",
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
                data: {},
                error: "Session Expired",
            });
        }

        if (session.otp !== otp) {
            logger.warn("VerifyOTP Attempt with invalid OTP for user_id:", user.id);

            session.otp_attempts += 1;
            await session.save();

            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
                response_code: RESPONSE_CODES.OTP_INVALID,
                error: "Invalid OTP"
            });
        }

        // OTP Expiration Check
        if (new Date() > session.otp_expiry) {
            logger.warn("VerifyOTP Attempt with expired OTP for user_id:", user.id);
            return res.status(400).json({
                success: false,
                message: "OTP Expired",
                response_code: RESPONSE_CODES.OTP_EXPIRED,
                data: {},
                error: "OTP Expired",
            });
        }



        if (session.otp === otp) {
            session.otp_attempts = 0;
            session.otp = null;
            session.otp_expiry = null;
            session.otp_request_count = 0;
            await session.save();
        }


        session.is_ip_verified = true;
        session.is_device_verified = true;
        session.logged_in_at = new Date();
        await session.save();

        user.is_verified = 1;
        await user.save();

        let admin = false;

        if (user.role == 2) {
            admin = true;
        }

        // Generate Access and Refresh Tokens
        const role_details = await GetRoleName(user.role);
        console.log(role_details);
        const permissions = await GetPermission(user.role);

        const access_token = signAccess({ user_id: encryptId(user.id), session_id: encryptId(session.id), admin: admin, verified: true, ekyc_passed: user.ekyc_passed, role_name: role_details.role_name, permissions: permissions, role_id: user.role, role_scope: role_details.data_scope });
        const refresh_plain = genRefreshPlain();
        const refresh_hashed = await hashRefresh(refresh_plain);
        const refresh_expires_at = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
        await RefreshToken.create({
            user_id: user.id,
            session_id: session.id,
            token_hash: refresh_hashed,
            expires_at: refresh_expires_at,
            issued_at: new Date(),
        });

        res.cookie(REFRESH_COOKIE_NAME, refresh_plain, cookieOptions());

        if (user.role !== ROLES[2]) {

            // Check PassKeys
            const checkPasskey = await PassKeys.findOne({
                where: {
                    user_id: user.id,
                    device_id: device_id,
                    is_active: 1,
                }
            });

            if (!checkPasskey) {
                return res.status(200).json({
                    success: true,
                    message: 'OTP Verified Successfully, Please Add Passkey to Continue',
                    response_code: RESPONSE_CODES.PASSCODE_SETUP_REQUIRED,
                    data: {
                        access_token: access_token,
                        access_token_expires_in: ACCESS_TOKEN_EXP,
                        user_details: {
                            user_id: user_id,
                            role_id: user.role,
                            session_id: session_id,
                            phone_number: user.phone_number,
                            email: user.email,
                            verification_status: user.ekyc_passed,
                        }
                    }
                });
            }

            if (checkPasskey) {
                return res.status(200).json({
                    success: true,
                    message: 'OTP Verified Successfully, Please Authenticate Via Your Passkey To Continue',
                    respone_code: RESPONSE_CODES.PASSCODE_REQUIRED,
                    data: {
                        access_token: access_token,
                        access_token_expires_in: ACCESS_TOKEN_EXP,
                        user_details: {
                            user_id: user_id,
                            session_id: session_id,
                            role_id: user.role,
                            phone_number: user.phone_number,
                            email: user.email,
                            verification_status: user.ekyc_passed,
                        }
                    }
                })
            }
        }



        return res.status(200).json({
            success: true,
            message: "OTP Verified Successfully",
            respone_code: RESPONSE_CODES.LOGIN_SUCCESSFUL,
            data: {
                access_token: access_token,
                access_token_expires_in: ACCESS_TOKEN_EXP,
                user_details: {
                    user_id: user_id,
                    session_id: session_id,
                    role_id: user.role,
                    phone_number: user.phone_number,
                    email: user.email,
                }
            }
        });

    }
    catch (exception) {
        logger.error("VerifyOTP Error:", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }

};

export const ReSendEmailOTP = async (req, res) => {
    try {
        const { session_id, device_name, device_id, user_id, email } = req.body;

        const decrypted_session_id = decryptId(session_id);
        const decrypted_user_id = decryptId(user_id);

        const user = await User.findOne({
            where: {
                id: decrypted_user_id,
                status: 1,
                is_locked: 0,
                trash: "NO"
            }
        });

        if (!user) {
            logger.info("User Not Found", decrypted_user_id);
            return res.status(404).json({
                success: false,
                message: "User Not Found",
                response_code: RESPONSE_CODES.INVALID_INPUT,
                error: 'User Not Found',
            });
        }

        const session = await Session.findOne({
            where: {
                id: decrypted_session_id,
                user_id: decrypted_user_id,
                device_id: device_id,
            }
        });

        if (!session) {
            logger.info("Invalid Session", decrypted_user_id);
            return res.status(400).json({
                success: false,
                message: "Invalid Session , Please Login Again!",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                error: 'Invalid Session',
            });
        }

        if (session.otp_request_count >= 5) {
            session.revoked = true;
            await session.save();
            return res.status(429).json({
                success: false,
                message: "Too many OTP requests. Please Try Again After Few Minutes !",
                response_code: RESPONSE_CODES.TOO_MANY_REQUESTS,
                error: 'Too Many Requests',
            });
        }


        const otp = Math.floor(100000 + Math.random() * 900000);
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);
        session.otp_request_count += 1;
        session.otp = otp;
        session.otp_expiry = otp_expiry;
        await session.save();

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_EMAIL_OTP,
                value: JSON.stringify({
                    otp: session.otp,
                    email: user.email,
                }),
            }
        ]);
        logger.info("Email OTP ReSent", email);

        return res.status(200).json({
            success: true,
            message: 'OTP Sent To Your Email Kindly Check',
            data: {},
            response_code: RESPONSE_CODES.OTP_SENT,
        });

    }
    catch (exception) {
        logger.error("Email OTP ReSend Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        })
    }
};

export const ReSendMobileOTP = async (req, res) => {
    try {
        const { session_id, device_name, device_id, user_id } = req.body;

        const decrypted_session_id = decryptId(session_id);
        const decrypted_user_id = decryptId(user_id);

        const user = await User.findOne({
            where: {
                id: decrypted_user_id,
                status: 1,
                is_locked: 0,
                trash: "NO"
            }
        });

        if (!user) {
            logger.info("User Not Found", decrypted_user_id);
            return res.status(404).json({
                success: false,
                message: "User Not Found",
                response_code: RESPONSE_CODES.INVALID_INPUT,
                error: 'User Not Found',
            });
        }

        const session = await Session.findOne({
            where: {
                id: decrypted_session_id,
                user_id: decrypted_user_id,
                device_id: device_id,
            }
        });


        if (!session) {
            logger.info("Invalid Session", decrypted_user_id);
            return res.status(400).json({
                success: false,
                message: "Invalid Session , Please Login Again!",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                error: 'Invalid Session',
            });
        }

        if (session.otp_request_count >= 5) {
            session.revoked = true;
            await session.save();
            return res.status(429).json({
                success: false,
                message: "Too many OTP requests. Please Try Again After Few Minutes !",
                response_code: RESPONSE_CODES.TOO_MANY_REQUESTS,
                error: 'Too Many Requests',
            });
        }


        const otp = Math.floor(100000 + Math.random() * 900000);
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);
        session.otp_request_count += 1;
        session.otp = otp;
        session.otp_expiry = otp_expiry;
        await session.save();

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_MOBILE_OTP,
                value: JSON.stringify({
                    otp: session.otp,
                    phone_number: user.phone_number,
                })
            }
        ]);
        logger.info("Mobile OTP ReSent", user.phone_number);

        return res.status(201).json({
            success: true,
            message: 'OTP Sent To Your Mobile Number',
            data: {},
            response_code: RESPONSE_CODES.OTP_SENT,
        });
    }
    catch (exception) {
        logger.error("Mobile OTP Resend Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};
