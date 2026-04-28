import crypto from "crypto";
import dotenv from "dotenv";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import RefreshToken from "../models/refresh_token.model.js";
import BiometricCredential from "../models/biometric.model.js";
import { logger, RESPONSE_CODES, encryptId, decryptId } from "rhoam-shared-utils";
import {
    cookieOptions,
    hashRefresh,
    genRefreshPlain,
    signAccess,

} from '../utils/auth.utils.js';
import {
    createChallenge,
    getChallenge,
    deleteChallenge,
} from '../utils/biometric.utils.js';
import { base64ToPemPublicKey } from "../utils/cryptoKey.js";

import { GetRoleName, GetPermission } from "../utils/access.utils.js";


dotenv.config();

const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP || "15m";
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refresh_token";

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

        if (findUser.biometric_enabling == 0) {
            findUser.biometric_enabling = 1;
            await findUser.save();
        }

        if (findUser.biometric_enabling == 1) {
            findUser.biometric_enabling = 0;
            await findUser.save();
        }

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
