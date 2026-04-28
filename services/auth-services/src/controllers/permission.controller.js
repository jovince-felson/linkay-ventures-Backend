import Permissions from '../models/permissions.model.js';
import Roles from '../models/roles.model.js';
import RolePermission from '../models/role_permissions.model.js';
import { logger, RESPONSE_CODES, encryptId, decryptId } from 'rhoam-shared-utils';
import { SERVICE_TYPE, MODULES, ACTION } from "../config/constant.js";

const ALLOWED_PERMISSIONS = [
    "List",
    "Add",
    "Edit",
    "View",
    "Delete",
    "StatusChange",
    "Approve",
];

export const PermissionList = async (req, res) => {

    try {

        const data = await Permissions.findAll({
            where: {
                status: 1,
                trash: "NO"
            }
        });

        const finalData = Object.values(data).map(d => ({
            "id": encryptId(d.id),
            "key": d.key,
        }));


        return res.status(200).json({
            success: true,
            message: 'Permissions Fetched Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: finalData
        });
    }
    catch (exception) {
        logger.error("Permission List Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const AssignPermissions = async (req, res) => {
    try {
        const { role_id, menu_key, permissions, user_id } = req.body;

        if (!role_id || !menu_key || !permissions || !user_id) {
            return res.status(400).json({
                success: false,
                message: "role_id, menu_key and permissions, user_id are required",
                response_code: RESPONSE_CODES.INVALID_INPUT,
            });
        }

        const decrypted_role_id = decryptId(role_id);
        const decrypted_user_id = decryptId(user_id);

        const find_role = await Roles.findByPk(decrypted_role_id);

        if (!find_role) {
            return res.status(404).json({
                success: false,
                message: "Role not found",
                response_code: RESPONSE_CODES.INVALID_INPUT
            });
        }


        const validatedPermissions = {};

        for (const key of ALLOWED_PERMISSIONS) {
            validatedPermissions[key] = Boolean(permissions[key]);
        }

        const existing = await RolePermission.findOne({
            where: {
                role_id:decrypted_role_id,
                menu_key,
            }
        });

        if (existing) {
            await existing.update({
                permissions: validatedPermissions,
                updated_by: decrypted_user_id,
                updated_at: Date.now(),
            });

            return res.status(200).json({
                success: true,
                message: "Permissions updated successfully",
                response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            });
        }

        await RolePermission.create({
            role_id:decrypted_role_id,
            menu_key,
            permissions: validatedPermissions,
            status: 1,
            created_by: decrypted_user_id,
            created_at: Date.now()
        });

        await publish(Topics.AUDIT_LOGS, [{
            key: Topics.AUDIT_LOGS,
            value: JSON.stringify({
                user_id: decrypted_user_id,
                service_type: SERVICE_TYPE.AUTH,
                modules: MODULES.PERMISSIONS,
                action: ACTION.CREATED,
                created_at: Date.now(),
            })
        }])

        return res.status(201).json({
            success: true,
            message: "Permissions assigned successfully",
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });
    }
    catch (exception) {
        logger.error("Assign Permission Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , please try again later',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }

};

export const GetPermissions = async (req, res) => {
    try {

        const { role_id } = req.body;

        if (!role_id) {
            return res.status(400).json({
                success: false,
                message: "role_id is required",
                response_code: RESPONSE_CODES.INVALID_INPUT
            });
        }

        const decrypted_role_id = decryptId(role_id);

        const find_role = await Roles.findByPk(decrypted_role_id);

        if (!find_role) {
            return res.status(404).json({
                success: false,
                message: "Role not found",
                response_code: RESPONSE_CODES.INVALID_INPUT
            });
        }

        const find_permissions = await RolePermission.findAll({
            where: {
                role_id: find_role.id,
                status: 1,
                trash: "NO"
            }
        });

        const permissionsMap = {};

        find_permissions.forEach(item => {
            permissionsMap[item.menu_key] = item.permissions;
        });

        return res.status(200).json({
            success: true,
            message: "Permissions fetched successfully",
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: permissionsMap
        });

    } catch (exception) {
        logger.error("Get Permission Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong, please try again later',
            error: exception.message,
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

