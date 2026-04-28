import { z } from "zod";

export const RoleIndexValidator = z.object({
    body: z.object({
        draw: z.number().optional(),
        start: z.union([z.string(), z.number()]).optional(),
        length: z.union([z.string(), z.number()]).optional(),
        search: z.object({
            value: z.string().optional(),
        }).strict().optional(),
        order: z.array(
            z.object({
                column: z.number(),
                dir: z.enum(["asc", "desc"]),
            }).strict()
        ).optional(),
    }).strict(),
});


export const RoleAddValidator = z.object({
    body: z.object({
        role_name: z.string().trim().min(1, "Role name is required"),
        user_id: z.string().trim().min(1, "User ID is required"),

        data_scope: z.enum(["CREATED", "ASSIGNED", "ALL"], {
            required_error: "Data scope is required",
            invalid_type_error: "Invalid data scope value",
        }),
    }).strict(),
});


export const RoleUpdateValidator = z.object({
    body: z.object({
        role_id: z.string().trim().min(1, "Role ID is required"),
        role_name: z.string().trim().min(1, "Role name is required"),
        user_id: z.string().trim().min(1, "User ID is required"),
    }).strict(),
});


export const RoleStatusChangeValidator = z.object({
    body: z.object({
        role_id: z.string().trim().min(1, "Role ID is required"),
    }).strict(),
});


export const RoleDeleteValidator = z.object({
    body: z.object({
        role_id: z.string().trim().min(1, "Role ID is required"),
    }).strict(),
});


export const RoleUniqueValidator = z.object({
    body: z.object({
        role_id: z.string().trim().optional(),
        role_name: z.string().trim().min(1, "Role name is required"),
    }).strict(),
});


export const RoleListValidator = z.object({
    body: z.object({}).strict().optional(),
});



