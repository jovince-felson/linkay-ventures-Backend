import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export const VerifyAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded?.admin) {
            return res.status(403).json({ message: "Access denied: Admins only" });
        }

        req.user = decoded;
        next();
        
    } catch (err) {
        console.error("Token verification failed:", err.message);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
