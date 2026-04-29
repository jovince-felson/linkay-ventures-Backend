import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";
import { logger, RESPONSE_CODES } from "linkay-shared-utils";

dotenv.config();

export const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization header missing"
            });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid token format"
            });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token missing"
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.verified) {
            return res.status(403).json({
                success: false,
                message: "OTP verification required",
                error: "SESSION_NOT_VERIFIED"
            });
        }

        req.headers["x-user-id"] = decoded.user_id?.toString();
        req.headers["x-session-id"] = decoded.session_id?.toString();
        req.headers["x-role-id"] = decoded.role_id?.toString();
        req.headers["x-role-name"] = decoded.role_name;
        req.headers["x-admin"] = decoded.admin ? "true" : "false";
        req.headers["x-verified"] = decoded.verified ? "true" : "false";
        req.headers["x-ekyc-passed"] = decoded.ekyc_passed ? "true" : "false";
        req.headers["x-role-scope"] = decoded.role_scope;

        if (decoded.permissions) {
            req.headers["x-permissions"] = JSON.stringify(decoded.permissions);
        }


        req.user = {
            user_id: decoded.user_id,
            session_id: decoded.session_id,
            verified: decoded.verified,
            decoded
        };

        next();
    } catch (err) {
        logger.error("API Gateway Auth Error:", err);
        return res.status(403).json({
            success: false,
            message: "Token invalid or expired"
        });
    }
};

export const ValidateSession = async (req, res, next) => {
    try {
        const { session_id, user_id } = req.user;

        const response = await axios.post(
            `${process.env.INTERNAL_AUTH_URL}/session-validation`,
            {
                session_id,
                user_id
            },
            {
                headers: {
                    "x-real-ip": req.ip,
                    "x-forwarded-for": req.headers["x-forwarded-for"] || "",
                    "user-agent": req.headers["user-agent"],
                    "device-id": req.headers["device-id"] || "",
                    "device-name": req.headers["device-name"] || "",
                }
            }
        );

        if (!response.data.valid) {
            return res.status(401).json({
                success: false,
                message: "Session Invalid, Please Try Again",
                response_code: RESPONSE_CODES.INVALID_SESSION,
                error: response.data.reason
            });
        }

        req.user.details = response.data.user;
        req.user.session = response.data.session;

        next();

    } catch (exception) {
        logger.error("Session Validation Middleware Error", exception);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: exception.message
        });
    }
};  
