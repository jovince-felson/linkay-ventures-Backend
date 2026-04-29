import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import RefreshToken from "../models/refresh_token.model.js";
import { publish, Topics, Keys, logger, RESPONSE_CODES } from "rhoam-shared-utils";
import {
  cookieOptions,
  hashRefresh,
  genRefreshPlain,
  signAccess,
} from "../utils/auth.utils.js";

dotenv.config();

const REFRESH_TOKEN_EXPIRES_DAYS =
  parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7;
const REFRESH_COOKIE_NAME =
  process.env.REFRESH_COOKIE_NAME || "refresh_token";
const REFRESH_COOKIE_MAXAGE =
  REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

export const LoginWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email: email.toLowerCase() },
    });

    // Identical message for unknown email vs wrong password — prevents enumeration
    if (!user) {
      logger.info("Login attempt — unknown email", {
        email: email.toLowerCase(),
      });
      return res.status(401).json({
        success: false,
        response_code: RESPONSE_CODES.LOGIN_FAILED,
        message: "Invalid credentials. Please check your email and password.",
      });
    }

    // ── Lockout check ─────────────────────────────────────────────────────────
    const now = new Date();

    if (user.locked_until && new Date(user.locked_until) > now) {
      const minutesLeft = Math.ceil(
        (new Date(user.locked_until) - now) / 60000
      );
      return res.status(423).json({
        success: false,
        response_code: "AUTH_004",
        message: `Account temporarily locked. Please try again in ${minutesLeft} minute(s).`,
      });
    }

    // Auto-reset counters once the lockout window has passed
    if (user.locked_until && new Date(user.locked_until) <= now) {
      user.failed_login_attempts = 0;
      user.locked_until = null;
      await user.save();
      logger.info("Account lockout expired — auto-reset", {
        user_id: user.id,
      });
    }

    // ── Password check ────────────────────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      user.failed_login_attempts += 1;

      // Spec: 5 failed attempts → 15-minute lockout
      if (user.failed_login_attempts >= 5) {
        user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        return res.status(423).json({
          success: false,
          response_code: "AUTH_004",
          message:
            "Account temporarily locked. Please try again in 15 minutes.",
        });
      }

      await user.save();
      return res.status(401).json({
        success: false,
        response_code: RESPONSE_CODES.LOGIN_FAILED,
        message: "Invalid credentials. Please check your email and password.",
      });
    }

    // ── Status gate ───────────────────────────────────────────────────────────
    // Only ACTIVE accounts may proceed
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        response_code: "AUTH_007",
        message:
          user.status === "SUSPENDED"
            ? "Your account has been suspended. Please contact support."
            : "Your account is not active. Contact support.",
      });
    }

    // ── Successful login — reset rate-limit counters ───────────────────────────
    user.failed_login_attempts = 0;
    user.locked_until = null;
    user.last_login_at = now;
    await user.save();

    // ── Session creation ──────────────────────────────────────────────────────
    const session = await Session.create({
      user_id: user.id,
      is_ip_verified: true,
      is_device_verified: true,
      ip: req.ip,
      user_agent: req.headers["user-agent"] || "",
    });

    // JWT payload per spec: { userId, email, role, walletAddress? }
    const access_token = signAccess({
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      role: user.role,
      walletAddress: user.wallet_address ?? undefined,
    });

    // ── Refresh token ─────────────────────────────────────────────────────────
    const refresh_plain = genRefreshPlain();
    const refresh_hashed = await hashRefresh(refresh_plain);
    const refresh_expires_at = new Date(Date.now() + REFRESH_COOKIE_MAXAGE);

    await RefreshToken.create({
      user_id: user.id,
      session_id: session.id,
      token_hash: refresh_hashed,
      expires_at: refresh_expires_at,
      issued_at: now,
    });

    // Spec: refresh token in httpOnly cookie — never in response body
    res.cookie(REFRESH_COOKIE_NAME, refresh_plain, cookieOptions());

    // Spec response shape: { accessToken, user: { id, email, role, walletAddress, kycStatus } }
    return res.status(200).json({
      success: true,
      response_code: RESPONSE_CODES.LOGIN_SUCCESSFUL,
      message: "Login successful",
      data: {
        accessToken: access_token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          walletAddress: user.wallet_address ?? null,
          kycStatus: user.kyc_status,
        },
      },
    });
  } catch (exception) {
    logger.error("LoginWithEmail Error", exception);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
      response_code: RESPONSE_CODES.SERVER_ERROR,
    });
  }
};

export const Logout = async (req, res) => {
  try {
    // session_id comes from the verified JWT payload set by CheckUser middleware
    const { sessionId } = req.user;

    const session = await Session.findOne({ where: { id: sessionId } });

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "Session not found.",
        response_code: RESPONSE_CODES.INVALID_SESSION,
      });
    }

    session.revoked = true;
    await session.save();

    // Invalidate the paired refresh token
    await RefreshToken.update(
      { revoked: true },
      { where: { session_id: session.id } }
    );

    res.clearCookie(REFRESH_COOKIE_NAME);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (exception) {
    logger.error("Logout Error", exception);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
      response_code: RESPONSE_CODES.SERVER_ERROR,
    });
  }
};









// import bcrypt from "bcrypt";
// import dotenv from "dotenv";
// import User from "../models/users.model.js";
// import Session from "../models/session.model.js";
// import RefreshToken from "../models/refresh_token.model.js";
// import { publish, Topics, Keys, logger, RESPONSE_CODES, encryptId, decryptId } from "rhoam-shared-utils";
// import {
//     cookieOptions,
//     hashRefresh,
//     genRefreshPlain,
//     signAccess,
// } from '../utils/auth.utils.js';

// dotenv.config();

// const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "15m";
// const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 7;
// const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";
// const REFRESH_COOKIE_MAXAGE = REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000;

// export const LoginWithEmail = async (req, res) => {
//     try {
//         const { email, password, device_id, device_name, fcm_token } = req.body;

//         const user = await User.findOne({ where: { email: email.toLowerCase() } });

//         if (!user) {
//             logger.info("Login Attempt with Unknown Email", email);
//             return res.status(401).json({
//                 success: false,
//                 response_code: RESPONSE_CODES.LOGIN_FAILED,
//                 message: 'Invalid credentials. Please check your email and password.',
//                 error: 'Invalid credentials',
//             });
//         }

//         // Check lock before comparing password
//         if (
//             user.is_locked == 1 &&
//             user.locked_until &&
//             new Date(user.locked_until) > new Date()
//         ) {
//             const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
//             return res.status(423).json({
//                 success: false,
//                 message: `Account temporarily locked. Please try again in ${minutesLeft} minute(s).`,
//                 response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
//                 data: {},
//             });
//         }

//         // Auto-unlock if lockout has expired
//         if (
//             user.is_locked == 1 &&
//             user.locked_until &&
//             new Date(user.locked_until) <= new Date()
//         ) {
//             user.is_locked = 0;
//             user.failed_attempts = 0;
//             user.locked_until = null;
//             await user.save();
//             logger.info("Account Auto-Unlocked", user.id);
//         }

//         const passwordMatch = await bcrypt.compare(password, user.password);

//         if (!passwordMatch) {
//             user.failed_attempts += 1;

//             if (user.failed_attempts >= 5) {
//                 user.is_locked = 1;
//                 user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
//                 await user.save();
//                 return res.status(423).json({
//                     success: false,
//                     message: 'Account temporarily locked. Please try again in 15 minutes.',
//                     response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
//                     data: {},
//                 });
//             }

//             await user.save();
//             return res.status(401).json({
//                 success: false,
//                 message: "Invalid credentials. Please check your email and password.",
//                 response_code: RESPONSE_CODES.LOGIN_FAILED,
//                 error: 'Invalid credentials',
//             });
//         }

//         if (user.status !== 'ACTIVE') {
//             return res.status(403).json({
//                 success: false,
//                 message: user.status === 'SUSPENDED'
//                     ? 'Your account has been suspended. Please contact support.'
//                     : 'Your account is not active. Contact support.',
//                 response_code: RESPONSE_CODES.ACCOUNT_DEACTIVATED,
//             });
//         }

//         // Successful login — reset failed attempts
//         user.failed_attempts = 0;
//         user.is_locked = false;
//         user.locked_until = null;
//         user.last_login_at = new Date();
//         await user.save();

//         const session = await Session.create({
//             user_id: user.id,
//             is_ip_verified: true,
//             is_device_verified: true,
//             ip: req.ip,
//             device_id: device_id,
//             device_name: device_name,
//             user_agent: req.headers["user-agent"] || "",
//         });

//         const access_token = signAccess({
//             user_id: encryptId(user.id),
//             session_id: encryptId(session.id),
//             email: user.email,
//             role: user.role,
//             wallet_address: user.wallet_address || null,
//         });

//         const refresh_plain = genRefreshPlain();
//         const refresh_hashed = await hashRefresh(refresh_plain);
//         const refresh_expires_at = new Date(Date.now() + REFRESH_COOKIE_MAXAGE);

//         await RefreshToken.create({
//             user_id: user.id,
//             session_id: session.id,
//             token_hash: refresh_hashed,
//             expires_at: refresh_expires_at,
//             issued_at: new Date(),
//         });

//         res.cookie(REFRESH_COOKIE_NAME, refresh_plain, cookieOptions());

//         if (fcm_token) {
//             await publish(Topics.USER_EVENTS, [
//                 {
//                     key: Keys.USER_FCM_REGISTER,
//                     value: JSON.stringify({ fcm_token, user_id: user.id }),
//                 },
//             ]);
//         }

//         const encrypted_session_id = encryptId(session.id);
//         const encrypted_user_id = encryptId(user.id);

//         return res.status(200).json({
//             success: true,
//             message: 'Login successful',
//             response_code: RESPONSE_CODES.LOGIN_SUCCESSFUL,
//             data: {
//                 access_token,
//                 access_token_expires_in: ACCESS_TOKEN_EXP,
//                 user: {
//                     id: encrypted_user_id,
//                     email: user.email,
//                     role: user.role,
//                     wallet_address: user.wallet_address || null,
//                     kyc_status: user.kyc_status,
//                     session_id: encrypted_session_id,
//                 }
//             }
//         });

//     } catch (exception) {
//         logger.error("Login With Email Error", exception);
//         return res.status(500).json({
//             success: false,
//             message: 'Something went wrong. Please try again later.',
//             response_code: RESPONSE_CODES.SERVER_ERROR,
//             error: exception.message,
//         });
//     }
// };

// export const Logout = async (req, res) => {
//     try {
//         const { session_id } = req.body;
//         const decrypted_session_id = decryptId(session_id);

//         const session = await Session.findOne({ where: { id: decrypted_session_id } });

//         if (!session) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid session. Please login again.",
//                 response_code: RESPONSE_CODES.INVALID_SESSION,
//                 data: {},
//             });
//         }

//         session.revoked = true;
//         await session.save();

//         await RefreshToken.update(
//             { revoked: true },
//             { where: { session_id: decrypted_session_id } }
//         );

//         res.clearCookie(REFRESH_COOKIE_NAME);

//         return res.status(200).json({
//             success: true,
//             message: "Logged out successfully",
//             response_code: RESPONSE_CODES.OPERATION_SUCCESS,
//         });

//     } catch (exception) {
//         logger.error("Logout Error", exception);
//         return res.status(500).json({
//             success: false,
//             message: "Something went wrong. Please try again.",
//             response_code: RESPONSE_CODES.SERVER_ERROR,
//             error: exception.message,
//         });
//     }
// };









// // import bcrypt from "bcrypt";
// // import dotenv from "dotenv";
// // import User from "../models/users.model.js";
// // import Session from "../models/session.model.js";
// // import RefreshToken from "../models/refresh_token.model.js";
// // import { publish, Topics, Keys, logger, RESPONSE_CODES, encryptId, decryptId } from "rhoam-shared-utils";


// // dotenv.config();
// // const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";

// // export const LoginWithEmail = async (req, res) => {
// //     try {
// //         const { email, password, device_id, device_name, fcm_token } = req.body;

// //         const user = await User.findOne({
// //             where: {
// //                 email
// //             }
// //         });

// //         if (!user) {
// //             logger.info("Login Attempt with Unknown Email", email);
// //             return res.status(400).json({
// //                 success: false,
// //                 response_code: RESPONSE_CODES.LOGIN_FAILED,
// //                 message: 'No Account Found With This Email',
// //                 error: 'Invalid Email',
// //             });
// //         }

// //         const passwordMatch = await bcrypt.compare(password, user.password);
// //         if (!passwordMatch) {
// //             user.failed_attempts += 1;
// //             await user.save();
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Invalid Credentials, Please Try Again",
// //                 response_code: RESPONSE_CODES.LOGIN_FAILED,
// //                 error: 'Invalid Credentials',
// //             });
// //         }


// //         if (
// //             user.is_locked == 1 &&
// //             user.locked_until &&
// //             new Date(user.locked_until) <= new Date()
// //         ) {
// //             user.is_locked = 0;
// //             user.failed_attempts = 0;
// //             user.locked_until = null;
// //             await user.save();

// //             logger.info("Account Unlocked !", user.id);
// //         }

// //         if (user.failed_attempts >= 5) {
// //             user.is_locked = 1;
// //             user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
// //             await user.save();

// //             return res.status(403).json({
// //                 success: false,
// //                 message: "Account Locked due to multiple failed attempts",
// //                 response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
// //                 data: {},
// //                 error: "Account Locked",
// //             });
// //         }

// //         user.failed_attempts = 0;
// //         user.is_locked = false;
// //         user.locked_until = null;
// //         await user.save();

// //         let is_ip_verified = false;
// //         let is_device_verified = false;
// //         let otp = Math.floor(100000 + Math.random() * 900000);
// //         let otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

// //         const session = await Session.create({
// //             user_id: user.id,
// //             is_ip_verified: is_ip_verified,
// //             is_device_verified: is_device_verified,
// //             ip: req.ip,
// //             otp: otp,
// //             device_id: device_id,
// //             device_name: device_name,
// //             otp_expiry: otp_expiry,
// //         });

// //         await publish(Topics.USER_EVENTS, [
// //             {
// //                 key: Keys.USER_EMAIL_OTP,
// //                 value: JSON.stringify({
// //                     email: user.email,
// //                     otp: otp
// //                 }),
// //             }
// //         ]);

// //         await publish(Topics.USER_EVENTS, [
// //             {
// //                 key: Keys.USER_FCM_REGISTER,
// //                 value: JSON.stringify({
// //                     fcm_token: fcm_token,
// //                     user_id: user.id
// //                 }),
// //             }
// //         ]);

// //         const encrypted_session_id = encryptId(session.id);
// //         const encrypted_user_id = encryptId(user.id);

// //         return res.status(201).json({
// //             success: true,
// //             message: 'Login Successful, Please Verify The OTP Sent In Your Email',
// //             response_code: RESPONSE_CODES.OTP_SENT,
// //             data: {
// //                 session_id: encrypted_session_id,
// //                 user_id: encrypted_user_id,
// //                 role_id: user.role,
// //                 email: user.email,
// //                 phone_number: user.phone_number,
// //             }
// //         });

// //     }
// //     catch (exception) {
// //         logger.error("Login With Email Error", exception);
// //         return res.status(500).json({
// //             success: false,
// //             message: 'Something went wrong , Please Try Again Later ..!',
// //             response_code: RESPONSE_CODES.SERVER_ERROR,
// //             error: exception.message,
// //         })
// //     }
// // };

// // export const LoginWithMobile = async (req, res) => {
// //     try {
// //         const { phone_number, password, country_id, device_id, device_name, fcm_token } = req.body;

// //         // const decrypted_country_id = decryptId(country_id);

// //         const user = await User.findOne({
// //             where: {
// //                 phone_number,
// //                 country_id: country_id
// //             }
// //         });

// //         if (!user) {
// //             logger.info("Login Attempt with Unknown Number", phone_number);
// //             return res.status(400).json({
// //                 success: false,
// //                 response_code: RESPONSE_CODES.LOGIN_FAILED,
// //                 message: 'No Account Found With This Phone Number',
// //                 error: 'Invalid Phone Number',
// //             });
// //         }

// //         const passwordMatch = await bcrypt.compare(password, user.password);
// //         if (!passwordMatch) {
// //             user.failed_attempts += 1;
// //             await user.save();
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Invalid Credentials, Please Try Again",
// //                 response_code: RESPONSE_CODES.LOGIN_FAILED,
// //                 error: 'Invalid Credentials',
// //             });
// //         }

// //         if (
// //             user.is_locked == 1 &&
// //             user.locked_until &&
// //             new Date(user.locked_until) <= new Date()
// //         ) {
// //             user.is_locked = 0;
// //             user.failed_attempts = 0;
// //             user.locked_until = null;
// //             await user.save();

// //             logger.info("Account Unlocked !", user.id);
// //         }

// //         if (user.failed_attempts >= 5) {
// //             user.is_locked = 1;
// //             user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
// //             await user.save();

// //             return res.status(403).json({
// //                 success: false,
// //                 message: "Account Locked due to multiple failed attempts",
// //                 response_code: RESPONSE_CODES.ACCOUNT_LOCKED,
// //                 data: {},
// //                 error: "Account Locked",
// //             });
// //         }


// //         user.failed_attempts = 0;
// //         user.is_locked = false;
// //         user.locked_until = null;
// //         await user.save();

// //         let is_ip_verified = false;
// //         let is_device_verified = false;
// //         let otp = Math.floor(100000 + Math.random() * 900000);
// //         let otp_expiry = new Date(Date.now() + 10 * 60 * 1000);

// //         const session = await Session.create({
// //             user_id: user.id,
// //             is_ip_verified: is_ip_verified,
// //             is_device_verified: is_device_verified,
// //             otp: otp,
// //             ip: req.ip,
// //             device_id: device_id,
// //             device_name: device_name,
// //             otp_expiry: otp_expiry,
// //         });

// //         await publish(Topics.USER_EVENTS, [
// //             {
// //                 key: Keys.USER_MOBILE_OTP,
// //                 value: JSON.stringify({
// //                     phone_number: user.phone_number,
// //                     otp: otp
// //                 }),
// //             }
// //         ]);

// //         await publish(Topics.USER_EVENTS, [
// //             {
// //                 key: Keys.USER_FCM_REGISTER,
// //                 value: JSON.stringify({
// //                     fcm_token: fcm_token,
// //                     user_id: user.id
// //                 }),
// //             }
// //         ]);

// //         const encrypted_user_id = encryptId(user.id);
// //         const encrypted_session_id = encryptId(session.id);

// //         return res.status(201).json({
// //             success: true,
// //             message: 'Login Successful, Please Verify The OTP Sent In Your Mobile',
// //             response_code: RESPONSE_CODES.OTP_SENT,
// //             data: {
// //                 session_id: encrypted_session_id,
// //                 user_id: encrypted_user_id,
// //                 email: user.email,
// //                 role_id: user.role,
// //                 phone_number: user.phone_number,
// //             }
// //         });
// //     }
// //     catch (exception) {
// //         logger.error("Login With Mobile Error", exception);
// //         return res.status(500).json({
// //             success: false,
// //             message: 'Something went wrong , Please Try Again Later ..!',
// //             response_code: RESPONSE_CODES.SERVER_ERROR,
// //             error: exception.message,
// //         })
// //     }
// // };

// // export const Logout = async (req, res) => {
// //     try {
// //         const { session_id } = req.body;
// //         const decrypted_session_id = decryptId(session_id);

// //         const session = await Session.findOne({
// //             where: { id: decrypted_session_id }
// //         });

// //         if (!session) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Invalid session, Please Login Again",
// //                 response_code: RESPONSE_CODES.INVALID_SESSION,
// //                 data: {},
// //             });
// //         }

// //         session.revoked = true;
// //         await session.save();

// //         await RefreshToken.update(
// //             { revoked: true },
// //             { where: { session_id: decrypted_session_id } }
// //         );

// //         res.clearCookie(REFRESH_COOKIE_NAME);

// //         return res.status(200).json({
// //             success: true,
// //             message: "Logged out successfully",
// //             response_code: RESPONSE_CODES.OPERATION_SUCCESS,
// //         });
// //     }
// //     catch (exception) {
// //         logger.error("Logout Error", exception);
// //         return res.status(500).json({
// //             success: false,
// //             message: "Something went wrong , Please Try again !",
// //             response_code: RESPONSE_CODES.SERVER_ERROR,
// //             error: exception.message,
// //         });

// //     }
// // };
