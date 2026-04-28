import { z } from "zod";

export const MailIndexValidator = z.object({
    query: z.object({
        draw: z.string().optional(),
        start: z.string().optional(),
        length: z.string().optional(),
    }).strict().optional(),
}).strict();


export const MailStoreValidator = z.object({
    body: z.object({
        user_id: z.string().trim().min(1, "User ID is required"),
        smtp_host: z.string().trim().min(1, "SMTP host is required"),
        smtp_user: z.string().trim().min(1, "SMTP user is required"),
        smtp_password: z.string().trim().min(1, "SMTP password is required"),
        smtp_port: z.union([z.string(), z.number()]),
        smtp_mailer: z.string().trim().min(1, "SMTP mailer is required"),
        smtp_encryption: z.string().optional(),
    }).strict(),
});


export const MailUpdateValidator = z.object({
    body: z.object({
        mail_id: z.string().trim().min(1, "Mail ID is required"),
        user_id: z.string().trim().min(1, "User ID is required"),
        smtp_host: z.string().trim().min(1, "SMTP host is required"),
        smtp_user: z.string().trim().min(1, "SMTP user is required"),
        smtp_password: z.string().trim().min(1, "SMTP password is required"),
        smtp_port: z.union([z.string(), z.number()]),
        smtp_mailer: z.string().trim().min(1, "SMTP mailer is required"),
        smtp_encryption: z.string().optional(),
    }).strict(),
});


export const MailStatusValidator = z.object({
    body: z.object({
        mail_id: z.string().trim().min(1, "Mail ID is required"),
        status: z.number().int().min(0).max(1),
    }).strict(),
});

export const MailDeleteValidator = z.object({
    body: z.object({
        mail_id: z.string().trim().min(1, "Mail ID is required"),
    }).strict(),
});



