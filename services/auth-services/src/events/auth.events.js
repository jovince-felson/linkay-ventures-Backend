import {Topics, Keys, logger} from "rhoam-shared-utils";
import { EkycCompletion } from "../handlers/auth.handler.js";

const eventHandlers = {
    [Keys.EKYC_VERIFICATION_COMPLETED] : EkycCompletion,
};

export async function routeAuthEvents(key, data){
    const handlers = eventHandlers[key];

    if(handlers)
    {
        await handlers(data);
    }

    else
    {
        logger.error("No Handler Found For Auth Event Key",key);
        console.warn(`No Handler Found For Event Key: ${key}`);
    }
};
