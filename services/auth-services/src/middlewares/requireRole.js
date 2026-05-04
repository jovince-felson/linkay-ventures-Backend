export const requireRole = (...roles) => {
  return (req, res, next) => {
    const role = req.headers['x-user-role'];

    if (!role || !roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions',
      });
    }

    // Attach to req.user for convenience in controllers
    req.user = {
      userId:        req.headers['x-user-id'],
      email:         req.headers['x-user-email'],
      role,
      walletAddress: req.headers['x-wallet-address'],
    };

    next();
  };
};