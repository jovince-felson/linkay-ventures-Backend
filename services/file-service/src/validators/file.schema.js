import { z } from "zod";

export const UploadFileSchema = z.object({
  body: z.object({
    context: z.enum([
      "USER",
      "ACCOUNT",
      "SUPPORT",
      "EKYC",
      "PAYMENTS",
      "CARD",
    ]),
    context_id: z.string().min(1, "context_id is required"),
    user_id: z.string().min(1, "user_id is required"),
  }),
});
