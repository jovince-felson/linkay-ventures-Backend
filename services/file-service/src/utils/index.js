import { localStorage } from "./local.js";
import { s3Storage } from "./S3.js";

export const FileStorage = () => {
  return process.env.USE_S3 === "true" ? s3Storage : localStorage;
};
