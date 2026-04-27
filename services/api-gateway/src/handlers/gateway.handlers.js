import { logger, SERVICES_TYPE } from "linkay-shared-utils";
import UserTracking from "../models/user_tracking.models.js";
import AuditLog from "../models/audit.model.js";
import ErrorLog from "../models/error_log.model.js";


export const ErrorHandler = async(data) =>{
    try{
        const service_name = data.service_name;
        const error_origin = data.error_origin;
        const error_description = data.error_description;

        const store_log = await ErrorLog.create({
            service_name,
            error_origin,
            error_description,
            created_at: new Date(),
        });

        return true;
    }
    catch(exception)
    {
        logger.error("API Gateway Error Handler",exception);
        return false;
    }
};  


export const AuditHandler = async(data) =>{
    try{
        const user_id = data.user_id;
        const session_id = data.session_id;
        const device_id = data.device_id;
        const device_name = data.device_name;
        const ip = data.ip;
        const audit_type = SERVICES_TYPE[data.audit_type];
        const audit_event = data.audit_event;

        const store_audit = await AuditLog.create({
            user_id,
            session_id,
            device_id,
            device_name,
            ip,
            audit_type,
            audit_event,
            created_by: user_id,
            created_at: new Date(),
        });

        return true;
    }   
    catch(exception)
    {
        logger.error("API Gateway Audit Handler Error",exception);
        return false;
    }
};  
