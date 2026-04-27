import fs from "fs";
import path from "path";
import {logger} from "linkay-shared-utils";

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
                message: "Log file not found"
            });
        }

        const content = fs.readFileSync(filePath, "utf8");

        return res.json({
            success: true,
            service: process.env.SERVICE_NAME,
            file: fileName,
            logs: content.split("\n").filter(Boolean)
        });

    } catch (error) {

        logger.error("API Gateway Log Fetch Error",error);
        return res.status(500).json({
            success: false,
            data:{},
            error: error.message,
            message: 'Server Error',
        });
    }
};
