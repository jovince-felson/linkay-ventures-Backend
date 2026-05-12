import { Router } from "express";
import { verifyInternalRequest } from "../middlewares/internalverify.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendKycApprovedEmail,
  sendKycRejectedEmail,
  sendKycResubmitEmail,
  sendKycPushNotification,
} from "../controllers/internal.email.controller.js";

const router = Router();

router.use(verifyInternalRequest);

router.post("/email/verification", sendVerificationEmail);
router.post("/email/password-reset", sendPasswordResetEmail);
router.post("/email/kyc-approved", sendKycApprovedEmail);
router.post("/email/kyc-rejected", sendKycRejectedEmail);
router.post("/email/kyc-resubmit", sendKycResubmitEmail);
router.post("/push/kyc-status", sendKycPushNotification);

export default router;
