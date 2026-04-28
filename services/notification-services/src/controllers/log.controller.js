import fs from "fs";
import path from "path";
import {logger, RESPONSE_CODES} from "rhoam-shared-utils";

export const GetLogs = async (req, res) => {
    try {
        const { type = "combined", date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "date is required (YYYY-MM-DD)"
            });
        }

        const logDir = path.join(process.cwd(), "logs");
        const fileName = `${type}-${date}.log`;
        const filePath = path.join(logDir, fileName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                response_code: RESPONSE_CODES.NOT_FOUND,
                message: "Log file not found",
                data:{},
            });
        }

        const content = fs.readFileSync(filePath, "utf8");

        return res.json({
            success: true,
            service: process.env.SERVICE_NAME,
            file: fileName,
            logs: content.split("\n").filter(Boolean),
            response_code: RESPONSE_CODES.OPERATION_SUCCESS,
            message: 'Notification Log Fetched Successfully !',
        });

    } catch (error) {

        logger.error("Notification Log Fetch Error",error);
        return res.status(500).json({
            success: false,
            data:{},
            error: error.message,
            message: 'Something went wrong, Please Try Again Later ..!',
            response_code: RESPONSE_CODES.SERVER_ERROR,
        });
    }
};
