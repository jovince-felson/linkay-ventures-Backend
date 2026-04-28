import { z } from "zod";

const ALLOWED_PERMISSIONS = [
    "List",
    "Add",
    "Edit",
    "View",
    "Delete",
    "StatusChange",
    "Approve",
];

const PermissionSchema = z.object(
    ALLOWED_PERMISSIONS.reduce((acc, key) => {
        acc[key] = z.boolean().optional();
        return acc;
    }, {})
).strict();

export const AssignPermissionValidator = z.object({
    body: z.object({
        role_id: z.string().trim().min(1, "Role ID is required"),
        menu_key: z.string().trim().min(1, "Menu Key is required"),
        user_id: z.string().trim().min(1, "User ID is required"),

        permissions: PermissionSchema,
    }).strict(),
});

export const GetPermissionValidator = z.object({
    body: z.object({
        role_id: z.string().trim().min(1, "Role ID is required"),
    }).strict(),
});

export const PermissionListValidator = z.object({
    body: z.object({}).strict().optional(),
    query: z.object({}).strict().optional(),
    params: z.object({}).strict().optional(),
});