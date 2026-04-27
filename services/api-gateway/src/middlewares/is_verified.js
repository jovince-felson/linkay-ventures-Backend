import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { logger } from "linkay-shared-utils";
dotenv.config();

export const isVerified = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ message: "Missing token" });
    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Invalid token" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.verified) {
            next();
        }
        else {
            return res.status(403).json({ message: "User not verified" });
        }
    } catch (err) {
        logger.error("API Gateway Verification Middleware Error", err);
        res.status(403).json({ message: "Token invalid or expired" });
    }
};  