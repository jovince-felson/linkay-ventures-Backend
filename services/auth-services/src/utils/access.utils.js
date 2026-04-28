import Roles from "../models/roles.model.js";
import RolePermission from "../models/role_permissions.model.js";
import { logger } from 'rhoam-shared-utils';

export const GetRoleName = async (role_id) => {
    try {
        const role = await Roles.findOne({
            where: {
                id: Number(role_id),
                status: 1,
                trash: "NO"
            }
        });

        if (!role) {
            return false;
        }

        const details = {
            role_name: role.role_name,
            data_scope : role.data_scope,
        }

        return details;
    }
    catch (exception) {
        logger.error("Get Role Name Error", exception);
        return null;
    }
};

export const GetPermission = async (role_id) => {
    try {
        if (!role_id) return null;

        const rows = await RolePermission.findAll({
            where: {
                role_id,
                status: 1,
                trash: "NO",
            },
            attributes: ["menu_key", "permissions"],
            raw: true,
        });

        if (!rows || rows.length === 0) return {};

        const permissionMap = {};

        for (const row of rows) {
            try {
                permissionMap[row.menu_key] =
                    typeof row.permissions === "string"
                        ? JSON.parse(row.permissions)
                        : row.permissions;
            } catch (err) {
                logger.warn(`Invalid permission JSON for ${row.menu_key}`);
            }
        }

        return permissionMap;
    } catch (exception) {
        logger.error("Get Permission Error", exception);
        return null;
    }
};  
