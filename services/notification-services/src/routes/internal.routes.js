import { Router } from "express";
import { verifyInternalRequest } from "../middlewares/internalverify.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../controllers/internal.email.controller.js";

const router = Router();

router.use(verifyInternalRequest);

router.post("/email/verification", sendVerificationEmail);
router.post("/email/password-reset", sendPasswordResetEmail);

export default router;
