import bcrypt from "bcrypt";
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
    signAccess,
} from '../utils/auth.utils.js';

import { GetRoleName, GetPermission } from "../utils/access.utils.js";


dotenv.config();

const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "60m";
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";


export const AddPassKey = async (req, res) => {
    try {
        const { user_id, device_id, device_name, passcode, confirm_passcode, session_id } = req.body;

        const hashed_passcode = await bcrypt.hash(passcode, 10);

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        const previous_key = await PassKeys.findOne({
            where: {
                user_id: decrypted_user_id,
                device_id: device_id,
                is_active: 1,
            }
        });

        if (previous_key) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active passkey',
                response_code: RESPONSE_CODES.OPERATION_FAILED,
            });
        }

        const store_passkey = await PassKeys.create({
            user_id: decrypted_user_id,
            device_id: device_id,
            device_name: device_name,
            pin_hash: hashed_passcode,
            created_at: Date.now(),
        });

        return res.status(200).json({
            success: true,
            response_code: RESPONSE_CODES.PASSCODE_SETUP_SUCCESSFUL,
            message: 'Passkey Added Successfully',
            data: {},
        });
    }
    catch (exception) {
        logger.error("Add PassKey Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const AuthenticateByPassKey = async (req, res) => {
    try {
        const { user_id, passcode, session_id, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        const fetch_passkey = await PassKeys.findOne({
            where: {
                user_id: decrypted_user_id,
                device_id: device_id,
                is_active: 1,
            }
        });

        const user = await User.findOne({
            where: {
                id: decrypted_user_id
            }
        });

        const session = await Session.findOne({
            where: {
                id: decrypted_session_id,
                user_id: decrypted_user_id,
                device_id: device_id,
                revoked: false,
            }
        });

        if (!fetch_passkey) {
            logger.info("No Passkey Found", decrypted_user_id);
            return res.status(404).json({
                success: false,
                message: 'No Passkey Found !',
                response_code: RESPONSE_CODES.PASSCODE_SETUP_REQUIRED,
            });
        }

        const check_passkey = await bcrypt.compare(passcode, fetch_passkey.pin_hash);

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

        if (!check_passkey) {
            user.failed_attempts += 1;
            await user.save();

            return res.status(404).json({
                success: false,
                message: 'Invalid Credentials',
                response_code: RESPONSE_CODES.PASSCODE_INVALID,
            });
        }

        if (user.failed_attempts >= 5) {
            user.is_locked = 1;
            user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();

            session.revoked = true;
            await session.save();

            return res.status(403).json({
                success: false,
                message: "Account Locked due to multiple failed attempts, Please Login Again !",
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
                data: {},
                error: "Account Locked",
            });
        }

        let admin = false;

        if (user.role == 2) {
            admin = true;
        }

        const role_details = await GetRoleName(user.role);
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

        return res.status(200).json({
            success: true,
            message: "Passcode Authentication Successful",
            respone_code: RESPONSE_CODES.LOGIN_SUCCESSFUL,
            data: {
                access_token: access_token,
                access_token_expires_in: ACCESS_TOKEN_EXP,
                user_details: {
                    user_id: user_id,
                    session_id: session_id,
                    phone_number: user.phone_number,
                    email: user.email,
                    role_id: user.role,
                }
            }
        });

    }
    catch (exception) {
        logger.error("Authenticate By Passkey Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const ForgotPassKey = async (req, res) => {
    try {
        const { user_id, session_id, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        const session = await Session.findOne({
            where: {
                id: decrypted_session_id,
            }
        });

        let type_of_auth;

        let otp = Math.floor(100000 + Math.random() * 900000);
        let otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

        session.otp = otp;
        session.otp_expiry = otp_expiry;
        await session.save();

        if (req.user.email != null && req.user.email != '') {
            type_of_auth = 1;
        }

        if ((req.user.phone_number != null && req.user.phone_number != '') && (req.user.email == null || req.user.email == '')) {
            type_of_auth = 2;
        }

        let response_text;
        let otp_sent_to;

        if (type_of_auth == 1) {
            response_text = "OTP Has Been Sent To Your Registered Email " + req.user.email;
            otp_sent_to = req.user.email;
            await publish(Topics.USER_EVENTS, [
                {
                    key: Keys.USER_EMAIL_OTP,
                    value: JSON.stringify({
                        email: req.user.email,
                        otp: otp,
                    }),
                }
            ]);
        }

        if (type_of_auth == 2) {
            response_text = "OTP Has Been Sent To Your Registered Mobile Number " + req.user.phone_number;
            otp_sent_to = req.user.phone_numbers
            await publish(Topics.USER_EVENTS, [
                {
                    key: Keys.USER_MOBILE_OTP,
                    value: JSON.stringify({
                        phone_number: req.user.phone_number,
                        otp: otp,
                    })
                }
            ]);
        }



        logger.info("Forgot Passkey , OTP Sent", req.user.id);

        const fetch_passkey = await PassKeys.findOne({
            where: {
                user_id: decrypted_user_id,
                device_id: device_id,
                is_active: 1,
            }
        });

        fetch_passkey.is_active = 0;
        await fetch_passkey.save();


        return res.status(201).json({
            success: true,
            response_code: RESPONSE_CODES.OTP_SENT,
            message: response_text,
            data: {
                session_id: encryptId(req.user.session.id),
                user_id: encryptId(decrypted_user_id),
                otp_sent_to,
            }
        });

    }
    catch (exception) {
        logger.error("ForgotPasskey Error");
        return res.status(500).json({
            success: false,
            message: 'Something went wrong, Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const ResetPasskey = async (req, res) => {
    try {
        const { user_id, session_id, device_id, device_name, old_passkey, new_passkey, new_confirm_passkey } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        const previous_key = await PassKeys.findOne({
            where: {
                user_id: decrypted_user_id,
                device_id: device_id,
                is_active: 1,
            }
        });

        const user = await User.findOne({
            where: {
                id: decrypted_user_id
            }
        });

        const session = await Session.findOne({
            where: {
                id: decrypted_session_id,
                user_id: decrypted_user_id,
                device_id: device_id,
                revoked: false,
            }
        });

        if (!previous_key) {
            return res.status(400).json({
                success: false,
                message: 'Please add passkey',
                response_code: RESPONSE_CODES.OPERATION_FAILED,
            });
        }

        const check_passkey = await bcrypt.compare(old_passkey, previous_key.pin_hash);

        if (!check_passkey) {
            user.failed_attempts += 1;
            await user.save();

            return res.status(404).json({
                success: false,
                message: 'Invalid Credentials',
                response_code: RESPONSE_CODES.PASSCODE_INVALID,
            });
        }

        if (user.failed_attempts >= 5) {
            user.is_locked = 1;
            user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();

            session.revoked = true;
            await session.save();

            return res.status(403).json({
                success: false,
                message: "Account Locked due to multiple failed attempts, Please Login Again !",
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
                data: {},
                error: "Account Locked",
            });
        }

        const hashed_passcode = await bcrypt.hash(new_passkey, 10);

        // Creation Of New Passkey
        const store_passkey = await PassKeys.create({
            user_id: decrypted_user_id,
            device_id: device_id,
            device_name: device_name,
            pin_hash: hashed_passcode,
            created_at: Date.now(),
        });

        return res.status(200).json({
            success: true,
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            message: 'Passkey Changed Successfully',
            data: {},
        });

    }
    catch (exception) {
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};

export const CheckPassKey = async (req, res) => {
    try {
        const { user_id, session_id, device_id, passcode } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        const fetch_passkey = await PassKeys.findOne({
            where: {
                user_id: decrypted_user_id,
                device_id: device_id,
                is_active: 1,
            }
        });

        if (!fetch_passkey) {
            logger.info("No Passkey Found", decrypted_user_id);
            return res.status(404).json({
                success: false,
                message: 'No Passkey Found !',
                response_code: RESPONSE_CODES.PASSCODE_SETUP_REQUIRED,
            });
        }

        const check_passkey = await bcrypt.compare(passcode, fetch_passkey.pin_hash);

        if (!check_passkey) {
            return res.status(404).json({
                success: false,
                message: 'Invalid Credentials',
                response_code: RESPONSE_CODES.PASSCODE_INVALID,
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Passkey Verified Successfully',
            response_code: RESPONSE_CODES.PASSCODE_VERIFIED,
        });
    }
    catch (exception) {
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};
