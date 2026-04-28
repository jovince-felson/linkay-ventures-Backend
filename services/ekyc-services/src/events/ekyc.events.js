import {Topics, Keys, logger} from "rhoam-shared-utils";
import { StoreDocumentData, DeleteDocumentData } from "../handlers/ekyc.handler.js";

const eventHandlers = {
    [Keys.EKYC_DOCUMENT_UPLOAD] : StoreDocumentData,
    [Keys.EKYC_DOCUMENT_DELETED] : DeleteDocumentData,
};

export async function routeEkycEvent(key, data){
    const handlers = eventHandlers[key];

    if(handlers)
    {
        await handlers(data);
    }

    else
    {
        logger.error("No Handler Found For Ekyc Event Key",key);
        console.warn(`No Handler Found For Event Key: ${key}`);
    }
};
