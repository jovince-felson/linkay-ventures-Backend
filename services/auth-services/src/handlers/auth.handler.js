import User from "../models/users.model.js";
import {logger, decryptId} from "rhoam-shared-utils";

export const EkycCompletion = async(data) =>{
    try{
        const {user_id } = data;

        const decrypted_user_id = decryptId(user_id);

        const user = await User.findOne({
            where:{
                id: decrypted_user_id
            }
        });

        if(user)
        {
            user.ekyc_passed = true;
            await user.save();
            return true;
        }
        return false;
        
    }       
    catch(Exception)
    {
        logger.error("Error In Ekyc Completion Handler",Exception);
        return false;
    }
};  