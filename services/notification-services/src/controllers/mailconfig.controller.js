import MailConfigs from "../models/mailconfig.model.js";
import { logger, ACTIVE_STATUS, GetUserName, Displaydateformat, RESPONSE_CODES, encryptId, decryptId, Topics, publish, Keys } from "rhoam-shared-utils";
import { SERVICE_TYPE, MODULES, ACTION } from "../config/constant.js";

export const Index = async (req, res) => {
    try {

        const draw = parseInt(req.query.draw || 1);
        const start = parseInt(req.query.start || 0);
        const length = parseInt(req.query.length || 10);
        const searchValue = req.query.search?.value || "";
        const orderColumn = req.query.order?.[0]?.column || 0;
        const orderDir = req.query.order?.[0]?.dir || "asc";

        const columns = [
            "smtp_mailer",
            "smtp_host",
            "smtp_port",
            "smtp_user",
            "created_at",
            "updated_at"
        ];

        const orderBy = columns[orderColumn] || "created_at";

        const whereBase = { trash: "NO" };

        const whereCondition = searchValue
            ? {
                [Op.or]: [
                    { smtp_mailer: { [Op.like]: `%${searchValue}%` } },
                    { smtp_host: { [Op.like]: `%${searchValue}%` } },
                    { smtp_user: { [Op.like]: `%${searchValue}%` } },
                ]
            }
            : {};

        const recordsTotal = await MailConfigs.count({
            where: whereBase
        });

        const recordsFiltered = await MailConfigs.count({
            where: { ...whereBase, ...whereCondition }
        });

        const data = await MailConfigs.findAll({
            where: { ...whereBase, ...whereCondition },
            offset: start,
            limit: length,
            order: [[orderBy, orderDir]]
        });

        const finalData = data.map(mail => ({
            id: encryptId(mail.id),
            smtp_mailer: mail.smtp_mailer,
            smtp_encryption: mail.smtp_encryption,
            smtp_host: mail.smtp_host,
            smtp_user: mail.smtp_user,
            smtp_port: mail.smtp_port,
            is_active: ACTIVE_STATUS[mail.is_active] || "Unknown",
            created_at: Displaydateformat(mail.created_at),
            updated_at: Displaydateformat(mail.updated_at)
        }));

        return res.status(200).json({
            success: true,
            message: "Data Fetched Successfully",
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            draw,
            recordsTotal,
            recordsFiltered,
            data: finalData
        });

    } catch (exception) {
        logger.error("Mail Config List Error:", exception);
        return res.status(500).json({
            success: false,
            message: "Something went wrong, Please Try Again Later ..!",
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};

export const Store = async (req, res) => {
    try {

        const { smtp_host, smtp_password, smtp_user, smtp_port, smtp_mailer, smtp_encryption, user_id } = req.body;

        const decrypted_user_id = decryptId(user_id);

        const create_config = await MailConfigs.create({
            smtp_host,
            smtp_password,
            smtp_user,
            smtp_port,
            smtp_mailer,
            smtp_encryption,
            created_at: new Date(),
            created_by: decrypted_user_id,
        });

        await publish(Topics.LOG_EVENTS, [{
            key: Keys.AUDIT_EVENTS,
            value: JSON.stringify({
                user_id: user_id,
                service_type: SERVICE_TYPE.NOTIFICATION,
                modules: MODULES.NOTIFICATION,
                action: ACTION.CREATED,
                created_at: Date.now(),
            })
        }])

        return res.status(201).json({
            success: true,
            data: {},
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            message: 'Mail Config Added Successfully',
        })

    }
    catch (exception) {
        logger.error("Mail Config Store Error:", exception);
        return res.status(500).json({
            success: false,
            data: {},
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};

export const Update = async (req, res) => {
    try {

        const { user_id, smtp_host, smtp_password, smtp_user, smtp_port, smtp_mailer, smtp_encryption, mail_id } = req.body;

        const decrypted_mail_id = decryptId(mail_id);
        const decrypted_user_id = decryptId(user_id);

        const find_config = await MailConfigs.findOne({
            where: {
                id: decrypted_mail_id,
                trash: "NO"
            }
        });

        if (!find_config) {
            return res.status(400).json({
                success: false,
                message: 'No Mail Config Found',
                response_code: RESPONSE_CODES.OPERATION_FAILED,
            });
        }

        const create_config = await MailConfigs.update({
            smtp_host,
            smtp_password,
            smtp_user,
            smtp_port,
            smtp_mailer,
            smtp_encryption,
            updated_at: new Date(),
            updated_by: decrypted_user_id,
        }, { where: { id: decrypted_mail_id } });

        await publish(Topics.LOG_EVENTS, [{
            key: Keys.AUDIT_EVENTS,
            value: JSON.stringify({
                user_id: user_id,
                service_type: SERVICE_TYPE.NOTIFICATION,
                modules: MODULES.NOTIFICATION,
                action: ACTION.UPDATED,
                created_at: Date.now(),
            })
        }])

        return res.status(201).json({
            success: true,
            data: {},
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            message: 'Mail Config Update Successfully',
        })

    }
    catch (exception) {
        logger.error("Mail Config Update Error:", exception);
        return res.status(500).json({
            success: false,
            data: {},
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};

export const GetMail = async (req, res) => {
    try {

        const { mail_id } = req.body;

        const decrypted_mail_id = decryptId(mail_id);

        const getMail = await MailConfigs.findOne({
            where: { id: decrypted_mail_id }
        });

        if (!getMail) {
            return res.status(400).json({
                success: false,
                message: 'No Mail Config Found',
                response_code: RESPONSE_CODES.OPERATION_FAILED,
            });
        }

        const data = {
            smtp_host: getMail.smtp_host,
            smtp_encryption: getMail.smtp_encryption,
            smtp_password: getMail.smtp_password,
            smtp_user: getMail.smtp_user,
            id: encryptId(getMail.id),
            smtp_port: getMail.smtp_port,
        }

        return res.status(200).json({
            success: true,
            data: { data },
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            message: 'Mail Config Fetched Successfully',
        })

    }
    catch (exception) {
        logger.error("Get Mail Config:", exception);
        return res.status(500).json({
            success: false,
            data: {},
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};

export const StatusChange = async (req, res) => {
    try {
        const { status, mail_id } = req.body;

        const decrypted_mail_id = decryptId(mail_id);

        if (status == 1) {
            await MailConfigs.update(
                { is_active: 0 },
                { where: { id: { [Op.ne]: decrypted_mail_id } } }
            );
        }

        const update = await MailConfigs.update({
            is_active: status,
        }, {
            where: { id: decrypted_mail_id }
        });

        await publish(Topics.LOG_EVENTS, [{
            key: Keys.AUDIT_EVENTS,
            value: JSON.stringify({
                user_id: user_id,
                service_type: SERVICE_TYPE.NOTIFICATION,
                modules: MODULES.NOTIFICATION,
                action: ACTION.STATUSCHANGE,
                created_at: Date.now(),
            })
        }])

        return res.status(200).json({
            success: true,
            message: 'Mail Config Status Updated Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: {},
        });
    }
    catch (exception) {
        logger.error("Status Change Error Mail Config:", exception);
        return res.status(500).json({
            success: false,
            data: {},
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};

export const Delete = async (req, res) => {
    try {
        const { mail_id } = req.body;

        const decrypted_mail_id = decryptId(mail_id);

        const delete_config = await MailConfigs.update({
            trash: "YES",
        }, { where: { id: decrypted_mail_id } });

        await publish(Topics.LOG_EVENTS, [{
            key: Keys.AUDIT_EVENTS,
            value: JSON.stringify({
                user_id: user_id,
                service_type: SERVICE_TYPE.NOTIFICATION,
                modules: MODULES.NOTIFICATION,
                action: ACTION.DELETED,
                created_at: Date.now(),
            })
        }])

        return res.status(200).json({
            success: true,
            message: 'Mail Config Deleted Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: {}
        });

    }
    catch (exception) {
        logger.error("Delete Mail Config Error:", exception);
        return res.status(500).json({
            success: false,
            data: {},
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};

export const GetActiveMail = async (req, res) => {
    try {

        const ActiveMail = await MailConfigs.findOne({
            where: { is_active: 1 }
        });

        if (!ActiveMail) {
            return res.status(400).json({
                success: false,
                message: 'No Active Mail Found',
                response_code: RESPONSE_CODES.OPERATION_FAILED,
                data: {},
            })
        }

        const data = {
            smtp_host: ActiveMail.smtp_host,
            smtp_encryption: ActiveMail.smtp_encryption,
            smtp_password: ActiveMail.smtp_password,
            smtp_user: ActiveMail.smtp_user,
            id: encryptId(ActiveMail.id),
            smtp_port: ActiveMail.smtp_port,
        }

        return res.status(200).json({
            success: true,
            data: { data },
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            message: 'Active Mail Fetched Successfully',
        });

    }
    catch (exception) {
        logger.error("Active Mail Config Error:", exception);
        return res.status(500).json({
            success: false,
            data: {},
            message: 'Something went wrong , Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message
        });
    }
};