export const SERVICESV1 = {
  AUTH_SERVICE_URL:              process.env.AUTH_SERVICE_URL              || "http://auth-service:3001",
  NOTIFICATION_SERVICE_URL:      process.env.NOTIFICATION_SERVICE_URL      || "http://notification-service:4002",
  EKYC_SERVICE_URL:              process.env.EKYC_SERVICE_URL              || "http://ekyc-service:4004",
  ASSET_MANAGEMENT_SERVICE_URL:  process.env.ASSET_MANAGEMENT_SERVICE_URL  || "http://asset-management-service:4006",
  FILE_UPLOAD_SERVICE_URL:       process.env.FILE_UPLOAD_SERVICE_URL       || "http://file-service:4007",
};
