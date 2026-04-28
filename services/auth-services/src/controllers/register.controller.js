import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { auth, OAuth2Client } from "google-auth-library";
import appleSigninAuth from "apple-signin-auth";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import { Op } from "sequelize";
import { publish, Topics, Keys, logger, RESPONSE_CODES, encryptId } from "rhoam-shared-utils";
dotenv.config();

export const Register = async (req, res) => {

    try {
        const { email, password, phone_number, country_id, confirm_password, device_id, device_name, fcm_token } = req.body;

        const user = await User.findOne({
            where: {
                [Op.or]: {
                    email: email,
                    phone_number: phone_number,
                },
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
            phone_number: phone_number,
            country_id: country_id,
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

        await publish(Topics.USER_EVENTS, [{
            key: Keys.USER_MOBILE_OTP,
            value: JSON.stringify({
                otp: session.otp,
                phone_number: phone_number,
            }),
        }]);

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
            country_id: country_id,
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
