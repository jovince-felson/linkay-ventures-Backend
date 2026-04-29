import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import RefreshToken from "../models/refresh_token.model.js";
import PasswordReset from "../models/password_resets.model.js";
import { publish, Topics, Keys, logger, RESPONSE_CODES, encryptId, decryptId } from "rhoam-shared-utils";

dotenv.config();

const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5;

export const ForgotPassword = async (req, res) => {
    try {
        const { email, device_id } = req.body;

        // Always return same message to prevent account enumeration
        const genericResponse = {
            success: true,
            message: "Reset email sent if account exists.",
            response_code: RESPONSE_CODES.OTP_SENT,
        };

        const user = await User.findOne({ where: { email: email.toLowerCase() } });

        if (!user) {
            return res.status(200).json(genericResponse);
        }

        if (user.status === 'DEACTIVATED' || user.status === 'SUSPENDED') {
            return res.status(200).json(genericResponse);
        }

        if (
            user.is_locked == 1 &&
            user.locked_until &&
            new Date(user.locked_until) > new Date()
        ) {
            return res.status(423).json({
                success: false,
                message: 'Account locked. Please wait for the cooldown period.',
                response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000);
        const otp_expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour per doc

        const reset_session = await PasswordReset.create({
            user_id: user.id,
            otp: otp,
            otp_expiry: otp_expiry,
            otp_attempts: 0,
            is_used: 0,
            device_id: device_id,
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
            created_at: Date.now(),
        });

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_EMAIL_OTP,
                value: JSON.stringify({ otp, email: user.email })
            }
        ]);

        logger.info("Password Reset OTP sent", user.id);

        return res.status(200).json({
            ...genericResponse,
            data: {
                reset_session_id: encryptId(reset_session.id),
                user_id: encryptId(user.id),
            }
        });

    } catch (exception) {
        logger.error("Forgot Password Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again later.',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
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
            return res.status(400).json({
                success: false,
                message: 'No password reset session found. Please try again.',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (reset_session.is_used == 1) {
            return res.status(400).json({
                success: false,
                message: 'Password reset token has already been used.',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (new Date() > reset_session.otp_expiry) {
            return res.status(400).json({
                success: false,
                message: "Reset token expired.",
                response_code: RESPONSE_CODES.OTP_EXPIRED,
                error: "Token Expired",
            });
        }

        if (reset_session.otp_attempts >= MAX_FAILED_ATTEMPTS) {
            reset_session.revoked = true;
            await reset_session.save();
            return res.status(403).json({
                success: false,
                message: "Too many failed attempts. Please restart the password reset flow.",
                response_code: RESPONSE_CODES.SESSION_EXPIRED,
            });
        }

        if (reset_session.otp !== otp) {
            reset_session.otp_attempts += 1;
            await reset_session.save();
            return res.status(400).json({
                success: false,
                message: "Invalid token.",
                response_code: RESPONSE_CODES.OTP_INVALID,
                error: "Invalid token",
            });
        }

        reset_session.is_verified = 1;
        reset_session.updated_at = new Date();
        await reset_session.save();

        return res.status(200).json({
            success: true,
            message: 'Token verified successfully.',
            response_code: RESPONSE_CODES.OTP_VERIFIED,
            data: { user_id, reset_session_id }
        });

    } catch (exception) {
        logger.error("VerifyPasswordResetToken Error", exception);
        return res.status(500).json({
            success: false,
            response_code: RESPONSE_CODES.SERVER_ERROR,
            message: 'Something went wrong. Please try again later.',
            error: exception.message,
        });
    }
};

export const ChangePassword = async (req, res) => {
    try {
        const { password, user_id, reset_session_id, device_id } = req.body;

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
            return res.status(400).json({
                success: false,
                message: 'No password reset session found. Please try again.',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (reset_session.is_verified == 0) {
            return res.status(400).json({
                success: false,
                message: 'Please verify your reset token first.',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (reset_session.is_used == 1) {
            return res.status(400).json({
                success: false,
                message: 'Password reset token has already been used.',
                response_code: RESPONSE_CODES.INVALID_TOKEN,
            });
        }

        if (new Date() > reset_session.otp_expiry) {
            return res.status(400).json({
                success: false,
                message: "Reset token expired.",
                response_code: RESPONSE_CODES.OTP_EXPIRED,
            });
        }

        const user = await User.findOne({ where: { id: decrypted_user_id } });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found.",
                response_code: RESPONSE_CODES.USER_NOT_FOUND,
            });
        }

        const hashed_password = await bcrypt.hash(password, 12);
        user.password = hashed_password;
        await user.save();

        reset_session.is_used = 1;
        await reset_session.save();

        // Invalidate all active sessions and refresh tokens on password reset (per doc)
        await Session.update({ revoked: true }, { where: { user_id: user.id } });
        await RefreshToken.update({ revoked: true }, { where: { user_id: user.id } });

        await publish(Topics.USER_EVENTS, [
            {
                key: Keys.USER_PASSWORD_CHANGED,
                value: JSON.stringify({ email: user.email }),
            }
        ]);

        return res.status(200).json({
            success: true,
            message: 'Password has been reset successfully. Please log in again.',
            response_code: RESPONSE_CODES.PASSWORD_CHANGED,
        });

    } catch (exception) {
        logger.error("Change Password Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again later.',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};



// import bcrypt from "bcrypt";
// import dotenv from "dotenv";
// import User from "../models/users.model.js";
// import Session from "../models/session.model.js";
// import RefreshToken from "../models/refresh_token.model.js";
// import PasswordReset from "../models/password_resets.model.js";
// import { publish, Topics, Keys, logger, RESPONSE_CODES, encryptId, decryptId } from "rhoam-shared-utils";


// dotenv.config();
// const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5;

// export const ForgotPassword = async (req, res) => {
//     try {
//         const { email, phone_number, device_id } = req.body;

//         if (!email && !phone_number) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Email or Phone Number is required",
//                 response_code: RESPONSE_CODES.INVALID_INPUT,
//             });
//         }

//         let user;
//         if (email) {
//             user = await User.findOne({
//                 where: { email: email }
//             });
//         }

//         if (!user && phone_number) {
//             user = await User.findOne({
//                 where: { phone_number: phone_number }
//             });
//         }

//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "No account found",
//                 response_code: RESPONSE_CODES.NO_ACCOUNT_FOUND,
//             });
//         }

//         if (user.status == 0) {
//             logger.info("Deactivated Account Passowrd Reset Attempt", user.id);
//             return res.status(403).json({
//                 success: false,
//                 message: 'Deactivated Account, Please Activate The Account',
//                 error: 'Deactivated Account',
//                 response_code: RESPONSE_CODES.ACCOUNT_DEACTIVATED,
//             });
//         }

//         if (
//             user.is_locked == 1 &&
//             user.locked_until &&
//             new Date(user.locked_until) > new Date()
//         ) {
//             logger.info("Locked Account Password Reset Attempt", user.id);
//             return res.status(423).json({
//                 success: false,
//                 message: 'Account Locked, Please Wait Till The Cool Down Period Is Down',
//                 response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
//                 error: 'Locked Account',
//             });
//         }

//         const otp = Math.floor(100000 + Math.random() * 900000);
//         const otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

//         const reset_session = await PasswordReset.create({
//             user_id: user.id,
//             otp: otp,
//             otp_expiry: otp_expiry,
//             otp_attempts: 0,
//             is_used: 0,
//             device_id: device_id,
//             expires_at: new Date(Date.now() + 15 * 60 * 1000),
//             created_at: Date.now(),
//         });

//         if (email) {
//             await publish(Topics.USER_EVENTS, [
//                 {
//                     key: Keys.USER_EMAIL_OTP,
//                     value: JSON.stringify({ otp, email })
//                 }
//             ]);
//         }

//         if (phone_number) {
//             await publish(Topics.USER_EVENTS, [
//                 {
//                     key: Keys.USER_MOBILE_OTP,
//                     value: JSON.stringify({ otp, phone_number })
//                 }
//             ]);
//         }

//         logger.info("Password Reset OTP sent", user.id);


//         return res.status(200).json({
//             success: true,
//             message: "Password reset OTP sent successfully",
//             response_code: RESPONSE_CODES.OTP_SENT,
//             data: {
//                 reset_session_id: encryptId(reset_session.id),
//                 user_id: encryptId(user.id),
//                 email: user.email,
//                 phone_number: user.phone_number,
//             }
//         });

//     }
//     catch (exception) {
//         logger.error("Forgot Password Error");
//         return res.status(500).json({
//             success: false,
//             message: 'Something went wrong , Please Try again later..!',
//             response_code: RESPONSE_CODES.SERVER_ERROR,
//             error: exception.message,
//         });
//     }
// };

// export const ChangePassword = async (req, res) => {
//     try {

//         const { password, confirm_password, user_id, reset_session_id, device_id } = req.body;

//         const decrypted_user_id = decryptId(user_id);
//         const decrypted_reset_id = decryptId(reset_session_id);

//         const reset_session = await PasswordReset.findOne({
//             where: {
//                 id: decrypted_reset_id,
//                 user_id: decrypted_user_id,
//                 device_id: device_id,
//                 is_used: 0,
//             }
//         });

//         if (!reset_session) {
//             logger.warn("Invalid Reset Session Id", user_id);
//             return res.status(400).json({
//                 success: false,
//                 message: 'No Password Reset Session Found , Please Try Again',
//                 response_code: RESPONSE_CODES.INVALID_TOKEN,
//             });
//         }

//         if (new Date() > reset_session.otp_expiry) {
//             logger.warn("VerifyPasswordResetToken Attempt with expired OTP for user_id:", decrypted_user_id);
//             return res.status(400).json({
//                 success: false,
//                 message: "OTP Expired",
//                 response_code: RESPONSE_CODES.OTP_EXPIRED,
//                 data: {},
//                 error: "OTP Expired",
//             });
//         }

//         if (reset_session.is_verified == 0) {
//             logger.warn("Reset Session Not Verified", user_id);
//             return res.status(400).json({
//                 success: false,
//                 message: 'Password Reset Session Not Verified , Please Verify The OTP First',
//                 response_code: RESPONSE_CODES.INVALID_TOKEN,
//             });
//         }

//         if (reset_session.is_used == 1) {
//             logger.warn("Used Reset Session Id", user_id);
//             return res.status(400).json({
//                 success: false,
//                 message: 'Password Reset Token has already been used',
//                 response_code: RESPONSE_CODES.INVALID_TOKEN,
//             });
//         }

//         const user = await User.findOne({
//             where: {
//                 id: decrypted_user_id,
//             }
//         });

//         const hashed_password = await bcrypt.hash(password, 10);

//         user.password = hashed_password;
//         await user.save();

//         reset_session.is_used = 1;
//         await reset_session.save();

//         await publish(Topics.USER_EVENTS, [
//             {
//                 key: Keys.USER_PASSWORD_CHANGED,
//                 value: JSON.stringify({
//                     email: user.email,
//                     phone_number: user.phone_number,
//                 }),
//             }
//         ]);


//         return res.status(200).json({
//             success: true,
//             message: 'Password Has Been Changed Successfully',
//             response_code: RESPONSE_CODES.PASSWORD_CHANGED,
//         });

//     }
//     catch (exception) {
//         logger.error("Change Password Error", user_id);
//         return res.status(500).json({
//             success: false,
//             message: 'Something went wrong !, Please Try Again Later..!',
//             error: exception.message,
//             response_code: RESPONSE_CODES.SERVER_ERROR,
//         });
//     }
// };

// export const VerifyPasswordResetToken = async (req, res) => {
//     try {

//         const { otp, user_id, reset_session_id, device_id } = req.body;

//         const decrypted_user_id = decryptId(user_id);
//         const decrypted_reset_id = decryptId(reset_session_id);

//         const reset_session = await PasswordReset.findOne({
//             where: {
//                 id: decrypted_reset_id,
//                 user_id: decrypted_user_id,
//                 device_id: device_id,
//                 is_used: 0,
//             }
//         });

//         if (!reset_session) {
//             logger.warn("Invalid Reset Session Id", user_id);
//             return res.status(400).json({
//                 success: false,
//                 message: 'No Password Reset Session Found , Please Try Again',
//                 response_code: RESPONSE_CODES.INVALID_TOKEN,
//             });
//         }

//         if (reset_session.is_used == 1) {
//             logger.warn("Used Reset Session Id", user_id);
//             return res.status(400).json({
//                 success: false,
//                 message: 'Password Reset Token has already been used',
//                 response_code: RESPONSE_CODES.INVALID_TOKEN,
//             });
//         }

//         if (reset_session.otp !== otp) {
//             logger.warn("GeneralOTPVerification Attempt with invalid OTP for user_id:", decrypted_user_id);

//             reset_session.otp_attempts += 1;
//             await reset_session.save();

//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid OTP",
//                 response_code: RESPONSE_CODES.OTP_INVALID,
//                 data: {},
//                 error: "Invalid OTP",
//             });
//         }

//         if (reset_session.otp_attempts >= MAX_FAILED_ATTEMPTS) {
//             reset_session.revoked = true;
//             await reset_session.save();

//             logger.warn("VerifyPasswordResetToken User Session revoked due to max failed attempts user_id:", decrypted_user_id);
//             return res.status(400).json({
//                 success: false,
//                 message: "Please Login In Again !",
//                 response_code: RESPONSE_CODES.SESSION_EXPIRED,
//                 data: {},
//                 error: "Session Expired",
//             });
//         }

//         // OTP Expiration Check
//         if (new Date() > reset_session.otp_expiry) {
//             logger.warn("VerifyPasswordResetToken Attempt with expired OTP for user_id:", decrypted_user_id);
//             return res.status(400).json({
//                 success: false,
//                 message: "OTP Expired",
//                 response_code: RESPONSE_CODES.OTP_EXPIRED,
//                 data: {},
//                 error: "OTP Expired",
//             });
//         }

//         if (reset_session.otp === otp) {
//             reset_session.is_verified = 1;
//             reset_session.updated_at = new Date();
//             await reset_session.save();

//             return res.status(200).json({
//                 success: true,
//                 message: 'Otp Verification Successfull',
//                 response_code: RESPONSE_CODES.OTP_VERIFIED,
//                 data: {
//                     user_id: user_id,
//                     reset_session_id: reset_session_id
//                 }
//             });
//         }

//     }
//     catch (exception) {
//         logger.error("VerifyPasswordResetToken Error");
//         return res.status(500).json({
//             success: false,
//             response_code: RESPONSE_CODES.SERVER_ERROR,
//             message: 'Something went wrong , Please Try again later',
//             error: exception.message,
//         })
//     }
// };

// export const ForgotPasswordWithSession = async (req, res) => {
//     try {
//         const { user_id, old_password, new_password, confirm_password } = req.body;

//         const decrypted_user_id = decryptId(user_id);

//         if (!user_id || !old_password || !new_password || !confirm_password) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Missing required fields",
//                 response_code: RESPONSE_CODES.INVALID_INPUT,
//             });
//         }

//         if (new_password !== confirm_password) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Passwords do not match",
//                 response_code: RESPONSE_CODES.INVALID_INPUT,
//             });
//         }

//         const user = await User.findOne({
//             where: { id: decrypted_user_id }
//         });

//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found",
//                 response_code: RESPONSE_CODES.USER_NOT_FOUND,
//             });
//         }

//         const isOldPasswordCorrect = await bcrypt.compare(old_password, user.password);

//         if (!isOldPasswordCorrect) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Old password is incorrect",
//                 response_code: RESPONSE_CODES.INVALID_PASSWORD,
//             });
//         }

//         const hashedPassword = await bcrypt.hash(new_password, 10);

//         user.password = hashedPassword;
//         await user.save();

//         return res.status(200).json({
//             success: true,
//             message: 'Password has been changed successfully. Please login again.',
//             response_code: RESPONSE_CODES.PASSWORD_CHANGED,
//         });

//     }
//     catch (exception) {
//         logger.error("Forgot Password Session Error", user_id);
//         return res.status(500).json({
//             success: false,
//             message: 'Something went wrong , Please Try Again Later ..!',
//             error: exception.message,
//             response_code: RESPONSE_CODES.SERVER_ERROR,
//         });
//     }
// };
