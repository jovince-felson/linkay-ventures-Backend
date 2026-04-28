export const verifyInternalRequest = (req, res, next) => {
  const internalKey = req.headers["x-internal-service"];

  if (!internalKey) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Internal access only"
    });
  }

  if (internalKey !== process.env.INTERNAL_SERVICE_KEY) {
    return res.status(403).json({
      success: false,
      message: "Invalid internal service identity"
    });
  }

  next();
};