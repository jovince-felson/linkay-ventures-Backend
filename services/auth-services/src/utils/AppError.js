export class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const ErrorCodes = {
  AUTH_001: { code: 'AUTH_001', status: 409 },
  AUTH_002: { code: 'AUTH_002', status: 401 },
  AUTH_003: { code: 'AUTH_003', status: 410 },
  AUTH_004: { code: 'AUTH_004', status: 423 },
  AUTH_005: { code: 'AUTH_005', status: 409 },
  AUTH_006: { code: 'AUTH_006', status: 401 },
  AUTH_007: { code: 'AUTH_007', status: 403 },
};
