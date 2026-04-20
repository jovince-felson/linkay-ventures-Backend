import { z } from "zod";

export const PersonalInfoValidator = z.object({
    body: z.object({
        name: z
            .string()
            .min(3, "Name should be at least 3 characters long")
            .max(50, "Name cannot exceed 50 characters")
            .regex(/^[a-zA-Z\s'.-]+$/, "Name contains invalid characters"),

        gender: z
            .enum(["MALE", "FEMALE", "OTHER"], {
                required_error: "Gender is required",
                invalid_type_error: "Gender must be one of MALE, FEMALE, OTHER",
            }),

        nationality: z
            .string()
            .min(2, "Nationality is required"),

        country_of_residence: z
            .string()
            .min(2, "Country of residence is required"),

        dob: z
            .string()
            .refine(
                (val) => !isNaN(Date.parse(val)),
                "DOB must be a valid date in ISO format"
            )
            .transform((val) => new Date(val))
            .refine(
                (date) => {
                    const today = new Date();
                    const minAge = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
                    return date <= minAge;
                },
                "User must be at least 18 years old"
            ),

        device_id: z
            .string()
            .min(1, "Device ID is required")
            .max(255, "Device ID cannot exceed 255 characters"),

        device_name: z
            .string()
            .min(1, "Device name is required")
            .max(255, "Device name cannot exceed 255 characters"),

        user_id: z
            .string()
            .min(1, "User ID is required"),
    }),
});
