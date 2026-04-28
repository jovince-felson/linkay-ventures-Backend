import { VerifyAdmin } from "rhoam-shared-utils";
import { Index, GetActiveMail, GetMail, Store, Update, StatusChange, Delete } from "../../controllers/mailconfig.controller.js";
import * as MailConfigValidator from "../../validators/mailconfig.validator.js";
import express from "express";
import { validate } from "../../middlewares/validate.js";


import {GetLogs} from "../../controllers/log.controller.js";

const router = express.Router();


router.post('/mail-config/list',VerifyAdmin,validate(MailConfigValidator.MailIndexValidator),Index);
router.post('/mail-config/store',VerifyAdmin,validate(MailConfigValidator.MailStoreValidator),Store);
router.post('/mail-config/update',VerifyAdmin,validate(MailConfigValidator.MailUpdateValidator),Update);
router.post('/mail-config/status-change',VerifyAdmin,validate(MailConfigValidator.MailStatusValidator),StatusChange);
router.post('/mail-config/delete',VerifyAdmin,validate(MailConfigValidator.MailDeleteValidator),Delete);
router.post('/mail-config/fetch-mail',VerifyAdmin,GetMail);
router.get('/mail-config/active-mail',GetActiveMail);
router.post('/logs',VerifyAdmin,GetLogs);

export default router;