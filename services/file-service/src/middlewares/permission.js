export const requirePermission = (menuKey, action) => {
    return (req, res, next) => {
        try {
            const permissionsHeader = req.headers["x-permissions"];

            if (!permissionsHeader) {
                return res.status(403).json({
                    success: false,
                    message: "Permissions not found",
                });
            }

            const permissions = JSON.parse(permissionsHeader);

            if (!permissions[menuKey]) {
                return res.status(403).json({
                    success: false,
                    message: `No access to ${menuKey}`,
                });
            }

            if (!permissions[menuKey][action]) {
                return res.status(403).json({
                    success: false,
                    message: `Permission denied for ${action} on ${menuKey}`,
                });
            }

            next();
        } catch (err) {
            logger.error("Permission Middleware Error:", err);
            return res.status(500).json({
                success: false,
                message: "Permission validation failed",
            });
        }
    };
};