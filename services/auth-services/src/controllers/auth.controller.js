import bcrypt from "bcrypt";
import crypto from "crypto";
import dotenv from "dotenv";
import { auth, OAuth2Client } from "google-auth-library";
import appleSigninAuth from "apple-signin-auth";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import RefreshToken from "../models/refresh_token.model.js";
import PassKeys from "../models/passkeys.js";
import PasswordReset from "../models/password_resets.model.js";
import BiometricCredential from "../models/biometric.model.js";
import { publish, Topics, Keys, logger, RESPONSE_CODES, ROLES, encryptId, decryptId } from "rhoam-shared-utils";
import {
    cookieOptions,
    getIP,
    compareRefresh,
    hashRefresh,
    genRefreshPlain,
    signAccess,
    RandomEmail,
    RandomMobile
} from '../utils/auth.utils.js';
import {
    createChallenge,
    getChallenge,
    deleteChallenge,
} from '../utils/biometric.utils.js';
import { Op } from "sequelize";
import { base64ToPemPublicKey } from "../utils/cryptoKey.js";


dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";
const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "15m";
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";
const REFRESH_COOKIE_MAXAGE = REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5;

export const RegisterWithEmail = async (req, res) => {

    try {
        const { email, password, confirm_password, device_id, device_name, fcm_token } = req.body;

        const user = await User.findOne({
            where: {
                email
            }
        });

        if (user) {
            logger.info("Attempted Registration With Same Email", email);
            return res.status(409).json({
                success: false,
                error: 'Email Already Exists',
                response_code: RESPONSE_CODES.ACCOUNT_EXISTS,
                message: 'Account Already Exists Please Login With Same Email / Register With Different Email',
                data: {}
            });
        }

        const hashed_password = await bcrypt.hash(password, 10);

        // Create User 
        const create_user = await User.create({
            email: email,
            password: hashed_password,
            created_at: Date.now(),
        });

        const otp = Math.floor(100000 + Math.random() * 900000);
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

        // Create Session
        const session = await Session.create({
            user_id: create_user.id,
            user_agent: req.headers["user-agent"] || "",
            device_id: device_id || uuidv4(),
            device_name: device_name,
            is_ip_verified: false,
            is_device_verified: false,
            ip: req.ip,
            otp: otp,
            otp_expiry: otp_expiry,
        });

        const encrypted_user_id = encryptId(create_user.id);
        const encrypted_session_id = encryptId(session.id);


        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_EMAIL_OTP,
                value: JSON.stringify({
                    otp: session.otp,
                    email: create_user.email,
                }),
            },
        ]);

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_FCM_REGISTER,
                value: JSON.stringify({
                    fcm_token: fcm_token,
                    user_id: create_user.id
                }),
            },
        ]);

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_REGISTERED,
                value: JSON.stringify({
                    user_id: create_user.id,
                    email: create_user.email,
                    phone_number: create_user.phone_number,
                    country_id: create_user.country_id,
                })
            },
        ]);


        return res.status(201).json({
            success: true,
            message: 'User Registered Successfully',
            response_code: RESPONSE_CODES.VERIFICATION_REQUIRED,
            data: {
                session_id: encrypted_session_id,
                user_id: encrypted_user_id,
                email: create_user.email,
                role_id: create_user.role,
                phone_number: create_user.phone_number,
                country_id: create_user.country_id,
            },
        });

    }
    catch (exception) {
        logger.error("Register With Email Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong Please Try Again Later ..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const RegisterWithMobile = async (req, res) => {
    try {

        const { phone_number, device_id, device_name, password, confirm_password, country_id, fcm_token } = req.body;

        const user = await User.findOne({
            where: {
                phone_number,
                country_id: country_id,
            }
        });

        if (user) {
            logger.info("Attempted Registration With Same Phone Number", phone_number);
            return res.status(409).json({
                success: false,
                error: 'Phone Number Already Exists',
                response_code: RESPONSE_CODES.ACCOUNT_EXISTS,
                message: 'Account Already Exists Please Login With Same Phone Number / Register With Different Phone Number',
                data: {}
            });
        }

        const hashed_password = await bcrypt.hash(password, 10);

        // Create User 
        const create_user = await User.create({
            phone_number: phone_number,
            password: hashed_password,
            country_id: decrypted_country_id,
            created_at: Date.now(),
        });

        // Create Session
        const otp = Math.floor(100000 + Math.random() * 900000);
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

        // Create Session
        const session = await Session.create({
            user_id: create_user.id,
            user_agent: req.headers["user-agent"] || "",
            device_id: device_id || uuidv4(),
            device_name: device_name,
            is_ip_verified: false,
            is_device_verified: false,
            ip: req.ip,
            otp: otp,
            otp_expiry: otp_expiry,
        });

        const encrypted_user_id = encryptId(create_user.id);
        const encrypted_session_id = encryptId(session.id);

        await publish(Topics.USER_EVENTS, [{
            key: Keys.USER_MOBILE_OTP,
            value: JSON.stringify({
                otp: session.otp,
                phone_number: phone_number,
            }),
        }]);

        await publish(Topics.USER_EVENTS, [{
            key: Keys.USER_FCM_REGISTER,
            value: JSON.stringify({
                fcm_token: fcm_token,
                user_id: create_user.id
            }),
        }]);

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_REGISTERED,
                value: JSON.stringify({
                    user_id: create_user.id,
                    email: create_user.email,
                    phone_number: create_user.phone_number,
                    country_id: create_user.country_id,
                })
            },
        ]);

        return res.status(201).json({
            success: true,
            message: 'User Registered Successfully',
            response_code: RESPONSE_CODES.VERIFICATION_REQUIRED,
            data: {
                session_id: encrypted_session_id,
                user_id: encrypted_user_id,
                phone_number: create_user.phone_number,
                country_id: country_id,
                email: create_user.email,
                role_id: create_user.role,
            },
        });
    }
    catch (exception) {
        logger.error("Mobile Registration Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong Please Try Again Later ..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const AuthenticateWithGoogle = async (req, res) => {
    try {
        const { id_token, device_id, device_name, fcm_token } = req.body;

        if (!id_token) {
            return res.status(400).json({
                success: false,
                message: "Google token missing",
                response_code: RESPONSE_CODES.INVALID_INPUT
            });
        }

        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const google_email = payload.email;
        const google_uid = payload.sub;
        const google_name = payload.name || "";

        let user = await User.findOne({
            where: { email: google_email }
        });

        let isNewUser = false;
        if (user && user.provider !== "google") {
            return res.status(409).json({
                success: false,
                message: "Email already registered with another login method",
                response_code: RESPONSE_CODES.ACCOUNT_EXISTS
            });
        }
        if (!user) {
            isNewUser = true;

            user = await User.create({
                email: google_email,
                username: google_name,
                provider: "google",
                uid: google_uid,
                created_at: Date.now(),
            });

            logger.info("Google SignUp Success", google_email);
        } else {
            logger.info("Google Login Success", google_email);
        }


        const otp = Math.floor(100000 + Math.random() * 900000);
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

        const session = await Session.create({
            user_id: user.id,
            user_agent: req.headers["user-agent"] || "",
            device_id: device_id || uuidv4(),
            device_name: device_name,
            is_ip_verified: false,
            is_device_verified: false,
            ip: req.ip,
            otp,
            otp_expiry,
        });

        const encrypted_user_id = encryptId(user.id);
        const encrypted_session_id = encryptId(session.id);

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_EMAIL_OTP,
                value: JSON.stringify({
                    otp: otp,
                    email: user.email,
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


        return res.status(200).json({
            success: true,
            response_code: RESPONSE_CODES.VERIFICATION_REQUIRED,
            message: isNewUser
                ? "Google Signup Successful — Please Verify OTP"
                : "Google Login Successful — Please Verify OTP",
            data: {
                session_id: encrypted_session_id,
                user_id: encrypted_user_id,
                email: user.email,
                role_id: user.role,
            }
        });
    }
    catch (exception) {
        logger.error("Register With Google Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const AuthenticateWithApple = async (req, res) => {
    try {
        const {
            identity_token,
            device_id,
            device_name,
            fcm_token,
        } = req.body;

        if (!identity_token) {
            return res.status(400).json({
                success: false,
                message: "Apple identity token missing",
                response_code: RESPONSE_CODES.INVALID_INPUT
            });
        }

        const applePayload = await appleSigninAuth.verifyIdToken(
            identity_token,
            {
                audience: process.env.APPLE_CLIENT_ID,
                ignoreExpiration: false
            }
        );

        const apple_uid = applePayload.sub;
        const apple_email = applePayload.email || email || null;
        const is_private_email = applePayload.is_private_email || false;

        let user = await User.findOne({
            where: { apple_uid }
        });

        let isNewUser = false;

        if (!user && apple_email) {
            const existingUser = await User.findOne({
                where: { email: apple_email }
            });

            if (existingUser && existingUser.provider !== "apple") {
                return res.status(409).json({
                    success: false,
                    message: "Email already registered with another login method",
                    response_code: RESPONSE_CODES.ACCOUNT_EXISTS
                });
            }
        }

        if (!user) {
            isNewUser = true;

            user = await User.create({
                email: apple_email,
                provider: "apple",
                uid: apple_uid,
                is_private_email,
                created_at: Date.now()
            });

            logger.info("Apple SignUp Success", apple_uid);
        } else {
            logger.info("Apple Login Success", apple_uid);
        }

        let otp = null;
        let otp_expiry = null;

        otp = Math.floor(100000 + Math.random() * 900000);
        otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

        const ip =
            req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.socket.remoteAddress;

        const session = await Session.create({
            user_id: user.id,
            user_agent: req.headers["user-agent"] || "",
            device_id: device_id || uuidv4(),
            device_name,
            is_ip_verified: !requireOtp,
            is_device_verified: !requireOtp,
            ip,
            otp,
            otp_expiry
        });

        const encrypted_user_id = encryptId(user.id);
        const encrypted_session_id = encryptId(session.id);

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_EMAIL_OTP,
                value: JSON.stringify({
                    otp,
                    email: user.email
                })
            }
        ]);

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_FCM_REGISTER,
                value: JSON.stringify({
                    fcm_token,
                    user_id: user.id
                })
            }
        ]);

        return res.status(200).json({
            success: true,
            response_code: requireOtp
                ? RESPONSE_CODES.VERIFICATION_REQUIRED
                : RESPONSE_CODES.SUCCESS,
            message: requireOtp
                ? "Apple Signup Successful — Please Verify OTP"
                : "Apple Login Successful",
            data: {
                session_id: encrypted_session_id,
                user_id: encrypted_user_id,
                email: user.email,
                is_private_email,
                role_id: user.role,
            }
        });
    }
    catch (exception) {
        logger.error("Register With Apple Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, please try again later",
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};

export const ReSendEmailOTP = async (req, res) => {
    try {
        const { session_id, device_name, device_id, user_id, email } = req.body;

        const decrypted_session_id = decryptId(session_id);
        const decrypted_user_id = decryptId(user_id);

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
                    email: email,
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
        const { session_id, device_name, device_id, user_id, phone_number, country_id } = req.body;

        const decrypted_session_id = decryptId(session_id);
        const decrypted_user_id = decryptId(user_id);
        const decrypted_country_id = decryptId(country_id);

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
                    phone_number: phone_number,
                })
            }
        ]);
        logger.info("Mobile OTP ReSent", phone_number);

        return res.status(201).json({
            success: true,
            message: 'OTP Sent To Your Email Kindly Check',
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

        if (session.otp_attempts >= MAX_FAILED_ATTEMPTS) {
            session.revoked = true;
            await session.save();

            logger.warn("VerifyOTP User account locked due to max failed attempts user_id:", user.id);
            return res.status(403).json({
                success: false,
                message: "Please Login In Again !",
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
                data: {},
                error: "Session Expired",
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
        const access_token = signAccess({ user_id: encryptId(user.id), session_id: encryptId(session.id), admin: admin, verified: true, ekyc_passed: user.ekyc_passed });
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

export const LoginWithAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({
            where: {
                email: email,
                role: 2,
            }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User Not Found',
                response_code: RESPONSE_CODES.USER_NOT_FOUND,
                error: 'User Not Found',
            });
        }

        if (user.is_locked == 1) {
            return res.status(400).json({
                success: false,
                message: 'Account Locked Please Wait Till The Cooldown Period',
                error: 'Account Locked',
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
            });
        }

        if (user.failed_attempts >= 5) {
            user.is_locked = 1;
            user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
            await user.save();
            return res.status(400).json({
                success: false,
                message: 'Account Locked Please Wait Till The Cooldown Period',
                error: 'Account Locked',
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
            });
        }


        const check_password = await bcrypt.compare(password, user.password);

        if (!check_password) {

            user.failed_attempts += 1;
            await user.save();

            return res.status(400).json({
                success: false,
                message: 'Invalid Credentials Please Try Again',
                response_code: RESPONSE_CODES.INVALID_INPUT,
                error: 'Invalid Credentials'
            });
        }

        const device_name = "XXXYYYYZZZZZZIIIOOOO";
        const device_id = "XXXVVVSSHHAAASSS";

        const session = await Session.create({
            user_id: user.id,
            is_ip_verified: true,
            is_device_verified: true,
            ip: req.ip,
            device_id: device_id,
            device_name: device_name,
        });

        const access_token = signAccess({ user_id: encryptId(user.id), session_id: encryptId(session.id), admin: true, verified: true, ekyc_passed: true });
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

        const encrypted_session_id = encryptId(session.id);
        const encrypted_user_id = encryptId(user.id);

        return res.status(200).json({
            success: true,
            message: "User Logged ",
            respone_code: RESPONSE_CODES.LOGIN_SUCCESSFUL,
            data: {
                access_token: access_token,
                access_token_expires_in: ACCESS_TOKEN_EXP,
                user_details: {
                    user_id: encrypted_user_id,
                    session_id: encrypted_session_id,
                    phone_number: user.phone_number,
                    email: user.email,
                }
            }
        });

    }
    catch (exception) {
        logger.error("Login As Admin Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });

    }
};

export const LoginWithMobile = async (req, res) => {
    try {
        const { phone_number, password, country_id, device_id, device_name, fcm_token } = req.body;

        const decrypted_country_id = decryptId(country_id);

        const user = await User.findOne({
            where: {
                phone_number,
                country_id: decrypted_country_id
            }
        });

        if (!user) {
            logger.info("Login Attempt with Unknown Number", phone_number);
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
            otp: otp,
            ip: req.ip,
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

export const RefreshAccessToken = async (req, res) => {
    try {
        const refresh_plain = req.cookies[REFRESH_COOKIE_NAME];
        const { session_id, user_id } = req.body;

        const decrypted_session_id = decryptId(session_id);
        const decrypted_user_id = decryptId(user_id);

        if (!refresh_plain) {
            return res.status(401).json({
                success: false,
                message: "Refresh token missing",
                response_code: RESPONSE_CODES.INVALID_TOKEN,
                data: {}
            });
        }

        const hashedIncoming = await hashRefresh(refresh_plain);

        const refreshRecord = await RefreshToken.findOne({
            where: { revoked: false, session_id: decrypted_session_id }
        });

        if (!refreshRecord) {
            return res.status(401).json({
                success: false,
                message: "Invalid Session Please Login Again",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                data: {}
            });
        }

        const isMatch = await compareRefresh(refresh_plain, refreshRecord.token_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token",
                response_code: RESPONSE_CODES.INVALID_TOKEN,
                data: {}
            });
        }

        const session = await Session.findOne({
            where: {
                id: refreshRecord.session_id,
                revoked: false
            }
        });

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Session expired. Please login again.",
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
                data: {}
            });
        }

        if (!session.is_device_verified) {
            return res.status(401).json({
                success: false,
                message: "Session not verified. Please login again.",
                response_code: RESPONSE_CODES.SESSION_NOT_VERIFIED,
                data: {}
            });
        }

        // if (session.ip !== getIP(req)) {
        //     session.revoked = true;
        //     await session.save();
        //     return res.status(401).json({
        //         success: false,
        //         message: "IP changed. Please login again."
        //     });
        // }

        const user = await User.findOne({
            where: {
                id: session.user_id
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User Not Found",
                error_code: "USER_NOT_FOUND",
            });
        }

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

        let admin = false;

        if (user.role == 2) {
            admin = true;
        }

        const access_token = signAccess({
            user_id: encryptId(session.user_id),
            session_id: encryptId(session.id),
            admin: admin,
            verified: true,
            ekyc_passed: user.ekyc_passed
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
            message: "Server Error",
            error: exception.message
        });
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

export const SessionValidation = async (req, res) => {
    try {
        const { session_id, user_id } = req.body;
        const request_ip = req.headers["x-real-ip"] || req.ip;
        const user_agent = req.headers["user-agent"] || "";

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
            return res.status(401).json({
                valid: false,
                reason: "INVALID_SESSION"
            });
        }

        const user = await User.findOne({
            where: {
                id: decrypted_user_id
            }
        });

        if (!user) {
            return res.status(401).json({
                valid: false,
                reason: "USER_NOT_FOUND",
            });
        }

        if (user.status == 0) {
            return res.status(403).json({
                valid: false,
                reason: "DEACTIVATED_USER",
            });
        }

        if (user.is_locked) {
            return res.status(403).json({
                valid: false,
                reason: "LOCKED_ACCOUNT",
            });
        }

        if (!session.is_ip_verified || !session.is_device_verified) {
            return res.status(403).json({
                valid: false,
                reason: "SESSION_NOT_VERIFIED"
            });
        }

        // if (session.ip !== request_ip) {
        //     session.revoked = true;
        //     await session.save();

        //     return res.status(403).json({
        //         valid: false,
        //         reason: "IP_MISMATCH"
        //     });
        // }

        return res.status(200).json({
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                phone_number: user.phone_number,
                is_admin: user.role === ROLES[2],
            },
            session: {
                id: session.id,
                device_id: session.device_id,
                ip: session.ip
            }
        });


    }
    catch (exception) {
        logger.error("Session Validation Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: exception.message,
        });
    }
};

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
            previous_key.is_active = 0;
            await previous_key.save();
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

        // Generate Access and Refresh Tokens
        const access_token = signAccess({ user_id: encryptId(user.id), session_id: encryptId(session.id), admin: admin, verified: true, ekyc_passed: user.ekyc_passed });
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
        const { user_id, session_id } = req.body;

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

        if (type_of_auth == 1) {
            response_text = "OTP Has Been Sent To Your Registered Email";
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
            response_text = "OTP Has Been Sent To Your Registered Mobile Number";
            await publish(Topics.USER_EVENTS, [
                {
                    key: Keys.USER_MOBILE_OTP,
                    value: JSON.stringify({
                        email: req.user.email,
                        otp: otp,
                    })
                }
            ]);
        }



        logger.info("Forgot Passkey , OTP Sent", req.user.id);
        return res.status(201).json({
            success: true,
            response_code: RESPONSE_CODES.OTP_SENT,
            message: response_text,
            data: {
                session_id: encryptId(req.user.session.id),
                user_id: encryptId(decrypted_user_id),
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

        if (!session) {
            logger.info("Invalid Session on OTP Verification", decrypted_user_id);
            return res.status(400).json({
                success: false,
                message: "Invalid Session , Please Login Again!",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                error: 'Invalid Session',
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

        if (session.otp_attempts >= MAX_FAILED_ATTEMPTS) {
            session.revoked = true;
            await session.save();

            logger.warn("GeneralOTPVerification User Session revoked due to max failed attempts user_id:", req.user.id);
            return res.status(403).json({
                success: false,
                message: "Please Login In Again !",
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
                data: {},
                error: "Session Expired",
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

// When Logged Out
export const ForgotPassword = async (req, res) => {
    try {
        const { email, phone_number, device_id } = req.body;

        if (!email && !phone_number) {
            return res.status(400).json({
                success: false,
                message: "Email or Phone Number is required",
                response_code: RESPONSE_CODES.INVALID_INPUT,
            });
        }

        let user;
        if (email) {
            user = await User.findOne({
                where: { email: email }
            });
        }

        if (!user && phone_number) {
            user = await User.findOne({
                where: { phone_number: phone_number }
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found",
                response_code: RESPONSE_CODES.NO_ACCOUNT_FOUND,
            });
        }

        if (user.status == 0) {
            logger.info("Deactivated Account Passowrd Reset Attempt", user.id);
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
            logger.info("Locked Account Password Reset Attempt", user.id);
            return res.status(423).json({
                success: false,
                message: 'Account Locked, Please Wait Till The Cool Down Period Is Down',
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
                error: 'Locked Account',
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

        const reset_session = await PasswordReset.create({
            user_id: user.id,
            otp: otp,
            otp_expiry: otp_expiry,
            otp_attempts: 0,
            is_used: 0,
            device_id: device_id,
            expires_at: new Date(Date.now() + 15 * 60 * 1000),
            created_at: Date.now(),
        });

        if (email) {
            await publish(Topics.USER_EVENTS, [
                {
                    key: Keys.USER_EMAIL_OTP,
                    value: JSON.stringify({ otp, email })
                }
            ]);
        }

        if (phone_number) {
            await publish(Topics.USER_EVENTS, [
                {
                    key: Keys.USER_MOBILE_OTP,
                    value: JSON.stringify({ otp, phone_number })
                }
            ]);
        }

        logger.info("Password Reset OTP sent", user.id);


        return res.status(200).json({
            success: true,
            message: "Password reset OTP sent successfully",
            response_code: RESPONSE_CODES.OTP_SENT,
            data: {
                reset_session_id: encryptId(reset_session.id),
                user_id: encryptId(user.id),
                email: user.email,
                phone_number: user.phone_number,
            }
        });

    }
    catch (exception) {
        logger.error("Forgot Password Error");
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try again later..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const ChangePassword = async (req, res) => {
    try {

        const { password, confirm_password, user_id, reset_session_id, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_reset_id = decryptId(reset_session_id);

        const reset_session = await PasswordReset.findOne({
            where: {
                id: decrypted_reset_id,
                user_id: decrypted_user_id,
                device_id: device_id,
                is_used: 0,
            }
        });

        if (!reset_session) {
            logger.warn("Invalid Reset Session Id", user_id);
            return res.status(400).json({
                success: false,
                message: 'No Password Reset Session Found , Please Try Again',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (new Date() > reset_session.otp_expiry) {
            logger.warn("VerifyPasswordResetToken Attempt with expired OTP for user_id:", decrypted_user_id);
            return res.status(400).json({
                success: false,
                message: "OTP Expired",
                response_code: RESPONSE_CODES.OTP_EXPIRED,
                data: {},
                error: "OTP Expired",
            });
        }

        if (reset_session.is_verified == 0) {
            logger.warn("Reset Session Not Verified", user_id);
            return res.status(400).json({
                success: false,
                message: 'Password Reset Session Not Verified , Please Verify The OTP First',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (reset_session.is_used == 1) {
            logger.warn("Used Reset Session Id", user_id);
            return res.status(400).json({
                success: false,
                message: 'Password Reset Token has already been used',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        const user = await User.findOne({
            where: {
                id: decrypted_user_id,
            }
        });

        const hashed_password = await bcrypt.hash(password, 10);

        user.password = hashed_password;
        await user.save();

        reset_session.is_used = 1;
        await reset_session.save();

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_PASSWORD_CHANGED,
                value: JSON.stringify({
                    email: user.email,
                    phone_number: user.phone_number,
                }),
            }
        ]);


        return res.status(200).json({
            success: true,
            message: 'Password Has Been Changed Successfully',
            response_code: RESPONSE_CODES.PASSWORD_CHANGED,
        });

    }
    catch (exception) {
        logger.error("Change Password Error", user_id);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong !, Please Try Again Later..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const VerifyPasswordResetToken = async (req, res) => {
    try {

        const { otp, user_id, reset_session_id, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_reset_id = decryptId(reset_session_id);

        const reset_session = await PasswordReset.findOne({
            where: {
                id: decrypted_reset_id,
                user_id: decrypted_user_id,
                device_id: device_id,
                is_used: 0,
            }
        });

        if (!reset_session) {
            logger.warn("Invalid Reset Session Id", user_id);
            return res.status(400).json({
                success: false,
                message: 'No Password Reset Session Found , Please Try Again',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (reset_session.is_used == 1) {
            logger.warn("Used Reset Session Id", user_id);
            return res.status(400).json({
                success: false,
                message: 'Password Reset Token has already been used',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (reset_session.otp !== otp) {
            logger.warn("GeneralOTPVerification Attempt with invalid OTP for user_id:", decrypted_user_id);

            reset_session.otp_attempts += 1;
            await reset_session.save();
        }

        if (reset_session.otp_attempts >= MAX_FAILED_ATTEMPTS) {
            reset_session.revoked = true;
            await reset_session.save();

            logger.warn("VerifyPasswordResetToken User Session revoked due to max failed attempts user_id:", decrypted_user_id);
            return res.status(403).json({
                success: false,
                message: "Please Login In Again !",
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
                data: {},
                error: "Session Expired",
            });
        }

        // OTP Expiration Check
        if (new Date() > reset_session.otp_expiry) {
            logger.warn("VerifyPasswordResetToken Attempt with expired OTP for user_id:", decrypted_user_id);
            return res.status(400).json({
                success: false,
                message: "OTP Expired",
                response_code: RESPONSE_CODES.OTP_EXPIRED,
                data: {},
                error: "OTP Expired",
            });
        }

        if (reset_session.otp === otp) {
            reset_session.is_verified = 1;
            reset_session.updated_at = new Date();
            await reset_session.save();

            return res.status(200).json({
                success: true,
                message: 'Otp Verification Successfull',
                response_code: RESPONSE_CODES.OTP_VERIFIED,
                data: {
                    user_id: user_id,
                    reset_session_id: reset_session_id
                }
            });
        }

    }
    catch (exception) {
        logger.error("VerifyPasswordResetToken Error");
        return res.status(500).json({
            success: false,
            response_code: RESPONSE_CODES.SERVER_ERROR,
            message: 'Something went wrong , Please Try again later',
            error: exception.message,
        })
    }
};

export const ForgotPasswordWithSession = async (req, res) => {
    try {
        const { user_id, old_password, new_password, confirm_password } = req.body;

        const decrypted_user_id = decryptId(user_id);

        if (!user_id || !old_password || !new_password || !confirm_password) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
                response_code: RESPONSE_CODES.INVALID_INPUT,
            });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match",
                response_code: RESPONSE_CODES.INVALID_INPUT,
            });
        }

        const user = await User.findOne({
            where: { id: decrypted_user_id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
                response_code: RESPONSE_CODES.USER_NOT_FOUND,
            });
        }

        const isOldPasswordCorrect = await bcrypt.compare(old_password, user.password);

        if (!isOldPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Old password is incorrect",
                response_code: RESPONSE_CODES.INVALID_PASSWORD,
            });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        user.password = hashedPassword;
        await user.save();

        await Session.update(
            { revoked: true },
            { where: { user_id: user.id } }
        );

        await RefreshToken.update(
            { revoked: true },
            { where: { user_id: user.id } }
        );

        logger.info("Password Changed Successfully", user.id);

        return res.status(200).json({
            success: true,
            message: 'Password has been changed successfully. Please login again.',
            response_code: RESPONSE_CODES.PASSWORD_CHANGED,
        });

    }
    catch (exception) {
        logger.error("Forgot Password Session Error", user_id);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const GetUserDetails = async (req, res) => {
    try {

        const { user_id } = req.body;

        const decrypted_user_id = decryptId(user_id);


        const user = await User.findOne({
            where: {
                id: decrypted_user_id
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User Not Found",
                error_code: "USER_NOT_FOUND",
            });
        }

        return res.status(200).json({
            success: true,
            message: "User Details Fetched Successfully",
            data: {
                id: user.id,
                email: user.email,
                phone_number: user.phone_number,
            }
        });

    }
    catch (exception) {
        logger.error("Get User Details Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const DeleteAccount = async (req, res) => {
    try {
        const { user_id, session_id, device_id, device_name, passcode } = req.body;

        const decrypted_user_id = decryptId(user_id);

        const user = await User.findOne({
            where: {
                id: decrypted_user_id,
            }
        });

        const fetch_passkey = await PassKeys.findOne({
            where: {
                user_id: decrypted_user_id,
                device_id: device_id,
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
            logger.info("Invalid Passkey Attempt");

        }


        if (!user) {
            return res.status(400).json({
                successs: false,
                message: 'Invalid User',
                response_code: RESPONSE_CODES.NO_ACCOUNT_FOUND,
            });
        }

        const deleted_email = RandomEmail(user.email);
        const deleted_mobile = RandomMobile(user.phone_number);

        user.status = 0;
        user.email = deleted_email;
        user.phone_number = deleted_mobile;
        user.trash = "YES";
        await user.save();

        // Session Deactivation

        const session_deactivation = await Session.update({
            revoked: true
        }, {
            where: {
                user_id: {
                    [Op.eq]: decrypted_user_id
                }
            }
        });

        // Refresh Token Revoking
        const refresh_deactivation = await RefreshToken.update({
            revoked: true
        }, {
            where: {
                user_id: {
                    [Op.eq]: decrypted_user_id
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Account Deleted Successfully',
            respone_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });

    }
    catch (exception) {
        logger.error("Delete Account API Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong , Please Try again later",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};


// Register Challenge
export const registerBiometricChallenge = async (req, res) => {
    try {
        const { user_id, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);

        const challenge = await createChallenge(decrypted_user_id, device_id);

        return res.status(200).json({
            success: true,
            message: "Bio Metric Challenge Created Successfully",
            response_code: RESPONSE_CODES.BIO_METRIC_REGISTER_CHALLENGE_CREATED,
            data: {
                challenge,
                timeout: 300000,
            },
        });
    } catch (exception) {
        logger.error("Register BioMetric Challenge Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, Please Try again later",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};


// Register Verify
export const registerBiometricVerify = async (req, res) => {
    try {
        const {
            user_id,
            device_id,
            device_name,
            platform,
            credential_id,
            public_key,
            signature,
        } = req.body;

        const decrypted_user_id = decryptId(user_id);

        const challenge = await getChallenge(decrypted_user_id, device_id);
        if (!challenge) {
            return res.status(400).json({
                success: false,
                response_code: RESPONSE_CODES.CHALLENGE_TIME_EXPIRED,
                message: "Challenge expired",
            });
        }

        const publicKeyPem = base64ToPemPublicKey(public_key);

        const isValid = crypto.verify(
            "sha256",
            Buffer.from(challenge),
            {
                key: publicKeyPem,
                format: "pem",
                type: "spki",
            },
            Buffer.from(signature, "base64")
        );

        if (!isValid) {
            return res.status(401).json({
                success: false,
                response_code: RESPONSE_CODES.BIOMETRIC_AUTH_FAILED,
                message: "Invalid biometric signature",
            });
        }

        await BiometricCredential.upsert({
            user_id: decrypted_user_id,
            device_id,
            device_name,
            platform,
            credential_id,
            public_key: publicKeyPem,
            status: 1,
            last_used_at: new Date(),
        });

        await User.update(
            {
                biometric_enabling: 1,
            },
            {
                where: {
                    id: decrypted_user_id,
                },
            }
        );


        await deleteChallenge(decrypted_user_id, device_id);

        return res.status(200).json({
            success: true,
            message: "Biometric registered successfully",
            response_code: RESPONSE_CODES.BIOMETRIC_SETUP_SUCCESSFUL,
        });
    } catch (exception) {
        logger.error("Register BioMetric Verify Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, Please Try again later",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

// Login BioMetric Challenge
export const loginBiometricChallenge = async (req, res) => {
    try {
        const { user_id, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);

        const credential = await BiometricCredential.findOne({
            where: { user_id: decrypted_user_id, device_id, status: 1 },
        });

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Biometric not registered",
                response_code: RESPONSE_CODES.NOT_FOUND,
            });
        }

        const challenge = await createChallenge(decrypted_user_id, device_id);

        return res.status(200).json({
            success: true,
            message: "Bio Metric Challenge Created Successfully",
            response_code: RESPONSE_CODES.BIO_METRIC_LOGIN_CHALLENGE_CREATED,
            data: {
                challenge,
                credential_id: credential.credential_id,
            },
        });
    } catch (exception) {
        logger.error("Login BioMetric Challenge Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, Please Try again later",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

// Login BioMetric Verify
export const loginBiometricVerify = async (req, res) => {
    try {
        const {
            user_id,
            device_id,
            credential_id,
            signature,
            session_id,
        } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        const challenge = await getChallenge(decrypted_user_id, device_id);
        if (!challenge) {
            return res.status(400).json({
                success: false,
                response_code: RESPONSE_CODES.CHALLENGE_TIME_EXPIRED,
                message: "Challenge expired",
            });
        }

        const credential = await BiometricCredential.findOne({
            where: { credential_id, user_id: decrypted_user_id, status: 1 },
        });

        if (!credential) {
            return res.status(401).json({
                success: false,
                response_code: RESPONSE_CODES.NOT_FOUND,
                message: "No biometric credential found",
            });
        }

        const isValid = crypto.verify(
            "sha256",
            Buffer.from(challenge),
            {
                key: credential.public_key,
                format: "pem",
                type: "spki",
            },
            Buffer.from(signature, "base64")
        );

        if (!isValid) {
            return res.status(401).json({
                success: false,
                response_code: RESPONSE_CODES.BIOMETRIC_AUTH_FAILED,
                message: "Invalid biometric signature",
            });
        }

        await deleteChallenge(decrypted_user_id, device_id);
        await credential.update({ last_used_at: new Date() });


        const user = await User.findOne({
            where: {
                id: decrypted_user_id,
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

        let admin = false;

        if (user.role == 2) {
            admin = true;
        }

        // Generate Access and Refresh Tokens
        const access_token = signAccess({ user_id: encryptId(user.id), session_id: encryptId(session.id), admin: admin, verified: true, ekyc_passed: user.ekyc_passed });
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
            message: "Biometric authentication successful",
            response_code: RESPONSE_CODES.BIOMETRIC_AUTH_SUCCESSFUL,
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
    } catch (exception) {
        logger.error("Login BioMetric Verify Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, Please Try again later",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

// BioMetric API
export const BioMetricPermission = async (req, res) => {
    try {

        const { user_id, session_id, device_id, device_name } = req.body;

        const decrypted_user_id = decryptId(user_id);

        const findUser = await User.findOne({
            where: {
                id: decrypted_user_id
            }
        });

        if (!findUser) {
            return res.status(400).json({
                success: false,
                message: 'Invalid User',
                response_code: RESPONSE_CODES.NO_ACCOUNT_FOUND,
            });
        }

        findUser.biometric_enabling = decrypted_status;
        await findUser.save();

        return res.status(200).json({
            success: true,
            message: 'Bio Metric Status Updated successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: {
                status: findUser.biometric_enabling == 1 ? 'Enabled' : 'Disabled'
            }
        });
    }
    catch (exception) {
        logger.error("BioMetric Permission Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, Please Try again later",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

