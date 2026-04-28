import AWS from "aws-sdk";
import { v4 as uuid } from "uuid";

AWS.config.update({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION,
});

const s3 = new AWS.S3();

export const s3Storage = {
    save: async (file, folder = "") => {
        const safeFolder = folder
            ? folder.replace(/\/$/, "").replace(/\.\./g, "")
            : "";

        const extension = file.originalname.split(".").pop();
        const fileName = `${uuid()}.${extension}`;

        const fileKey = safeFolder
            ? `${safeFolder}/${fileName}`
            : fileName;

        const params = {
            Bucket: process.env.S3_BUCKET,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        await s3.upload(params).promise();

        return {
            file_path: `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${fileKey}`,
            file_key: fileKey,
            file_original_name: file.originalname,
            file_extension: extension,
            file_name: fileName,
            file_size: file.size,
            mime_type: file.mimetype
        };
    },

    delete: async (file_key) => {
        await s3.deleteObject({
            Bucket: process.env.S3_BUCKET,
            Key: file_key
        }).promise();
    }
};
