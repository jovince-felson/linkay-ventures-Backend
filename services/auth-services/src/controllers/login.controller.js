import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import RefreshToken from "../models/refresh_token.model.js";
import { publish, Topics, Keys, logger, RESPONSE_CODES, encryptId, decryptId } from "rhoam-shared-utils";


dotenv.config();
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";

export const LoginWithEmail = async (req, res) => {
    try {
        const { email, password, device_id, device_name, fcm_token } = req.body;

        const user = await User.findOne({
            where: {
                email
            }
        });

        if (!user) {
            logger.info("Login Attempt with Unknown Email", email);
            return res.status(400).json({
                success: false,
                response_code: RESPONSE_CODES.LOGIN_FAILED,
                message: 'No Account Found With This Email',
                error: 'Invalid Email',
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            user.failed_attempts += 1;
            await user.save();
            return res.status(400).json({
                success: false,
                message: "Invalid Credentials, Please Try Again",
                response_code: RESPONSE_CODES.LOGIN_FAILED,
                error: 'Invalid Credentials',
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

        if (user.failed_attempts >= 5) {
            user.is_locked = 1;
            user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();

            return res.status(403).json({
                success: false,
                message: "Account Locked due to multiple failed attempts",
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
                data: {},
                error: "Account Locked",
            });
        }

        user.failed_attempts = 0;
        user.is_locked = false;
        user.locked_until = null;
        await user.save();

        let is_ip_verified = false;
        let is_device_verified = false;
        let otp = Math.floor(100000 + Math.random() * 900000);
        let otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

        const session = await Session.create({
            user_id: user.id,
            is_ip_verified: is_ip_verified,
            is_device_verified: is_device_verified,
            ip: req.ip,
            otp: otp,
            device_id: device_id,
            device_name: device_name,
            otp_expiry: otp_expiry,
        });

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_EMAIL_OTP,
                value: JSON.stringify({
                    email: user.email,
                    otp: otp
                }),
            }
        ]);

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_FCM_REGISTER,
                value: JSON.stringify({
                    fcm_token: fcm_token,
                    user_id: user.id
                }),
            }
        ]);

        const encrypted_session_id = encryptId(session.id);
        const encrypted_user_id = encryptId(user.id);

        return res.status(201).json({
            success: true,
            message: 'Login Successful, Please Verify The OTP Sent In Your Email',
            response_code: RESPONSE_CODES.OTP_SENT,
            data: {
                session_id: encrypted_session_id,
                user_id: encrypted_user_id,
                role_id: user.role,
                email: user.email,
                phone_number: user.phone_number,
            }
        });

    }
    catch (exception) {
        logger.error("Login With Email Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        })
    }
};

export const LoginWithMobile = async (req, res) => {
    try {
        const { phone_number, password, country_id, device_id, device_name, fcm_token } = req.body;

        // const decrypted_country_id = decryptId(country_id);

        const user = await User.findOne({
            where: {
                phone_number,
                country_id: country_id
            }
        });

        if (!user) {
            logger.info("Login Attempt with Unknown Number", phone_number);
            return res.status(400).json({
                success: false,
                response_code: RESPONSE_CODES.LOGIN_FAILED,
                message: 'No Account Found With This Phone Number',
                error: 'Invalid Phone Number',
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            user.failed_attempts += 1;
            await user.save();
            return res.status(400).json({
                success: false,
                message: "Invalid Credentials, Please Try Again",
                response_code: RESPONSE_CODES.LOGIN_FAILED,
                error: 'Invalid Credentials',
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

        if (user.failed_attempts >= 5) {
            user.is_locked = 1;
            user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();

            return res.status(403).json({
                success: false,
                message: "Account Locked due to multiple failed attempts",
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
                data: {},
                error: "Account Locked",
            });
        }


        user.failed_attempts = 0;
        user.is_locked = false;
        user.locked_until = null;
        await user.save();

        let is_ip_verified = false;
        let is_device_verified = false;
        let otp = Math.floor(100000 + Math.random() * 900000);
        let otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

        const session = await Session.create({
            user_id: user.id,
            is_ip_verified: is_ip_verified,
            is_device_verified: is_device_verified,
            otp: otp,
            ip: req.ip,
            device_id: device_id,
            device_name: device_name,
            otp_expiry: otp_expiry,
        });

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_MOBILE_OTP,
                value: JSON.stringify({
                    phone_number: user.phone_number,
                    otp: otp
                }),
            }
        ]);

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_FCM_REGISTER,
                value: JSON.stringify({
                    fcm_token: fcm_token,
                    user_id: user.id
                }),
            }
        ]);

        const encrypted_user_id = encryptId(user.id);
        const encrypted_session_id = encryptId(session.id);

        return res.status(201).json({
            success: true,
            message: 'Login Successful, Please Verify The OTP Sent In Your Mobile',
            response_code: RESPONSE_CODES.OTP_SENT,
            data: {
                session_id: encrypted_session_id,
                user_id: encrypted_user_id,
                email: user.email,
                role_id: user.role,
                phone_number: user.phone_number,
            }
        });
    }
    catch (exception) {
        logger.error("Login With Mobile Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        })
    }
};

export const Logout = async (req, res) => {
    try {
        const { session_id } = req.body;
        const decrypted_session_id = decryptId(session_id);

        const session = await Session.findOne({
            where: { id: decrypted_session_id }
        });

        if (!session) {
            return res.status(400).json({
                success: false,
                message: "Invalid session, Please Login Again",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                data: {},
            });
        }

        session.revoked = true;
        await session.save();

        await RefreshToken.update(
            { revoked: true },
            { where: { session_id: decrypted_session_id } }
        );

        res.clearCookie(REFRESH_COOKIE_NAME);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully",
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });
    }
    catch (exception) {
        logger.error("Logout Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong , Please Try again !",
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });

    }
};
