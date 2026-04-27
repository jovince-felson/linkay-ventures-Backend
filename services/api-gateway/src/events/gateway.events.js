import { Topics, Keys } from "linkay-shared-utils";
import { ErrorHandler, AuditHandler} from '../handlers/gateway.handlers.js';


const eventHandlers = {
    [Keys.ERRORS]: ErrorHandler,
    [Keys.AUDIT_EVENTS] : AuditHandler,
};


export async function routeGatewayEvent(key, data) {
    const handler = eventHandlers[key];
    if (handler) {
        await handler(data);
    } else {
        console.warn(`No handler found for event key: ${key}`);
    }
}
