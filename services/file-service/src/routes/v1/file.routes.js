import express from "express";
import * as FileController from "../../controllers/upload.controller.js";
import { uploadValidator } from "../../validators/file.validator.js";
import { UploadFileSchema } from "../../validators/file.schema.js";
import { upload } from "../../middlewares/multer.js";

const router = express.Router();

router.post("/upload-file",upload.single("file"),
    uploadValidator(UploadFileSchema, {
        required: true,
        maxSize: 5 * 1024 * 1024,
        extensions: ["jpg", "jpeg", "png", "pdf","svg"],
        mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    }),
    FileController.FileUpload);

router.get("/delete/:file_id", FileController.DeleteFile);

router.post("/get-file",FileController.GetFile);
router.post("/get-bulk-files",FileController.GetFilesBulk);

export default router;
