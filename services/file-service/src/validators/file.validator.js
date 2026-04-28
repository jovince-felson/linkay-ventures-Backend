import { RESPONSE_CODES } from "rhoam-shared-utils";
import { ZodError } from "zod";

export const uploadValidator = (schema, fileRules = null) => {
    return (req, res, next) => {
        try {
            schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            if (fileRules) {
                const file = req.file;

                if (fileRules.required && !file) {
                    return res.status(400).json({
                        success: false,
                        message: "File is required",
                        response_code: RESPONSE_CODES.VALIDATION_ERROR,
                    });
                }

                if (file) {
                    if (fileRules.maxSize && file.size > fileRules.maxSize) {
                        return res.status(400).json({
                            success: false,
                            message: "File size exceeded",
                            response_code: RESPONSE_CODES.VALIDATION_ERROR,
                        });
                    }

                    if (
                        fileRules.mimeTypes &&
                        !fileRules.mimeTypes.includes(file.mimetype)
                    ) {
                        return res.status(400).json({
                            success: false,
                            message: "Invalid file type",
                            response_code: RESPONSE_CODES.VALIDATION_ERROR,
                        });
                    }

                    if (fileRules.extensions) {
                        const ext = file.originalname.split(".").pop().toLowerCase();
                        if (!fileRules.extensions.includes(ext)) {
                            return res.status(400).json({
                                success: false,
                                message: "Invalid file extension",
                                response_code: RESPONSE_CODES.VALIDATION_ERROR,
                            });
                        }
                    }
                }
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: error.issues,
                    response_code: RESPONSE_CODES.VALIDATION_ERROR,
                });
            }

            next(error);
        }
    };
};
