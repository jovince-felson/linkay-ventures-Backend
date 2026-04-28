import MailConfigs from "../models/mailconfig.model.js";
import { logger } from "rhoam-shared-utils";

export const GetActiveMail = async () => {
    try {
        const ActiveMail = await MailConfigs.findOne({
            where: {
                is_active: 1,
                trash: "NO",
            }
        });

        if(ActiveMail){
            return ActiveMail;
        }

        return false;
    }
    catch (exception) {
        logger.error("Error From Active Mail Helper Function", exception);
        return false;
    }
}