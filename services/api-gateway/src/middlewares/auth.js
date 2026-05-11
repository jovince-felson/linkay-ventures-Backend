import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { logger } from "linkay-shared-utils";

dotenv.config();

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token missing" });
    }

    // JWT payload from auth service: { userId, email, role, walletAddress }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Forward user claims to downstream services via headers
    req.headers["x-user-id"] = decoded.userId?.toString();
    req.headers["x-user-email"] = decoded.email;
    req.headers["x-user-role"] = decoded.role;
    req.headers["x-wallet-address"] = decoded.walletAddress || "";
    req.headers["x-user-first-name"] = decoded.firstName || "";
    req.headers["x-user-last-name"] = decoded.lastName || "";


    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      walletAddress: decoded.walletAddress,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
    };

    next();
  } catch (err) {
    logger.error("API Gateway Auth Error:", err.message);
    return res.status(401).json({
      success: false,
      message: "Token invalid or expired",
    });
  }
};
