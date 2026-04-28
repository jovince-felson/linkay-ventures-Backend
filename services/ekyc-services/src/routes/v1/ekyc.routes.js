import express from "express";
import * as EkycController from '../../controllers/ekyc.controller.js';
import { validate } from "../../middlewares/validate.js";
import * as EkycValidator from "../../validators/ekyc.validator.js";

const router = express.Router();

router.post("/step-status", EkycController.FetchUserStatus);
router.post("/store-personal-info",validate(EkycValidator.PersonalInfoValidator),EkycController.StorePersonalInfo);
router.post("/initiate-sumsub",EkycController.InitiateSumSub);
router.post("/fetch-document",EkycController.FetchDocDetails);
router.post("/fetch-kyc-status",EkycController.FetchKycStatus);
router.post("/handle-sumsub-webhook",EkycController.HandleWebHook);
router.get("/fetch-levels",EkycController.FetchLevels);
router.post("/fetch-details",EkycController.FetchEkycDetails);
router.post("/generate-share-token",EkycController.GenerateShareToken);

export default router;
