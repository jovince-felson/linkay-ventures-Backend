import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/users.model.js";
import Session from "../models/session.model.js";
import RefreshToken from "../models/refresh_token.model.js";
import PassKeys from "../models/passkeys.js";
import Biometric from '../models/biometric.model.js';
import { logger, RESPONSE_CODES, decryptId, encryptId } from "rhoam-shared-utils";
import {
    RandomEmail,
    RandomMobile
} from '../utils/auth.utils.js';

import { Op } from "sequelize";
dotenv.config();


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
            return res.status(400).json({
                success: false,
                message: 'Invalid Passkey',
                response_code: RESPONSE_CODES.INVALID_INPUT,
            });
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

export const GetUserList = async (req, res) => {
    try {

        const { role_id } = req.body;

        const users = await User.findOne({
            where: {
                status: 1,
                trash: "NO",
                role: decryptId(role_id)
            }
        });

        const fetchName = async (endpoint, id) => {
            try {
                const response = await axios.post(
                    `${process.env.USER_SERVICE_URL}/get-name`,
                    { id },
                );

                return response.data?.data?.name || null;
            } catch (err) {
                logger.error(`Error fetching ${endpoint}:`, err);
                return null;
            }
        };

        const refined_data = await Promise.all(
            users.map(async (u) => {
                const name = await fetchName(encryptId(u.id));
                return {
                    id: encryptId(u.id),
                    name: name
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: 'Users Fetched Successfully',
            data: {
                refined_data
            },
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });

    }
    catch (exception) {
        logger.error("Get User list API Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong , Please Try again later",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const CheckBioMetric = async (req, res) => {
    try {

        const { user_id, device_id, device_name } = req.body;
        const decrypted_user_id = decryptId(user_id);

        const find_biometric = await Biometric.findOne({
            where: {
                user_id: decrypted_user_id,
                status: 1,
                device_id: device_id,
                device_name: device_name,
            }
        });

        if (!find_biometric) {
            return res.status(404).json({
                success: false,
                message: "No Biometric Credential Found",
                response_code: RESPONSE_CODES.NOT_FOUND,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Biometric Credential Found",
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });
    }
    catch (exception) {
        logger.error("Check BioMetric API Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong , Please Try again later",
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

export const DeviceLists = async (req, res) => {
    try {

        const { user_id, session_id, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        //  Get Sessions
        const find_sessions = await Session.findAll({
            where: {
                user_id: Number(decrypted_user_id),
            }
        });

        if (!find_sessions.length) {
            return res.status(200).json({
                success: true,
                message: 'No devices found',
                response_code: RESPONSE_CODES.OPERATION_SUCCESS,
                data: {}
            });
        }

        const refined_data = find_sessions.map((s => {
            return {
                id: encryptId(s.id),
                ip: s.ip,
                ip_verification_status: s.ip_verification_status,
                user_agent: s.user_agent,
                device_id: s.device_id,
                device_name: s.device_name,
                logged_in_at: s.logged_in_at,
                logged_out_at: s.logged_out_at,
                session_status: s.revoked == false ? 'Active' : 'In-Active',
            }
        }));

        return res.status(200).json({
            success: true,
            message: 'Device Lists Fetched Successfully ',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: {
                refined_data,
            }

        });

    }
    catch (exception) {
        logger.error("Device Lists Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later !',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const SignOutFromAll = async (req, res) => {
    try {

        const { user_id, session_id, device_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);

        // Revoke The Sessions

        const revoke_session = await Session.update({
            revoked: true,
        }, {
            where: {
                user_id: Number(decrypted_user_id)
            }
        });

        // Revoke The Refresh Tokens
        const revoke_tokens = await RefreshToken.update({
            revoked: true,
        }, {
            where: {
                user_id: Number(decrypted_user_id)
            }
        });


        return res.status(200).json({
            success: true,
            message: 'Signed Out Of All Devices',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });

    }
    catch (exception) {
        logger.error("SignOut From All Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later !',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const SignoutParticular = async (req, res) => {
    try {
        const { user_id, session_id, device_id, session_revoke_id } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_session_id = decryptId(session_id);
        const decrypted_session_revoke_id = decryptId(session_revoke_id);

        // Revoke The Sessions

        const revoke_session = await Session.update({
            revoked: true,
        }, {
            where: {
                id: Number(decrypted_session_revoke_id)
            }
        });

        // Revoke The Refresh Tokens
        const revoke_tokens = await RefreshToken.update({
            revoked: true,
        }, {
            where: {
                session_id: Number(decrypted_session_revoke_id)
            }
        });


        return res.status(200).json({
            success: true,
            message: 'Signed Out Successfully From The Device',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });
    }
    catch (exception) {
        logger.error("Sign Out Particular Error ",exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please Try Again Later',
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};
