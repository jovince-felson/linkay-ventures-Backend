import FileDetails from "../models/file_details.model.js";
import { logger, RESPONSE_CODES, EKYC_STEPS, publish, Topics, Keys, decryptId, encryptId } from 'rhoam-shared-utils';
import { s3Storage } from "../utils/S3.js";
import {Op} from "sequelize";
import AWS from "aws-sdk";

const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION,
});

export const DeleteFile = async (req, res) => {
    try {

        const { file_id } = req.params;

        const decrypted_file_id = decryptId(file_id);

        const findFile = await FileDetails.findOne({
            where: {
                id: decrypted_file_id,
            }
        });

        if (!findFile) {
            return res.status(400).json({
                success: false,
                message: 'No File Found',
                response_code: RESPONSE_CODES.OPERATION_FAILED,
                error: 'File Not Found',
            });
        }

        findFile.status = 0;
        findFile.trash = "YES";
        await findFile.save();

        await publish(Topics.EKYC_EVENTS, [
            {
                key: Keys.EKYC_DOCUMENT_DELETED,
                value: JSON.stringify({
                    user_id: findFile.user_id,
                    file_id: findFile.id,
                }),
            },
        ])

        return res.status(200).json({
            success: true,
            message: 'File Deleted Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: {}
        });

    }
    catch (exception) {
        logger.error("Delete File Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong, Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            error: exception.message,
        });
    }
};

export const FileUpload = async (req, res) => {
    try {

        const { context, context_id, user_id } = req.body;
        const file = req.file;

        console.log("FILE RECEIVED IN FILE SERVICE:", req.file);

        if (!file) {
            return res.status(400).json({
                success: false,
                response_code: RESPONSE_CODES.MISSING_FIELDS,
                message: 'Please Provide A File',
                error: 'Please Upload A File',
            });
        }

        const decrypted_context_id = decryptId(context_id);
        const decrypted_user_id = decryptId(user_id);

        const file_path = `${context}/${decrypted_user_id}/`;


        const saved = await s3Storage.save(file, file_path);

        const previous_doc = await FileDetails.findOne({
            where: {
                user_id: decrypted_user_id,
                context_type: context,
                context_id: decrypted_context_id,
                status: 1,
                trash: "NO"
            }
        });

        if (previous_doc) {
            previous_doc.status = 0;
            previous_doc.trash = "YES";
            await previous_doc.save();
        }

        const store_details = await FileDetails.create({
            user_id: decrypted_user_id,
            file_path: saved.file_path,
            file_key: saved.file_key,
            context_type: context,
            context_id: decrypted_context_id,
            file_original_name: file.originalname,
            file_extension: file.originalname.split(".").pop(),
            file_name: saved.file_name,
            file_size: file.size,
            mime_type: file.mimetype,
            created_by: decrypted_user_id,
            created_at: new Date(),
        });

        return res.status(200).json({
            success: true,
            message: 'File Uploaded Successfully',
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
        });

    }
    catch (exception) {
        logger.error("File Upload Error", exception);
        return res.status(500).json({
            success: false,
            response_code: RESPONSE_CODES.SERVER_ERROR,
            message: 'Something went wrong , Please Try Again !',
            error: exception.message,
        });
    }
};

export const GetFile = async (req, res) => {
    try {

        const { context, context_id, user_id } = req.body;

        if (!context || !context_id || !user_id) {

            console.log("Missing Fields in GetFile Request: ", { context, context_id, user_id });
            return res.status(400).json({
                success: false,
                message: "context, context_id, user_id required",
            });
        }

        const decrypted_user_id = decryptId(user_id);
        const decrypted_context_id = decryptId(context_id);

        const findFile = await FileDetails.findOne({
            where: {
                status: 1,
                trash: "NO",
                context_type: context,
                user_id: decrypted_user_id,
                context_id: decrypted_context_id,
            }
        });

        if (!findFile) {
            return res.status(404).json({
                success: false,
                message: 'File not exists in the system',
                response_code: RESPONSE_CODES.NOT_FOUND,
            });
        }

        const signedUrl = s3.getSignedUrl("getObject", {
            Bucket: process.env.S3_BUCKET,
            Key: findFile.file_key,
            Expires: 3000
        });

        return res.status(200).json({
            success: true,
            message: "File fetched successfully",
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            data: {
                file_url: signedUrl,
                file_name: findFile.file_original_name,
                file_size: findFile.file_size,
                file_type: findFile.file_extension
            }
        });

    }
    catch (exception) {
        logger.error("Get File Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later',
            response_code: RESPONSE_CODES.SERVER_ERROR,
            data: {

            }
        });
    }
};

export const GetFilesBulk = async (req, res) => {
    try {
        const { context, context_ids, user_ids } = req.body;

        if (
            !context ||
            !Array.isArray(context_ids) ||
            !Array.isArray(user_ids) ||
            !context_ids.length ||
            !user_ids.length
        ) {
            return res.status(400).json({
                success: false,
                message: "context, context_ids and user_ids are required",
            });
        }

        if (context_ids.length !== user_ids.length) {
            return res.status(400).json({
                success: false,
                message: "context_ids and user_ids length mismatch",
            });
        }

        const decryptedContextIds = context_ids.map(id => Number(decryptId(id)));
        const decryptedUserIds = user_ids.map(id => Number(decryptId(id)));


        const files = await FileDetails.findAll({
            where: {
                status: 1,
                trash: "NO",
                context_type: context,
                context_id: { [Op.in]: decryptedContextIds },
                user_id: { [Op.in]: decryptedUserIds },
            }
        });

        if (!files.length) {
            return res.status(200).json({
                success: true,
                message: "No files found",
                data: []
            });
        }


        const responseData = files.map(file => {
            const signedUrl = s3.getSignedUrl("getObject", {
                Bucket: process.env.S3_BUCKET,
                Key: file.file_key,
                Expires: 3000
            });

            return {
                context_id: encryptId(file.context_id),
                user_id: encryptId(file.user_id),
                file_url: signedUrl,
                file_name: file.file_original_name,
                file_size: file.file_size,
                file_type: file.file_extension
            };
        });

        return res.status(200).json({
            success: true,
            message: "Files fetched successfully",
            data: responseData
        });
    }
    catch (exception) {
        logger.error("Get Files Bulk Error", exception);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong , Please try again later',
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};

