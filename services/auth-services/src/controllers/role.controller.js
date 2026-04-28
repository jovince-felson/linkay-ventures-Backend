import Roles from "../models/roles.model.js";
import axios from 'axios';
import { logger, RESPONSE_CODES, encryptId, decryptId, publish, Topics, Keys } from 'rhoam-shared-utils';
import dotenv from 'dotenv';
import { Op } from "sequelize";
import { SERVICE_TYPE, MODULES, ACTION } from "../config/constant.js";

dotenv.config();

export const Index = async (req, res) => {
    try {
        let { draw, start, length, search, order } = req.body;

        start = parseInt(start) || 0;
        length = parseInt(length) || 10;
        const searchValue = search?.value || "";

        const orderColumn = order?.[0]?.column || 0;
        const orderDir = order?.[0]?.dir || "asc";

        const columns = [
            "id",
            "role_name",
            "data_scope",
            "status",
            "trash",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at"
        ];

        const sortColumn = columns[orderColumn] || "id";

        const whereCondition = searchValue
            ? {
                [Op.or]: [
                    { role_name: { [Op.like]: `%${searchValue}%` } },
                ],
            }
            : {};


        const totalRecords = await Roles.count({ where: { trash: "NO" } });

        const { rows: users, count: filteredRecords } =
            await Roles.findAndCountAll({
                where: {
                    ...whereCondition,
                    trash: "NO",
                },
                offset: start,
                limit: length,
                order: [[sortColumn, orderDir]],
            });

        const fetchName = async (endpoint, id) => {
            try {
                const response = await axios.post(
                    `${process.env.USER_SERVICE_URL}/get-name`,
                    { id }
                );

                return response.data?.data?.name || null;
            } catch (err) {
                logger.error(`Error fetching ${endpoint}:`, err);
                return null;
            }
        };

        const finalData = await Promise.all(
            users.map(async (u) => {
                const created_by = await fetchName(encryptId(u.created_by));
                const updated_by = await fetchName(encryptId(u.updated_by));

                return {
                    id: encryptId(u.id),
                    role_name: u.role_name,
                    data_scope: u.data_scope,
                    status: u.status == 1 ? 'Active' : 'InActive',
                    trash: u.trash,
                    created_by: created_by || "No Name",
                    updated_by: updated_by || "No Name",
                    created_at: u.created_at,
                    updated_at: u.updated_at,
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: 'Roles list Fetched Successfully',
            draw: draw,
            recordsTotal: totalRecords,
            recordsFiltered: filteredRecords,
            data: finalData,
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });

    }

    catch (exception) {
        logger.error("Roles Index Error", exception);
        return res.status(500).json({
            success: true,
            message: "Something went wrong , Please try again later !",
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};


export const Add = async (req, res) => {
    try {
        const { role_name, user_id, data_scope } = req.body;

        const decrypted_user_id = decryptId(user_id);

        const store_role = await Roles.create({
            role_name: role_name,
            data_scope: data_scope,
            created_by: decrypted_user_id,
            created_at: Date.now(),
        });
        await publish(Topics.LOG_EVENTS, [{
            key: Keys.AUDIT_EVENTS,
            value: JSON.stringify({
                user_id: user_id,
                service_type: SERVICE_TYPE.AUTH,
                modules: MODULES.ROLES,
                action: ACTION.CREATED,
                created_at: Date.now(),
            })
        }])
        return res.status(201).json({
            success: true,
            message: 'Role Added Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });
    }
    catch (exception) {
        logger.error("Roles Add Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later !',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const Update = async (req, res) => {
    try {
        const { role_name, user_id, role_id, data_scope } = req.body;

        const decrypted_user_id = decryptId(user_id);
        const decrypted_role_id = decryptId(role_id);


        const find_role = await Roles.findOne({
            where: {
                id: decrypted_role_id
            }
        });

        if (!find_role) {
            return res.status(400).json({
                success: false,
                message: 'Role Not Found',
                response_code: RESPONSE_CODES.NOT_FOUND,
            });
        }


        find_role.role_name = role_name;
        find_role.data_scope = data_scope;
        find_role.updated_by = decrypted_user_id;
        find_role.updated_at = Date.now();

        await find_role.save();

        await publish(Topics.LOG_EVENTS, [{
            key: Keys.AUDIT_EVENTS,
            value: JSON.stringify({
                user_id: user_id,
                service_type: SERVICE_TYPE.AUTH,
                modules: MODULES.ROLES,
                action: ACTION.UPDATED,
                created_at: Date.now(),
            })
        }])

        return res.status(201).json({
            success: true,
            message: 'Role Updated Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });
    }
    catch (exception) {
        logger.error("Roles Update Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later !',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const StatusChange = async (req, res) => {
    try {
        const { role_id } = req.body;

        const decrypted_role_id = decryptId(role_id);


        const find_role = await Roles.findOne({
            where: {
                id: decrypted_role_id
            }
        });

        if (!find_role) {
            return res.status(400).json({
                success: false,
                message: 'Role Not Found',
                response_code: RESPONSE_CODES.NOT_FOUND,
            });
        }

        if (find_role.status == 1) {
            find_role.status = 0;
            await find_role.save();
        }
        else {
            find_role.status = 1;
            await find_role.save();
        }

        await publish(Topics.LOG_EVENTS, [{
            key: Keys.AUDIT_EVENTS,
            value: JSON.stringify({
                user_id: user_id,
                service_type: SERVICE_TYPE.AUTH,
                modules: MODULES.ROLES,
                action: ACTION.STATUSCHANGE,
                created_at: Date.now(),
            })
        }])

        return res.status(201).json({
            success: true,
            message: 'Role Updated Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });

    }
    catch (exception) {
        logger.error("Roles Status Change Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later !',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const Delete = async (req, res) => {
    try {
        const { role_id } = req.body;

        const decrypted_role_id = decryptId(role_id);


        const find_role = await Roles.findOne({
            where: {
                id: decrypted_role_id
            }
        });

        if (!find_role) {
            return res.status(400).json({
                success: false,
                message: 'Role Not Found',
                response_code: RESPONSE_CODES.NOT_FOUND,
            });
        }

        find_role.trash = "YES";
        await find_role.save();

        await publish(Topics.LOG_EVENTS, [{
            key: Keys.AUDIT_EVENTS,
            value: JSON.stringify({
                user_id: user_id,
                service_type: SERVICE_TYPE.AUTH,
                modules: MODULES.ROLES,
                action: ACTION.DELETED,
                created_at: Date.now(),
            })
        }])

        return res.status(201).json({
            success: true,
            message: 'Role Deleted Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });

    }
    catch (exception) {
        logger.error("Roles Delete Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later !',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const UniqueCheck = async (req, res) => {
    try {
        const { role_id, role_name } = req.body;

        if (!role_name) {
            return res.status(400).json({
                success: false,
                message: "Role name is required",
                response_code: RESPONSE_CODES.VALIDATION_ERROR,
            });
        }

        const where = {
            role_name: role_name,
            trash: "NO",
        };

        if (role_id) {
            where.id = { [Op.ne]: decryptId(role_id) };
        }

        const exists = await Roles.findOne({ where });

        if (exists) {
            return res.status(400).json({
                success: false,
                message: "Role already exists",
                response_code: RESPONSE_CODES.VALIDATION_ERROR,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Role is unique",
        });

    } catch (exception) {
        logger.error("Role Unique Check Error", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, please try again later",
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const RoleList = async (req, res) => {

    try {

        const data = await Roles.findAll({
            where: {
                status: 1,
                trash: "NO"
            }
        });

        const finalData = Object.values(data).map(d => ({
            "id": encryptId(d.id),
            "name": d.role_name,
        }));


        return res.status(200).json({
            success: true,
            message: 'Roles Fetched Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: {
                finalData
            }
        });
    }
    catch (exception) {
        logger.error("Role List Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }

};


