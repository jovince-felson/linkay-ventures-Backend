import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { RESPONSE_CODES, logger } from "linkay-shared-utils";
dotenv.config();

// Supported admin roles for tokenization operations
const ALLOWED_ROLES = ["MUSEUM_ADMIN", "SUPER_ADMIN", "COMPLIANCE_OFFICER"];

export const VerifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                code: RESPONSE_CODES.LOGIN_REQUIRED,
                message: "Authorization token missing",
            });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        next();
    } catch (err) {
        logger.error("Token verification failed:", err.message);
        return res.status(401).json({
            success: false,
            code: RESPONSE_CODES.INVALID_TOKEN,
            message: "Invalid or expired token",
        });
    }
};

// Only Museum Admin and Super Admin can initiate tokenization
export const VerifyAdminRole = (req, res, next) => {
    try {
        const role = req.user?.role;

        if (!ALLOWED_ROLES.includes(role)) {
            return res.status(403).json({
                success: false,
                code: RESPONSE_CODES.FORBIDDEN,
                message: "Access denied: Insufficient role permissions",
            });
        }

        next();
    } catch (err) {
        logger.error("Role verification failed:", err.message);
        return res.status(403).json({
            success: false,
            code: RESPONSE_CODES.FORBIDDEN,
            message: "Access denied",
        });
    }
};

export const VerifyMuseumAdmin = (req, res, next) => {
    const role = req.user?.role;
    if (role !== "MUSEUM_ADMIN" && role !== "SUPER_ADMIN") {
        return res.status(403).json({
            success: false,
            code: RESPONSE_CODES.FORBIDDEN,
            message: "Access denied: Museum Admin or Super Admin required",
        });
    }
    next();
};

export const VerifySuperAdmin = (req, res, next) => {
    const role = req.user?.role;
    if (role !== "SUPER_ADMIN") {
        return res.status(403).json({
            success: false,
            code: RESPONSE_CODES.FORBIDDEN,
            message: "Access denied: Super Admin required",
        });
    }
    next();
};
