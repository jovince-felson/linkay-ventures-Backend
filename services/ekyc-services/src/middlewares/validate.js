import { ZodError } from "zod";

export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const formatted = error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            }));

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: formatted,
                response_code: "VALIDATION_ERROR"
            });
        }

        next(error);
    }
};
